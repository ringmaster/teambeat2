package main

import (
	"sync"
	"time"
)

// Config holds all test configuration parameters
type Config struct {
	BaseURL         string
	ConcurrentUsers int
	TestDuration    time.Duration
	RequestsPerMin  int
	GracePeriod     time.Duration
	AdminEmail      string
	AdminPassword   string
	Verbose         bool
	Debug           bool
}

// SentEvent represents an event that was sent by a user action
type SentEvent struct {
	ID              string
	Type            string
	CardID          string
	SenderID        int
	Timestamp       time.Time
	ConnectedUsers  int  // Number of users connected when event was sent
}

// ReceivedEvent represents an SSE event received by a user
type ReceivedEvent struct {
	Type       string
	CardID     string
	ReceiverID int
	Timestamp  time.Time
}

// UserContext holds the state for a simulated user
type UserContext struct {
	ID            int
	Username      string
	Email         string
	Password      string
	SessionCookie string
	ClientID      string
	IsConnected   bool
	CardIDs       []string
	ColumnIDs     []string
	StopChan      chan bool
	EventChan     chan ReceivedEvent
	mu            sync.RWMutex
}

// BoardState represents the current state of a board
type BoardState struct {
	ID              string
	Name            string
	SeriesID        string
	Status          string
	CurrentSceneID  string
	Columns         []Column
	Scenes          []Scene
}

// Column represents a board column
type Column struct {
	ID    string
	Name  string
	Order int
	Cards []Card
}

// Card represents a card
type Card struct {
	ID       string
	Content  string
	ColumnID string
	GroupID  string
	Order    int
}

// Scene represents a board scene
type Scene struct {
	ID              string
	Title           string
	Mode            string
	Flags           []string
	AllowAddCards   bool
	AllowEditCards  bool
	AllowMoveCards  bool
	AllowGroupCards bool
	AllowVoting     bool
}

// HasFlag checks if a scene has a specific flag
func (s *Scene) HasFlag(flag string) bool {
	for _, f := range s.Flags {
		if f == flag {
			return true
		}
	}
	return false
}

// Series represents a series
type Series struct {
	ID          string
	Name        string
	Description string
}

// APIResponse wraps common API response patterns
type APIResponse struct {
	Board  *BoardState `json:"board,omitempty"`
	Card   *Card       `json:"card,omitempty"`
	Series *Series     `json:"series,omitempty"`
	Error  string      `json:"error,omitempty"`
}

// SSEMessage represents a parsed SSE message
type SSEMessage struct {
	Type   string
	Data   map[string]interface{}
	CardID string
	Card   *Card
}

// TestResult holds final test statistics
type TestResult struct {
	Duration            time.Duration
	ConnectedUsers      int
	TotalUsers          int
	EventsSent          int
	EventsExpected      int
	EventsReceived      int
	ByType              map[string]*EventTypeStats
	LatencyStats        *LatencyStats
	MessageRate         float64
	ConnectionStability *ConnectionStats
}

// EventTypeStats holds statistics for a specific event type
type EventTypeStats struct {
	Sent     int
	Expected int
	Received int
	Missed   int
	Rate     float64
}

// LatencyStats holds latency percentile statistics
type LatencyStats struct {
	Mean  time.Duration
	P50   time.Duration
	P90   time.Duration
	P95   time.Duration
	P99   time.Duration
	Max   time.Duration
	Count int
}

// ConnectionStats holds connection stability metrics
type ConnectionStats struct {
	Disconnections int
	Reconnections  int
	FailedConns    int
}

// Helper methods for UserContext
func (u *UserContext) AddCardID(cardID string) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.CardIDs = append(u.CardIDs, cardID)
}

func (u *UserContext) GetCardIDs() []string {
	u.mu.RLock()
	defer u.mu.RUnlock()
	return append([]string{}, u.CardIDs...)
}

func (u *UserContext) SetConnected(connected bool) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.IsConnected = connected
}

func (u *UserContext) Connected() bool {
	u.mu.RLock()
	defer u.mu.RUnlock()
	return u.IsConnected
}
