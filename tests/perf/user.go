package main

import (
	"fmt"
	"math/rand"
	"time"
)

// UserSimulator simulates a single user's behavior
type UserSimulator struct {
	ctx        *UserContext
	api        *APIClient
	sse        *SSEClient
	correlator *EventCorrelator
	config     *Config
	boardID    string
}

// NewUserSimulator creates a new user simulator
func NewUserSimulator(userID int, boardID string, columnIDs []string, correlator *EventCorrelator, config *Config) *UserSimulator {
	timestamp := time.Now().UnixNano() % 1000000
	username := fmt.Sprintf("testuser%d_%d", userID, timestamp)

	ctx := &UserContext{
		ID:        userID,
		Username:  username,
		Email:     fmt.Sprintf("%s@loadtest.local", username),
		Password:  "testpass123",
		ColumnIDs: columnIDs,
		CardIDs:   make([]string, 0),
		StopChan:  make(chan bool),
		EventChan: make(chan ReceivedEvent, 100),
	}

	return &UserSimulator{
		ctx:        ctx,
		api:        NewAPIClient(config.BaseURL, config.Debug),
		correlator: correlator,
		config:     config,
		boardID:    boardID,
	}
}

// Setup authenticates the user and establishes SSE connection
func (u *UserSimulator) Setup() error {
	// Try to register
	cookie, err := u.api.Register(u.ctx.Email, u.ctx.Username, u.ctx.Password)
	if err != nil {
		// Try login if registration fails
		cookie, err = u.api.Login(u.ctx.Email, u.ctx.Password)
		if err != nil {
			return fmt.Errorf("authentication failed: %w", err)
		}
	}

	u.ctx.SessionCookie = cookie

	// Establish SSE connection
	u.sse = NewSSEClient(u.config.BaseURL, u.boardID, cookie, u.ctx.EventChan, u.config.Verbose)
	if err := u.sse.Connect(); err != nil {
		return fmt.Errorf("SSE connection failed: %w", err)
	}

	// Wait for connection to establish and get clientID
	if err := u.sse.WaitForConnection(10 * time.Second); err != nil {
		return fmt.Errorf("SSE connection timeout: %w", err)
	}

	u.ctx.ClientID = u.sse.GetClientID()

	// Join the board
	if err := u.api.JoinBoard(u.ctx.ClientID, u.boardID, u.ctx.Username); err != nil {
		return fmt.Errorf("join board failed: %w", err)
	}

	u.ctx.SetConnected(true)
	return nil
}

// Start begins the user's activity simulation
func (u *UserSimulator) Start(stopChan chan bool, rateLimiter <-chan time.Time) {
	// Start listening for SSE events
	go u.listenForEvents()

	// Start activity loop - wait for rate limiter ticks
	for {
		select {
		case <-stopChan:
			return
		case <-u.ctx.StopChan:
			return
		case <-rateLimiter:
			if u.ctx.Connected() {
				u.performRandomAction()
			}
		}
	}
}

// listenForEvents processes incoming SSE events
func (u *UserSimulator) listenForEvents() {
	for {
		select {
		case <-u.ctx.StopChan:
			return
		case event := <-u.ctx.EventChan:
			// Add receiver ID
			event.ReceiverID = u.ctx.ID
			// Note: Users DO receive their own events via SSE, but we don't count them
			// in correlation because we're measuring broadcast to OTHER users
			u.correlator.RecordReceivedEvent(event.Type, event.CardID, event.ReceiverID, event.Timestamp)
		}
	}
}

// performRandomAction performs a weighted random action
func (u *UserSimulator) performRandomAction() {
	actions := []struct {
		weight int
		action func() error
	}{
		{40, u.createCard},     // 40% create card
		{20, u.moveCard},       // 20% move card
		{20, u.voteOnCard},     // 20% vote
		{10, u.groupCards},     // 10% group cards
		{10, u.groupCardOnto},  // 10% group card onto another
	}

	// Calculate total weight
	totalWeight := 0
	for _, a := range actions {
		totalWeight += a.weight
	}

	// Pick random action
	roll := rand.Intn(totalWeight)
	cumulative := 0
	for _, a := range actions {
		cumulative += a.weight
		if roll < cumulative {
			_ = a.action()
			return
		}
	}
}

// createCard creates a new card
func (u *UserSimulator) createCard() error {
	if len(u.ctx.ColumnIDs) == 0 {
		return fmt.Errorf("no columns available")
	}

	randomColumn := u.ctx.ColumnIDs[rand.Intn(len(u.ctx.ColumnIDs))]
	content := fmt.Sprintf("Test card from user %d at %s", u.ctx.ID, time.Now().Format("15:04:05"))

	// Pre-register the event with a temporary ID (we'll update it after creation)
	// Actually, we don't know the card ID yet, so we need to record after but handle race condition differently

	card, err := u.api.CreateCard(u.boardID, randomColumn, content)
	if err != nil {
		if u.config.Verbose {
			fmt.Printf("User %d: create card failed: %v\n", u.ctx.ID, err)
		}
		return err
	}

	// Record IMMEDIATELY after getting the ID, before any other processing
	u.correlator.RecordSentEvent("card_created", card.ID, u.ctx.ID)
	u.ctx.AddCardID(card.ID)

	if u.config.Verbose {
		fmt.Printf("✅ User %d created card %s\n", u.ctx.ID, card.ID)
	}

	return nil
}

// moveCard moves a random card
func (u *UserSimulator) moveCard() error {
	cardIDs := u.ctx.GetCardIDs()
	if len(cardIDs) == 0 || len(u.ctx.ColumnIDs) == 0 {
		return nil // Skip if no cards
	}

	randomCard := cardIDs[rand.Intn(len(cardIDs))]
	randomColumn := u.ctx.ColumnIDs[rand.Intn(len(u.ctx.ColumnIDs))]

	if err := u.api.MoveCard(randomCard, randomColumn); err != nil {
		if u.config.Verbose {
			fmt.Printf("User %d: move card failed: %v\n", u.ctx.ID, err)
		}
		return err
	}

	u.correlator.RecordSentEvent("card_updated", randomCard, u.ctx.ID)

	if u.config.Verbose {
		fmt.Printf("✅ User %d moved card %s\n", u.ctx.ID, randomCard)
	}

	return nil
}

// voteOnCard votes on a random card
func (u *UserSimulator) voteOnCard() error {
	// Get board state to find cards
	board, err := u.api.GetBoard(u.boardID)
	if err != nil {
		return err
	}

	// Collect all cards
	var allCards []string
	for _, column := range board.Columns {
		for _, card := range column.Cards {
			allCards = append(allCards, card.ID)
		}
	}

	if len(allCards) == 0 {
		return nil
	}

	randomCard := allCards[rand.Intn(len(allCards))]

	if err := u.api.VoteOnCard(randomCard); err != nil {
		if u.config.Verbose {
			fmt.Printf("User %d: vote failed: %v\n", u.ctx.ID, err)
		}
		return err
	}

	u.correlator.RecordSentEvent("vote_changed", randomCard, u.ctx.ID)

	if u.config.Verbose {
		fmt.Printf("✅ User %d voted on card %s\n", u.ctx.ID, randomCard)
	}

	return nil
}

// groupCards groups multiple cards
func (u *UserSimulator) groupCards() error {
	board, err := u.api.GetBoard(u.boardID)
	if err != nil {
		return err
	}

	// Find column with at least 2 ungrouped cards
	for _, column := range board.Columns {
		var ungroupedCards []string
		for _, card := range column.Cards {
			if card.GroupID == "" {
				ungroupedCards = append(ungroupedCards, card.ID)
			}
		}

		if len(ungroupedCards) >= 2 {
			// Pick 2-3 cards
			numCards := 2 + rand.Intn(2)
			if numCards > len(ungroupedCards) {
				numCards = len(ungroupedCards)
			}

			cardIDs := ungroupedCards[:numCards]
			groupID := fmt.Sprintf("group-%d-%d", u.ctx.ID, time.Now().UnixNano())

			if err := u.api.GroupCards(u.boardID, cardIDs, groupID); err != nil {
				if u.config.Verbose {
					fmt.Printf("User %d: group cards failed: %v\n", u.ctx.ID, err)
				}
				return err
			}

			u.correlator.RecordSentEvent("cards_grouped", groupID, u.ctx.ID)

			if u.config.Verbose {
				fmt.Printf("✅ User %d grouped %d cards\n", u.ctx.ID, len(cardIDs))
			}

			return nil
		}
	}

	return nil
}

// groupCardOnto groups one card onto another
func (u *UserSimulator) groupCardOnto() error {
	cardIDs := u.ctx.GetCardIDs()
	if len(cardIDs) == 0 {
		return nil
	}

	board, err := u.api.GetBoard(u.boardID)
	if err != nil {
		return err
	}

	// Find one of our ungrouped cards
	var ourCard *Card
	for _, column := range board.Columns {
		for _, card := range column.Cards {
			for _, myCardID := range cardIDs {
				if card.ID == myCardID && card.GroupID == "" {
					ourCard = &card
					break
				}
			}
			if ourCard != nil {
				break
			}
		}
		if ourCard != nil {
			break
		}
	}

	if ourCard == nil {
		return nil
	}

	// Find another card in the same column
	var targetCard *Card
	for _, column := range board.Columns {
		if column.ID != ourCard.ColumnID {
			continue
		}
		for _, card := range column.Cards {
			if card.ID != ourCard.ID {
				targetCard = &card
				break
			}
		}
		if targetCard != nil {
			break
		}
	}

	if targetCard == nil {
		return nil
	}

	if err := u.api.GroupCardOnto(ourCard.ID, targetCard.ID); err != nil {
		if u.config.Verbose {
			fmt.Printf("User %d: group card onto failed: %v\n", u.ctx.ID, err)
		}
		return err
	}

	u.correlator.RecordSentEvent("card_grouped_onto", ourCard.ID, u.ctx.ID)

	if u.config.Verbose {
		fmt.Printf("✅ User %d grouped card %s onto %s\n", u.ctx.ID, ourCard.ID, targetCard.ID)
	}

	return nil
}

// Stop stops the user simulator
func (u *UserSimulator) Stop() {
	close(u.ctx.StopChan)
	if u.sse != nil {
		u.sse.Close()
	}
	u.ctx.SetConnected(false)
}

// IsConnected returns whether the user is connected
func (u *UserSimulator) IsConnected() bool {
	return u.ctx.Connected()
}

// GetID returns the user's ID
func (u *UserSimulator) GetID() int {
	return u.ctx.ID
}
