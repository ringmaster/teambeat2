package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// SSEClient handles Server-Sent Events connections
type SSEClient struct {
	baseURL       string
	boardID       string
	sessionCookie string
	clientID      string
	eventChan     chan ReceivedEvent
	stopChan      chan bool
	ctx           context.Context
	cancel        context.CancelFunc
	verbose       bool
}

// NewSSEClient creates a new SSE client
func NewSSEClient(baseURL, boardID, sessionCookie string, eventChan chan ReceivedEvent, verbose bool) *SSEClient {
	ctx, cancel := context.WithCancel(context.Background())
	return &SSEClient{
		baseURL:       baseURL,
		boardID:       boardID,
		sessionCookie: sessionCookie,
		eventChan:     eventChan,
		stopChan:      make(chan bool),
		ctx:           ctx,
		cancel:        cancel,
		verbose:       verbose,
	}
}

// Connect establishes the SSE connection and starts listening
func (s *SSEClient) Connect() error {
	// Build SSE URL with board ID
	sseURL := fmt.Sprintf("%s/api/sse?boardId=%s", s.baseURL, url.QueryEscape(s.boardID))

	req, err := http.NewRequestWithContext(s.ctx, "GET", sseURL, nil)
	if err != nil {
		return fmt.Errorf("create SSE request: %w", err)
	}

	// Set session cookie
	req.Header.Set("Cookie", fmt.Sprintf("session=%s", s.sessionCookie))
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")

	client := &http.Client{
		Timeout: 0, // No timeout for SSE
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("SSE connection failed: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return fmt.Errorf("SSE connection failed: status %d", resp.StatusCode)
	}

	// Start reading events in a goroutine
	go s.readEvents(resp)

	return nil
}

// readEvents reads and processes SSE events
func (s *SSEClient) readEvents(resp *http.Response) {
	defer resp.Body.Close()

	reader := bufio.NewReader(resp.Body)
	var currentEvent string
	var currentData strings.Builder

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-s.stopChan:
			return
		default:
		}

		line, err := reader.ReadString('\n')
		if err != nil {
			if s.verbose {
				log.Printf("SSE read error: %v", err)
			}
			return
		}

		line = strings.TrimSpace(line)

		// Empty line signals end of event
		if line == "" {
			if currentData.Len() > 0 {
				// If no event type specified, it's a generic message
				eventType := currentEvent
				if eventType == "" {
					eventType = "message"
				}
				s.handleEvent(eventType, currentData.String())
				currentEvent = ""
				currentData.Reset()
			}
			continue
		}

		// Parse SSE field
		if strings.HasPrefix(line, "event:") {
			currentEvent = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
		} else if strings.HasPrefix(line, "data:") {
			data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			if currentData.Len() > 0 {
				currentData.WriteString("\n")
			}
			currentData.WriteString(data)
		}
		// Ignore id: and retry: fields
	}
}

// handleEvent processes a complete SSE event
func (s *SSEClient) handleEvent(eventType, data string) {
	if s.verbose {
		log.Printf("SSE event received: type=%s, data=%s", eventType, data)
	}

	// Handle the 'connected' event specially to extract clientId
	if eventType == "connected" {
		var connData struct {
			ClientID string `json:"clientId"`
		}
		if err := json.Unmarshal([]byte(data), &connData); err == nil {
			s.clientID = connData.ClientID
			log.Printf("SSE connected, clientID: %s", s.clientID)
		}
		return
	}

	// Parse the data as JSON
	var eventData map[string]interface{}
	if err := json.Unmarshal([]byte(data), &eventData); err != nil {
		if s.verbose {
			log.Printf("Failed to parse SSE data: %v", err)
		}
		return
	}

	// Check if the event type is embedded in the data
	if dataType, ok := eventData["type"].(string); ok && dataType != "" {
		eventType = dataType
	}

	// Extract card ID from various possible locations
	cardID := s.extractCardID(eventType, eventData)

	if cardID != "" {
		// Send to event channel for correlation
		select {
		case s.eventChan <- ReceivedEvent{
			Type:      eventType,
			CardID:    cardID,
			Timestamp: time.Now(),
		}:
		default:
			// Channel full, skip
		}
	}
}

// extractCardID extracts the card ID from event data based on event type
func (s *SSEClient) extractCardID(eventType string, data map[string]interface{}) string {
	switch eventType {
	case "card_created", "card_updated":
		// Check for card object
		if card, ok := data["card"].(map[string]interface{}); ok {
			if id, ok := card["id"].(string); ok {
				return id
			}
		}
		// Check for direct card_id
		if id, ok := data["card_id"].(string); ok {
			return id
		}
		if id, ok := data["cardId"].(string); ok {
			return id
		}

	case "vote_changed":
		// vote_changed uses card_id field
		if id, ok := data["card_id"].(string); ok {
			return id
		}
		if id, ok := data["cardId"].(string); ok {
			return id
		}

	case "cards_grouped":
		// cards_grouped uses groupId
		if id, ok := data["groupId"].(string); ok {
			return id
		}

	case "card_grouped_onto":
		// card_grouped_onto uses cardId
		if id, ok := data["cardId"].(string); ok {
			return id
		}
	}

	return ""
}

// GetClientID returns the client ID assigned by the server
func (s *SSEClient) GetClientID() string {
	return s.clientID
}

// WaitForConnection waits for the SSE connection to establish and receive clientID
func (s *SSEClient) WaitForConnection(timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if s.clientID != "" {
			return nil
		}
		time.Sleep(100 * time.Millisecond)
	}
	return fmt.Errorf("timeout waiting for SSE connection")
}

// Close closes the SSE connection
func (s *SSEClient) Close() {
	s.cancel()
	close(s.stopChan)
}
