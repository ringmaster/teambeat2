package main

import (
	"fmt"
	"strings"
	"time"
)

// PrintBanner prints a formatted banner
func PrintBanner(title string) {
	banner := strings.Repeat("═", 70)
	fmt.Println(banner)
	fmt.Println(title)
	fmt.Println(banner)
}

// PrintConfig prints the test configuration
func PrintConfig(config *Config) {
	fmt.Println("\nConfiguration:")
	fmt.Printf("  Base URL: %s\n", config.BaseURL)
	fmt.Printf("  Concurrent Users: %d\n", config.ConcurrentUsers)
	fmt.Printf("  Test Duration: %v\n", config.TestDuration)
	fmt.Printf("  Rate Limit: %d requests/min\n", config.RequestsPerMin)
	fmt.Printf("  Grace Period: %v\n", config.GracePeriod)
	PrintBanner("")
}

// PrintBoardURL prints the board URL prominently
func PrintBoardURL(baseURL, boardID string) {
	boardURL := fmt.Sprintf("%s/board/%s", baseURL, boardID)
	fmt.Println()
	fmt.Println(strings.Repeat("═", 70))
	fmt.Println(strings.Repeat("═", 70))
	fmt.Println()
	fmt.Println("   🔗 OPEN THIS URL IN YOUR BROWSER TO WATCH THE TEST:")
	fmt.Println()
	fmt.Printf("   %s\n", boardURL)
	fmt.Println()
	fmt.Println(strings.Repeat("═", 70))
	fmt.Println(strings.Repeat("═", 70))
	fmt.Println()
}

// PrintSetupProgress prints setup progress messages
func PrintSetupProgress(step, message string) {
	fmt.Printf("[Setup] %s... %s\n", message, step)
}

// PrintMonitoringStats prints real-time monitoring statistics
func PrintMonitoringStats(elapsed time.Duration, activeUsers, totalUsers, eventsSent, eventsReceived int, rate float64) {
	fmt.Printf("[%3ds] Active: %d/%d | Events sent: %d | Events received: %d | Rate: %.1f/s\n",
		int(elapsed.Seconds()), activeUsers, totalUsers, eventsSent, eventsReceived, rate)
}

// PrintFinalReport prints the final test report
func PrintFinalReport(result *TestResult, config *Config) {
	fmt.Println()
	PrintBanner("📊 LOAD TEST RESULTS")
	fmt.Println()

	// Overall stats (duration already set in main)
	fmt.Printf("Test Duration: %v\n", result.Duration)
	fmt.Printf("Connected Users: %d/%d (%.1f%%)\n",
		result.ConnectedUsers, result.TotalUsers,
		float64(result.ConnectedUsers)/float64(result.TotalUsers)*100.0)
	fmt.Printf("Total Events Sent: %d\n", result.EventsSent)

	// Display expected and received events
	fmt.Printf("Total Events Expected: %d (based on connected users at send time)\n",
		result.EventsExpected)
	deliveryRate := 0.0
	if result.EventsExpected > 0 {
		deliveryRate = float64(result.EventsReceived) / float64(result.EventsExpected) * 100.0
	}
	fmt.Printf("Total Events Received: %d (%.2f%%)\n",
		result.EventsReceived, deliveryRate)

	// Per-type statistics
	fmt.Println("\nEvent Delivery by Type:")
	for eventType, stats := range result.ByType {
		fmt.Printf("  %-20s %d sent → %d expected → %d received (%.2f%%)\n",
			eventType+":", stats.Sent, stats.Expected, stats.Received, stats.Rate)
		if stats.Missed > 0 {
			fmt.Printf("    ⚠️ Missed events: %d\n", stats.Missed)
		}
	}

	// Latency statistics
	if result.LatencyStats != nil && result.LatencyStats.Count > 0 {
		fmt.Println("\nLatency Statistics (SSE event delivery):")
		fmt.Printf("  Mean: %v\n", result.LatencyStats.Mean)
		fmt.Printf("  P50:  %v\n", result.LatencyStats.P50)
		fmt.Printf("  P90:  %v\n", result.LatencyStats.P90)
		fmt.Printf("  P95:  %v\n", result.LatencyStats.P95)
		fmt.Printf("  P99:  %v\n", result.LatencyStats.P99)
		fmt.Printf("  Max:  %v\n", result.LatencyStats.Max)
	}

	// Operation rate
	result.MessageRate = float64(result.EventsSent) / result.Duration.Seconds()
	operationRatePerMin := result.MessageRate * 60.0
	fmt.Printf("\nOperation Rate: %.1f requests/min (%.1f requests/sec)\n", operationRatePerMin, result.MessageRate)

	// Connection stability
	if result.ConnectionStability != nil {
		fmt.Println("\nConnection Stability:")
		fmt.Printf("  Failed connections: %d\n", result.ConnectionStability.FailedConns)
		if result.ConnectionStability.Disconnections > 0 {
			fmt.Printf("  Total disconnections: %d\n", result.ConnectionStability.Disconnections)
			fmt.Printf("  Total reconnections: %d\n", result.ConnectionStability.Reconnections)
		}
	}

	// Final result
	fmt.Println()
	// deliveryRate already calculated above, just check the thresholds
	if deliveryRate >= 99.9 {
		fmt.Printf("Result: ✓ PASS (%.2f%% delivery rate)\n", deliveryRate)
	} else if deliveryRate >= 99.0 {
		fmt.Printf("Result: ⚠ WARN (%.2f%% delivery rate)\n", deliveryRate)
	} else {
		fmt.Printf("Result: ✗ FAIL (%.2f%% delivery rate)\n", deliveryRate)
	}

	PrintBanner("")
}

// FormatDuration formats a duration in a human-readable way
func FormatDuration(d time.Duration) string {
	if d < time.Millisecond {
		return fmt.Sprintf("%dµs", d.Microseconds())
	}
	if d < time.Second {
		return fmt.Sprintf("%dms", d.Milliseconds())
	}
	return fmt.Sprintf("%.1fs", d.Seconds())
}

// PrintError prints an error message
func PrintError(context, message string) {
	fmt.Printf("❌ [%s] %s\n", context, message)
}

// PrintWarning prints a warning message
func PrintWarning(context, message string) {
	fmt.Printf("⚠️ [%s] %s\n", context, message)
}

// PrintSuccess prints a success message
func PrintSuccess(context, message string) {
	fmt.Printf("✓ [%s] %s\n", context, message)
}

// PrintInfo prints an info message
func PrintInfo(context, message string) {
	fmt.Printf("ℹ [%s] %s\n", context, message)
}
