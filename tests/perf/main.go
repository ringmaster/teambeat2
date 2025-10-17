package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"
)

func main() {
	// Parse command-line flags
	config := &Config{}
	flag.StringVar(&config.BaseURL, "url", "http://localhost:5173", "Base URL of the server")
	flag.IntVar(&config.ConcurrentUsers, "users", 45, "Number of concurrent users")
	flag.DurationVar(&config.TestDuration, "duration", 5*time.Minute, "Test duration")
	flag.IntVar(&config.RequestsPerMin, "rpm", 30, "Requests per minute (throttles API calls across all users)")
	flag.DurationVar(&config.GracePeriod, "grace", 5*time.Second, "Grace period for pending events")
	flag.StringVar(&config.AdminEmail, "admin-email", "", "Admin account email (default: auto-generated)")
	flag.BoolVar(&config.Verbose, "verbose", false, "Enable verbose logging")
	flag.BoolVar(&config.Debug, "debug", false, "Enable debug logging (shows API requests/responses)")
	flag.Parse()

	// Generate unique admin credentials using timestamp
	timestamp := time.Now().Unix()
	if config.AdminEmail == "" {
		config.AdminEmail = fmt.Sprintf("admin%d@loadtest.local", timestamp)
	}
	config.AdminPassword = fmt.Sprintf("TestPass%d!", timestamp)

	// Print banner
	PrintBanner("🚀 TeamBeat SSE Load Test")
	PrintConfig(config)

	// Run the load test
	if err := runLoadTest(config); err != nil {
		log.Fatalf("Load test failed: %v", err)
	}
}

func runLoadTest(config *Config) error {
	correlator := NewEventCorrelator(config.Verbose)
	var users []*UserSimulator
	var connectedUsers int
	var failedConnections int

	// Setup signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// Setup admin and board
	// Small delay to avoid hitting rate limits from previous test runs
	fmt.Println("\n⏳ Waiting 2 seconds to avoid rate limits...")
	time.Sleep(2 * time.Second)

	PrintSetupProgress("⚙", "Creating admin account")
	adminAPI := NewAPIClient(config.BaseURL, config.Debug)
	cookie, err := adminAPI.Register(config.AdminEmail, "Admin User", config.AdminPassword)
	if err != nil {
		if config.Verbose {
			fmt.Printf("Registration failed: %v\n", err)
		}
		// Check for rate limit errors
		if strings.Contains(err.Error(), "429") || strings.Contains(err.Error(), "Too many requests") {
			fmt.Println("\n" + strings.Repeat("═", 70))
			fmt.Println("⚠️  RATE LIMIT DETECTED")
			fmt.Println(strings.Repeat("═", 70))
			fmt.Println("\nThe server is rate limiting requests. To run load tests, you need to")
			fmt.Println("disable rate limiting by setting an environment variable:")
			fmt.Println("\n  DISABLE_RATE_LIMITING=true npm run dev")
			fmt.Println("\nOr if running in production mode:")
			fmt.Println("\n  DISABLE_RATE_LIMITING=true node build")
			fmt.Println("\n" + strings.Repeat("═", 70))
			return fmt.Errorf("rate limit detected - set DISABLE_RATE_LIMITING=true on the server")
		}
		return fmt.Errorf("admin registration failed: %w", err)
	}

	// Verify we got a session cookie
	if cookie == "" {
		return fmt.Errorf("no session cookie received from registration")
	}

	PrintSetupProgress("✓", "Admin registered and authenticated")

	PrintSetupProgress("✓", "Creating test series")
	timestamp := time.Now().Format("20060102_150405")
	seriesName := fmt.Sprintf("Load Test Series %s", timestamp)
	series, err := adminAPI.CreateSeries(seriesName, "Series for load testing")
	if err != nil {
		// Try to get existing series
		allSeries, err := adminAPI.GetSeries()
		if err != nil || len(allSeries) == 0 {
			return fmt.Errorf("failed to create or get series: %w", err)
		}
		series = &allSeries[0]
		PrintSetupProgress("ℹ", fmt.Sprintf("Using existing series: %s", series.ID))
	}

	PrintSetupProgress("✓", "Creating test board")
	boardName := fmt.Sprintf("Load Test Board %s", timestamp)
	board, err := adminAPI.CreateBoard(boardName, series.ID)
	if err != nil {
		return fmt.Errorf("failed to create board: %w", err)
	}
	boardID := board.ID

	PrintSetupProgress("✓", "Setting up board template")
	if err := adminAPI.SetupBoardTemplate(boardID, "basic"); err != nil {
		return fmt.Errorf("failed to setup board template: %w", err)
	}

	PrintSetupProgress("✓", "Activating board")
	if err := adminAPI.UpdateBoard(boardID, map[string]interface{}{"status": "active"}); err != nil {
		PrintWarning("Setup", "Failed to activate board, continuing anyway")
	}

	// Get board state with columns
	board, err = adminAPI.GetBoard(boardID)
	if err != nil {
		return fmt.Errorf("failed to get board state: %w", err)
	}

	var columnIDs []string
	for _, col := range board.Columns {
		columnIDs = append(columnIDs, col.ID)
	}

	if len(columnIDs) == 0 {
		return fmt.Errorf("no columns found in board")
	}

	PrintSetupProgress("✓", fmt.Sprintf("Found %d columns", len(columnIDs)))

	// Update scene permissions for testing - always force all permissions
	if board.CurrentSceneID != "" {
		var currentScene *Scene
		for _, scene := range board.Scenes {
			if scene.ID == board.CurrentSceneID {
				currentScene = &scene
				break
			}
		}

		if currentScene != nil {
			PrintSetupProgress("ℹ", fmt.Sprintf("Current scene: %s (%s)", currentScene.Title, currentScene.Mode))
			PrintSetupProgress("⚙", "Ensuring all scene permissions enabled for testing")

			// Scene permissions are stored as flags in an array
			flags := []string{
				"allow_add_cards",
				"allow_edit_cards",
				"allow_move_cards",
				"allow_group_cards",
				"allow_voting",
				"show_votes",
				"allow_comments",
				"show_comments",
			}

			err := adminAPI.UpdateScene(boardID, currentScene.ID, map[string]interface{}{
				"flags": flags,
			})
			if err != nil {
				return fmt.Errorf("failed to update scene permissions: %w", err)
			}

			PrintSetupProgress("✓", "Scene permissions enabled")

			// Verify permissions were set by re-fetching board
			board, err = adminAPI.GetBoard(boardID)
			if err != nil {
				return fmt.Errorf("failed to verify board state: %w", err)
			}

			if config.Verbose {
				fmt.Printf("DEBUG: Re-fetched board, currentSceneID: %s\n", board.CurrentSceneID)
				fmt.Printf("DEBUG: Number of scenes: %d\n", len(board.Scenes))
				for i, scene := range board.Scenes {
					fmt.Printf("DEBUG: Scene %d: ID=%s, Title=%s, Flags=%v\n",
						i, scene.ID, scene.Title, scene.Flags)
				}
			}

			// Verify the scene has the required flags
			for _, scene := range board.Scenes {
				if scene.ID == board.CurrentSceneID {
					hasAddCards := scene.HasFlag("allow_add_cards")
					hasMoveCards := scene.HasFlag("allow_move_cards")
					hasGroupCards := scene.HasFlag("allow_group_cards")
					hasVoting := scene.HasFlag("allow_voting")

					if !hasAddCards || !hasMoveCards || !hasGroupCards || !hasVoting {
						return fmt.Errorf("scene permissions not properly set: add=%v move=%v group=%v vote=%v (flags=%v)",
							hasAddCards, hasMoveCards, hasGroupCards, hasVoting, scene.Flags)
					}
					PrintSetupProgress("✓", "Scene permissions verified")
					break
				}
			}
		} else {
			PrintWarning("Setup", "No current scene found - permissions may be restricted")
		}
	} else {
		PrintWarning("Setup", "No current scene ID - permissions may be restricted")
	}

	// Print board URL
	PrintBoardURL(config.BaseURL, boardID)
	fmt.Println("⏳ Starting user connections in 3 seconds...\n")
	time.Sleep(3 * time.Second)

	// Create global rate limiter (requests per minute across all users)
	requestInterval := time.Duration(60.0/float64(config.RequestsPerMin)*1000) * time.Millisecond
	rateLimiter := time.NewTicker(requestInterval)
	defer rateLimiter.Stop()

	// Spawn users
	fmt.Printf("\nSpawning %d users...\n", config.ConcurrentUsers)

	var wg sync.WaitGroup
	stopChan := make(chan bool)

	for i := 1; i <= config.ConcurrentUsers; i++ {
		user := NewUserSimulator(i, boardID, columnIDs, correlator, config)

		if err := user.Setup(); err != nil {
			// Check for rate limit errors
			if strings.Contains(err.Error(), "429") || strings.Contains(err.Error(), "Too many requests") {
				fmt.Println("\n" + strings.Repeat("═", 70))
				fmt.Println("⚠️  RATE LIMIT DETECTED DURING USER SPAWNING")
				fmt.Println(strings.Repeat("═", 70))
				fmt.Println("\nThe server is rate limiting requests. To run load tests, you need to")
				fmt.Println("disable rate limiting by setting an environment variable:")
				fmt.Println("\n  DISABLE_RATE_LIMITING=true npm run dev")
				fmt.Println("\nOr if running in production mode:")
				fmt.Println("\n  DISABLE_RATE_LIMITING=true node build")
				fmt.Println("\n" + strings.Repeat("═", 70))
				return fmt.Errorf("rate limit detected - set DISABLE_RATE_LIMITING=true on the server")
			}
			PrintError("Spawn", fmt.Sprintf("User %d setup failed: %v", i, err))
			failedConnections++
			continue
		}

		// Add user to series (admin API call required)
		if err := adminAPI.AddUserToSeries(series.ID, user.ctx.Email, "member"); err != nil {
			PrintError("Spawn", fmt.Sprintf("User %d add to series failed: %v", i, err))
			failedConnections++
			user.Stop()
			continue
		}

		users = append(users, user)
		connectedUsers++

		// Update correlator with current connected user count
		correlator.SetConnectedUsers(connectedUsers)

		// Start user activity in background
		wg.Add(1)
		go func(u *UserSimulator) {
			defer wg.Done()
			u.Start(stopChan, rateLimiter.C)
		}(user)

		PrintSuccess("Spawn", fmt.Sprintf("User %d/%d connected", i, config.ConcurrentUsers))

		// Stagger connections
		time.Sleep(100 * time.Millisecond)
	}

	fmt.Printf("\n✓ Connected %d/%d users\n", connectedUsers, config.ConcurrentUsers)
	if failedConnections > 0 {
		fmt.Printf("✗ %d connection failures\n", failedConnections)
	}

	// Start monitoring
	fmt.Println("\n🔍 Starting monitoring...\n")

	// Track actual test start time (after all setup is complete)
	testStartTime := time.Now()

	monitorTicker := time.NewTicker(10 * time.Second)
	defer monitorTicker.Stop()

	testTimer := time.NewTimer(config.TestDuration)
	defer testTimer.Stop()

	monitoringActive := true

	// Monitoring loop
	go func() {
		for monitoringActive {
			select {
			case <-monitorTicker.C:
				elapsed := time.Since(testStartTime)
				activeUsers := 0
				for _, u := range users {
					if u.IsConnected() {
						activeUsers++
					}
				}

				sent, received := correlator.GetStats()
				rate := float64(sent) / elapsed.Seconds()

				PrintMonitoringStats(elapsed, activeUsers, connectedUsers, sent, received, rate)

			case <-testTimer.C:
				return
			case <-sigChan:
				return
			}
		}
	}()

	// Wait for test duration or interrupt
	select {
	case <-testTimer.C:
		fmt.Println("\n⏱ Test duration completed")
	case <-sigChan:
		fmt.Println("\n\n⏹ Interrupted by user")
	}

	monitoringActive = false

	// Capture test end time (before grace period)
	testEndTime := time.Now()

	// Stop all users
	fmt.Println("\n[Cleanup] Stopping event generation...")
	close(stopChan)

	// Grace period
	fmt.Printf("[Cleanup] Grace period: waiting %v for pending events...\n", config.GracePeriod)
	time.Sleep(config.GracePeriod)

	// Disconnect all users
	fmt.Println("[Cleanup] Disconnecting users...")
	for _, user := range users {
		user.Stop()
	}

	// Wait for all goroutines to finish
	wg.Wait()

	// Generate and print final report
	result := correlator.GenerateReport(connectedUsers)
	result.ConnectedUsers = connectedUsers
	result.TotalUsers = config.ConcurrentUsers
	result.Duration = testEndTime.Sub(testStartTime) // Actual test duration excluding setup and grace period
	result.ConnectionStability = &ConnectionStats{
		FailedConns: failedConnections,
	}

	PrintFinalReport(result, config)

	return nil
}
