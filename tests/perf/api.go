package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
)

// APIClient handles HTTP requests to the TeamBeat API
type APIClient struct {
	baseURL    string
	httpClient *http.Client
	debug      bool
}

// NewAPIClient creates a new API client with cookie jar
func NewAPIClient(baseURL string, debug bool) *APIClient {
	jar, _ := cookiejar.New(nil)
	return &APIClient{
		baseURL: baseURL,
		debug:   debug,
		httpClient: &http.Client{
			Jar: jar,
		},
	}
}

// Register registers a new user account
func (c *APIClient) Register(email, name, password string) (string, error) {
	payload := map[string]string{
		"email":    email,
		"name":     name,
		"password": password,
	}

	if c.debug {
		fmt.Printf("DEBUG: Registering user: %s\n", email)
	}

	resp, err := c.post("/api/auth/register", payload)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if c.debug {
		fmt.Printf("DEBUG: Registration response status: %d\n", resp.StatusCode)
	}

	// Read the body for debugging
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		if c.debug {
			fmt.Printf("DEBUG: Registration failed response body: %s\n", string(body))
		}
		return "", fmt.Errorf("register failed: %d - %s", resp.StatusCode, string(body))
	}

	// Check for Set-Cookie header
	cookies := resp.Header.Get("Set-Cookie")
	if cookies != "" {
		if c.debug {
			fmt.Printf("DEBUG: Registration Set-Cookie header: %s\n", cookies)
		}
	}

	// Extract session cookie from jar
	cookie := c.getSessionCookie()
	if c.debug {
		fmt.Printf("DEBUG: Session cookie from jar: '%s'\n", cookie)
	}
	if c.debug {
		fmt.Printf("DEBUG: Registration response body: %s\n", string(body))
	}

	return cookie, nil
}

// Login authenticates an existing user
func (c *APIClient) Login(email, password string) (string, error) {
	payload := map[string]string{
		"email":    email,
		"password": password,
	}

	resp, err := c.post("/api/auth/login", payload)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("login failed: %d - %s", resp.StatusCode, string(body))
	}

	cookie := c.getSessionCookie()
	return cookie, nil
}

// CreateSeries creates a new series
func (c *APIClient) CreateSeries(name, description string) (*Series, error) {
	payload := map[string]string{
		"name":        name,
		"description": description,
	}

	resp, err := c.post("/api/series", payload)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("create series failed: %d - %s", resp.StatusCode, string(body))
	}

	var result struct {
		Series *Series `json:"series"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode series response: %w", err)
	}

	if result.Series == nil {
		return nil, fmt.Errorf("no series in response")
	}

	return result.Series, nil
}

// GetSeries gets all series
func (c *APIClient) GetSeries() ([]Series, error) {
	resp, err := c.get("/api/series")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("get series failed: %d - %s", resp.StatusCode, string(body))
	}

	var result struct {
		Series []Series `json:"series"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode series list: %w", err)
	}

	return result.Series, nil
}

// CreateBoard creates a new board
func (c *APIClient) CreateBoard(name, seriesID string) (*BoardState, error) {
	payload := map[string]string{
		"name":     name,
		"seriesId": seriesID,
	}

	resp, err := c.post("/api/boards", payload)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("create board failed: %d - %s", resp.StatusCode, string(body))
	}

	var result struct {
		Board *BoardState `json:"board"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode board response: %w", err)
	}

	if result.Board == nil {
		return nil, fmt.Errorf("no board in response")
	}

	return result.Board, nil
}

// SetupBoardTemplate sets up a board with a template
func (c *APIClient) SetupBoardTemplate(boardID, template string) error {
	payload := map[string]string{
		"template": template,
	}

	resp, err := c.post(fmt.Sprintf("/api/boards/%s/setup-template", boardID), payload)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("setup template failed: %d - %s", resp.StatusCode, string(body))
	}

	return nil
}

// UpdateBoard updates board properties
func (c *APIClient) UpdateBoard(boardID string, updates map[string]interface{}) error {
	resp, err := c.patch(fmt.Sprintf("/api/boards/%s", boardID), updates)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("update board failed: %d - %s", resp.StatusCode, string(body))
	}

	return nil
}

// UpdateScene updates scene properties
func (c *APIClient) UpdateScene(boardID, sceneID string, updates map[string]interface{}) error {
	if c.debug {
		fmt.Printf("DEBUG: Updating scene %s on board %s with: %+v\n", sceneID, boardID, updates)
	}

	resp, err := c.patch(fmt.Sprintf("/api/boards/%s/scenes/%s", boardID, sceneID), updates)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if c.debug {
		fmt.Printf("DEBUG: Update scene response status: %d, body: %s\n", resp.StatusCode, string(body))
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("update scene failed: %d - %s", resp.StatusCode, string(body))
	}

	return nil
}

// AddUserToSeries adds a user to a series by email
func (c *APIClient) AddUserToSeries(seriesID, userEmail, role string) error {
	payload := map[string]interface{}{
		"email": userEmail,
		"role":  role,
	}

	resp, err := c.post(fmt.Sprintf("/api/series/%s/users", seriesID), payload)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("add user to series failed: %d - %s", resp.StatusCode, string(body))
	}

	return nil
}

// GetBoard retrieves board state
func (c *APIClient) GetBoard(boardID string) (*BoardState, error) {
	resp, err := c.get(fmt.Sprintf("/api/boards/%s", boardID))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("get board failed: %d - %s", resp.StatusCode, string(body))
	}

	var result struct {
		Board *BoardState `json:"board"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode board: %w", err)
	}

	if result.Board == nil {
		return nil, fmt.Errorf("no board in response")
	}

	return result.Board, nil
}

// CreateCard creates a new card
func (c *APIClient) CreateCard(boardID, columnID, content string) (*Card, error) {
	payload := map[string]string{
		"columnId": columnID,
		"content":  content,
	}

	resp, err := c.post(fmt.Sprintf("/api/boards/%s/cards", boardID), payload)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("create card failed: %d - %s", resp.StatusCode, string(body))
	}

	var result struct {
		Card *Card `json:"card"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode card response: %w", err)
	}

	if result.Card == nil {
		return nil, fmt.Errorf("no card in response")
	}

	return result.Card, nil
}

// MoveCard moves a card to a different column
func (c *APIClient) MoveCard(cardID, columnID string) error {
	payload := map[string]string{
		"columnId": columnID,
	}

	resp, err := c.put(fmt.Sprintf("/api/cards/%s/move", cardID), payload)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("move card failed: %d - %s", resp.StatusCode, string(body))
	}

	return nil
}

// VoteOnCard votes on a card
func (c *APIClient) VoteOnCard(cardID string) error {
	resp, err := c.post(fmt.Sprintf("/api/cards/%s/vote", cardID), map[string]string{})
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("vote failed: %d - %s", resp.StatusCode, string(body))
	}

	return nil
}

// GroupCards groups multiple cards together
func (c *APIClient) GroupCards(boardID string, cardIDs []string, groupID string) error {
	payload := map[string]interface{}{
		"cardIds": cardIDs,
		"groupId": groupID,
	}

	resp, err := c.post(fmt.Sprintf("/api/boards/%s/cards/group", boardID), payload)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("group cards failed: %d - %s", resp.StatusCode, string(body))
	}

	return nil
}

// GroupCardOnto groups one card onto another
func (c *APIClient) GroupCardOnto(cardID, targetCardID string) error {
	payload := map[string]string{
		"targetCardId": targetCardID,
	}

	resp, err := c.post(fmt.Sprintf("/api/cards/%s/group-onto", cardID), payload)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("group card onto failed: %d - %s", resp.StatusCode, string(body))
	}

	return nil
}

// Helper methods for HTTP operations

func (c *APIClient) get(path string) (*http.Response, error) {
	req, err := http.NewRequest("GET", c.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	return c.httpClient.Do(req)
}

func (c *APIClient) post(path string, payload interface{}) (*http.Response, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return c.httpClient.Do(req)
}

func (c *APIClient) put(path string, payload interface{}) (*http.Response, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("PUT", c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return c.httpClient.Do(req)
}

func (c *APIClient) patch(path string, payload interface{}) (*http.Response, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("PATCH", c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return c.httpClient.Do(req)
}

func (c *APIClient) getSessionCookie() string {
	u, _ := url.Parse(c.baseURL)
	cookies := c.httpClient.Jar.Cookies(u)
	for _, cookie := range cookies {
		if cookie.Name == "session" {
			return cookie.Value
		}
	}
	return ""
}

// JoinBoard sends a join board action via SSE POST endpoint
func (c *APIClient) JoinBoard(clientID, boardID, userID string) error {
	payload := map[string]interface{}{
		"action":   "join_board",
		"clientId": clientID,
		"boardId":  boardID,
		"userId":   userID,
	}

	resp, err := c.post("/api/sse", payload)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("join board failed: %d - %s", resp.StatusCode, string(body))
	}

	return nil
}

// SetCookie manually sets a session cookie (useful for sharing sessions)
func (c *APIClient) SetCookie(cookieValue string) {
	u, _ := url.Parse(c.baseURL)
	c.httpClient.Jar.SetCookies(u, []*http.Cookie{
		{
			Name:  "session",
			Value: strings.TrimPrefix(cookieValue, "session="),
		},
	})
}
