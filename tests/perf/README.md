# TeamBeat SSE Load Test

A comprehensive load testing tool for TeamBeat that validates Server-Sent Events (SSE) delivery reliability under concurrent load.

## Overview

This load test simulates multiple concurrent users connected to a TeamBeat board, performing various card operations (create, move, vote, group) and tracking whether all SSE events are properly delivered to all connected clients.

## Features

- **Concurrent User Simulation**: Simulates multiple users with persistent SSE connections
- **Comprehensive Event Tracking**: Tracks all events sent and correlates them with received SSE events
- **Latency Measurement**: Calculates P50/P90/P95/P99 latencies for event delivery
- **Automatic Board Setup**: Creates test board, registers users, and configures permissions
- **Real-time Monitoring**: Shows progress during test execution
- **Detailed Reporting**: Generates comprehensive statistics on event delivery success

## Installation

```bash
cd tests/perf
go build
```

This creates a `perf` executable (or `perf.exe` on Windows).

## Usage

### Basic Usage

```bash
# Default test: 45 users, 5 minutes, http://localhost:5173
./perf
```

### Custom Configuration

```bash
# Custom number of users and duration
./perf -users 100 -duration 10m

# Test against different server
./perf -url https://teambeat.example.com -users 50

# Quick test
./perf -users 10 -duration 30s

# Verbose output
./perf -verbose
```

### Command-Line Flags

- `-url` (string): Base URL of the server (default: "http://localhost:5173")
- `-users` (int): Number of concurrent users (default: 45)
- `-duration` (duration): How long to run test (default: 5m)
- `-rate` (duration): Time between actions per user (default: 2s)
- `-grace` (duration): Grace period to wait for pending events (default: 5s)
- `-admin-email` (string): Admin account email (default: "admin@loadtest.local")
- `-verbose` (bool): Enable verbose logging (default: false)

### Duration Format

Durations can be specified with units:
- `30s` - 30 seconds
- `5m` - 5 minutes
- `1h` - 1 hour
- `90s` - 90 seconds (1.5 minutes)

## How It Works

### Test Flow

1. **Setup Phase**
   - Creates admin account
   - Creates test series and board
   - Sets up board template with columns
   - Configures scene permissions for testing

2. **User Spawn Phase**
   - Registers user accounts (testuser1_timestamp, testuser2_timestamp, etc.)
   - Establishes SSE connections for each user
   - Joins users to the test board

3. **Activity Phase**
   - Each user performs random actions at specified rate:
     - Create card (40% probability)
     - Move card (20% probability)
     - Vote on card (20% probability)
     - Group cards (10% probability)
     - Group card onto another (10% probability)
   - All actions are tracked and correlated with SSE events

4. **Grace Period**
   - Stops sending new events
   - Waits for outstanding SSE messages to arrive

5. **Reporting Phase**
   - Generates comprehensive statistics
   - Calculates delivery rates and latencies
   - Reports success/failure based on delivery rate

### Event Correlation

The test tracks every event sent and correlates it with events received:

- **Sent Event**: When a user performs an action (create/move/vote/group)
- **Expected Receivers**: All users except the sender
- **Received Events**: SSE events received by each user
- **Latency**: Time between action and SSE receipt

### Success Criteria

- **PASS**: ≥99.9% of events received by all expected users
- **WARN**: 99.0-99.9% delivery rate
- **FAIL**: <99.0% delivery rate

## Output

### Real-time Monitoring

During the test, you'll see periodic updates:

```
[10s] Active: 45/45 | Events sent: 220 | Events received: 9460 | Rate: 22.0/s
[20s] Active: 45/45 | Events sent: 440 | Events received: 18920 | Rate: 22.0/s
```

### Final Report

After completion, you'll see detailed statistics:

```
═══════════════════════════════════════════════════════════════════
📊 LOAD TEST RESULTS
═══════════════════════════════════════════════════════════════════

Test Duration: 5m2s
Connected Users: 45/45 (100.0%)
Total Events Sent: 6600
Total Events Expected: 290400 (6600 × 44 users)
Total Events Received: 290250 (99.95%)

Event Delivery by Type:
  card_created:        2640 sent → 116160 expected → 116150 received (99.99%)
  card_updated:        1320 sent → 58080 expected → 58075 received (99.99%)
  vote_changed:        1320 sent → 58080 expected → 58040 received (99.93%)
  cards_grouped:       660 sent → 29040 expected → 29035 received (99.98%)
  card_grouped_onto:   660 sent → 29040 expected → 28950 received (99.69%)

Latency Statistics (SSE event delivery):
  Mean: 45ms
  P50:  38ms
  P90:  72ms
  P95:  89ms
  P99:  125ms
  Max:  340ms

Message Rate: 22.0 events/second

Connection Stability:
  Failed connections: 0

Result: ✓ PASS (99.95% delivery rate)
═══════════════════════════════════════════════════════════════════
```

## Troubleshooting

### All Users Fail to Connect

- Ensure the server is running at the specified URL
- Check that the server accepts registration/login requests
- Verify CORS settings if testing against remote server

### Low Delivery Rate

- Check server logs for SSE connection issues
- Verify server can handle the concurrent load
- Increase grace period if events are slow to arrive: `-grace 10s`

### High Latencies

- May indicate server performance issues under load
- Check server resource usage (CPU, memory, database)
- Consider reducing concurrent users or action rate

### Connection Failures During Test

- Indicates SSE connections are dropping
- Check server timeout settings
- Look for network issues or firewall rules

## Development

### Building

```bash
go build
```

### Running Without Building

```bash
go run .
```

### Adding New Event Types

1. Add event type to correlation logic in `correlator.go`
2. Add action method in `user.go`
3. Update weighted activities in `user.go:performRandomAction()`

## Architecture

- **main.go**: CLI entry point and test coordinator
- **types.go**: Shared data structures
- **api.go**: HTTP client for TeamBeat API
- **sse.go**: SSE connection handling
- **correlator.go**: Event tracking and correlation
- **stats.go**: Statistics calculation and reporting
- **user.go**: User simulator with activity logic

## License

Same as TeamBeat project.
