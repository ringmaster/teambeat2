package main

import (
	"fmt"
	"sync"
	"time"
)

// EventCorrelator tracks sent events and matches them with received events
type EventCorrelator struct {
	sentEvents        map[string]*SentEvent              // eventID -> SentEvent
	receivedEvents    map[string]map[int]time.Time       // eventID -> receiverID -> receiveTime
	pendingReceived   []ReceivedEvent                    // Events received before corresponding sent event
	latencies         []time.Duration                    // all latencies for percentile calculation
	connectedUsers    int                                // Current count of connected users
	mu                sync.RWMutex
	verbose           bool
}

// NewEventCorrelator creates a new event correlator
func NewEventCorrelator(verbose bool) *EventCorrelator {
	return &EventCorrelator{
		sentEvents:      make(map[string]*SentEvent),
		receivedEvents:  make(map[string]map[int]time.Time),
		pendingReceived: make([]ReceivedEvent, 0),
		latencies:       make([]time.Duration, 0),
		verbose:         verbose,
	}
}

// RecordSentEvent records an event that was sent by a user
func (c *EventCorrelator) RecordSentEvent(eventType, cardID string, senderID int) string {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Create unique event ID
	eventID := fmt.Sprintf("%s_%s_%d_%d", eventType, cardID, time.Now().UnixNano(), senderID)

	c.sentEvents[eventID] = &SentEvent{
		ID:             eventID,
		Type:           eventType,
		CardID:         cardID,
		SenderID:       senderID,
		Timestamp:      time.Now(),
		ConnectedUsers: c.connectedUsers, // Snapshot of connected users at send time
	}

	// Initialize received tracking
	c.receivedEvents[eventID] = make(map[int]time.Time)

	// Check if any pending received events match this sent event
	var remainingPending []ReceivedEvent
	for _, pending := range c.pendingReceived {
		if pending.Type == eventType && pending.CardID == cardID {
			// This pending event matches (including self-events)!
			c.receivedEvents[eventID][pending.ReceiverID] = pending.Timestamp
			latency := pending.Timestamp.Sub(c.sentEvents[eventID].Timestamp)
			c.latencies = append(c.latencies, latency)
			if c.verbose {
				fmt.Printf("📨 Matched pending event: %s for card %s by user %d (latency: %v)\n",
					eventType, cardID, pending.ReceiverID, latency)
			}
		} else {
			// Keep this pending event for future matching
			remainingPending = append(remainingPending, pending)
		}
	}
	c.pendingReceived = remainingPending

	return eventID
}

// RecordReceivedEvent records an event received by a user via SSE
func (c *EventCorrelator) RecordReceivedEvent(eventType, cardID string, receiverID int, receiveTime time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Find matching sent event (most recent for this type/cardID combination)
	var matchingEventID string
	var latestTimestamp time.Time

	for eventID, sentEvent := range c.sentEvents {
		if sentEvent.Type == eventType && sentEvent.CardID == cardID {
			// Find most recent matching event (including self-events)
			if sentEvent.Timestamp.After(latestTimestamp) {
				matchingEventID = eventID
				latestTimestamp = sentEvent.Timestamp
			}
		}
	}

	if matchingEventID != "" {
		// Record the reception
		if receivers, ok := c.receivedEvents[matchingEventID]; ok {
			// Only record if not already received by this user
			if _, alreadyReceived := receivers[receiverID]; !alreadyReceived {
				receivers[receiverID] = receiveTime

				// Calculate latency
				sentEvent := c.sentEvents[matchingEventID]
				latency := receiveTime.Sub(sentEvent.Timestamp)
				c.latencies = append(c.latencies, latency)

				if c.verbose {
					fmt.Printf("📨 Event matched: %s for card %s by user %d (latency: %v)\n",
						eventType, cardID, receiverID, latency)
				}
			}
		}
	} else {
		// No matching sent event yet - add to pending
		c.pendingReceived = append(c.pendingReceived, ReceivedEvent{
			Type:       eventType,
			CardID:     cardID,
			ReceiverID: receiverID,
			Timestamp:  receiveTime,
		})
		if c.verbose {
			fmt.Printf("⏳ Pending event (will match later): %s for card %s by user %d\n", eventType, cardID, receiverID)
		}
	}
}

// GenerateReport generates the final test report
func (c *EventCorrelator) GenerateReport(totalConnectedUsers int) *TestResult {
	c.mu.RLock()
	defer c.mu.RUnlock()

	result := &TestResult{
		ByType:              make(map[string]*EventTypeStats),
		LatencyStats:        c.calculateLatencyStats(),
		ConnectionStability: &ConnectionStats{},
	}

	// Calculate per-type statistics
	typeCounts := make(map[string]*EventTypeStats)

	for eventID, sentEvent := range c.sentEvents {
		eventType := sentEvent.Type

		// Initialize type stats if needed
		if _, ok := typeCounts[eventType]; !ok {
			typeCounts[eventType] = &EventTypeStats{
				Sent:     0,
				Expected: 0,
				Received: 0,
				Missed:   0,
			}
		}

		stats := typeCounts[eventType]
		stats.Sent++

		// Expected receivers: all users connected AT THE TIME this event was sent
		expectedReceivers := sentEvent.ConnectedUsers
		stats.Expected += expectedReceivers

		// Actual receivers
		if receivers, ok := c.receivedEvents[eventID]; ok {
			actualReceivers := len(receivers)
			stats.Received += actualReceivers
		}
	}

	// Calculate rates and missed counts
	for _, stats := range typeCounts {
		stats.Missed = stats.Expected - stats.Received
		if stats.Expected > 0 {
			stats.Rate = float64(stats.Received) / float64(stats.Expected) * 100.0
		} else {
			stats.Rate = 100.0
		}
	}

	result.ByType = typeCounts

	// Calculate overall stats
	result.EventsSent = len(c.sentEvents)
	for _, stats := range typeCounts {
		result.EventsExpected += stats.Expected
		result.EventsReceived += stats.Received
	}

	return result
}

// calculateLatencyStats calculates latency percentiles
func (c *EventCorrelator) calculateLatencyStats() *LatencyStats {
	if len(c.latencies) == 0 {
		return &LatencyStats{}
	}

	// Sort latencies for percentile calculation
	sortedLatencies := make([]time.Duration, len(c.latencies))
	copy(sortedLatencies, c.latencies)

	// Simple bubble sort (good enough for our use case)
	for i := 0; i < len(sortedLatencies); i++ {
		for j := i + 1; j < len(sortedLatencies); j++ {
			if sortedLatencies[i] > sortedLatencies[j] {
				sortedLatencies[i], sortedLatencies[j] = sortedLatencies[j], sortedLatencies[i]
			}
		}
	}

	// Calculate statistics
	var sum time.Duration
	for _, lat := range sortedLatencies {
		sum += lat
	}

	stats := &LatencyStats{
		Count: len(sortedLatencies),
		Mean:  sum / time.Duration(len(sortedLatencies)),
		Max:   sortedLatencies[len(sortedLatencies)-1],
	}

	// Calculate percentiles
	stats.P50 = sortedLatencies[int(float64(len(sortedLatencies))*0.50)]
	stats.P90 = sortedLatencies[int(float64(len(sortedLatencies))*0.90)]
	stats.P95 = sortedLatencies[int(float64(len(sortedLatencies))*0.95)]
	stats.P99 = sortedLatencies[int(float64(len(sortedLatencies))*0.99)]

	return stats
}

// GetStats returns current statistics (for monitoring during test)
func (c *EventCorrelator) GetStats() (sent, received int) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	sent = len(c.sentEvents)
	for _, receivers := range c.receivedEvents {
		received += len(receivers)
	}
	return
}

// SetConnectedUsers updates the current count of connected users
func (c *EventCorrelator) SetConnectedUsers(count int) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.connectedUsers = count
}
