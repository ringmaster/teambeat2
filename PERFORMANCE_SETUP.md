# Performance Monitoring Setup

The performance monitoring system has been successfully implemented according to METRICS.md.

## Quick Start

### 1. Database Migration

**SQLite:**
```bash
npm run db:push:sqlite
```

**PostgreSQL:**

Due to legacy CHECK constraints in older PostgreSQL schemas, `drizzle-kit push` may fail with "column 'id' is in a primary key" error. The schema is actually correct - you can verify with:

```bash
# Verify schema (all tables should exist)
psql $DATABASE_URL -c "\d metric_snapshots"
psql $DATABASE_URL -c "\d board_metrics"
psql $DATABASE_URL -c "\d slow_queries"
psql $DATABASE_URL -c "\d+ users" | grep is_admin
```

If tables don't exist, run this SQL directly:
```bash
psql $DATABASE_URL < src/lib/server/db/postgres-performance-tables.sql
```

The schema includes:
- `metric_snapshots` - System-wide metrics snapshots
- `board_metrics` - Per-board performance data
- `slow_queries` - Queries exceeding 100ms
- Added `is_admin` field to users table

### 2. Grant Admin Access

To access the performance dashboard, you need admin privileges. Update your user account:

**SQLite:**
```bash
sqlite3 teambeat.db "UPDATE users SET is_admin = 1 WHERE email = 'your@email.com';"
```

**PostgreSQL:**
```bash
psql $DATABASE_URL -c "UPDATE users SET is_admin = true WHERE email = 'your@email.com';"
```

### 3. Access Dashboard

Start the development server:
```bash
npm run dev
```

Navigate to: `http://localhost:5173/admin/performance`

## Features

### Real-time Metrics
- **System Overview**: Uptime, memory usage (heap & RSS)
- **SSE Connections**: Concurrent users, peak users, active connections
- **Broadcast Performance**: P50/P95/P99 latency percentiles
- **API Performance**: Request counts and response time percentiles

### Auto-refresh
- Dashboard auto-refreshes every 5 seconds
- Toggle on/off with checkbox

### Data Tables
- **Recent Broadcasts**: Last 20 broadcast events with timing
- **Slow Queries**: Database queries >100ms
- **API Requests**: Recent API calls with status codes

### Persistence
- Metrics saved to database every 1 minute
- 7-day retention (auto-cleanup)
- Time-series data with 1-hour retention

## API Endpoints

All endpoints require admin authentication:

- `GET /api/admin/performance` - Current metrics
- `GET /api/admin/performance/timeseries` - Time series data
- `GET /api/admin/performance/history?start=<timestamp>&end=<timestamp>` - Historical data
- `POST /api/admin/performance` with `{"action": "reset"}` - Reset counters

## Architecture

### Performance Tracker
Location: `src/lib/server/performance/tracker.ts`
- Singleton instance tracking all metrics
- In-memory storage with configurable limits
- Automatic percentile calculations

### Integration Points
1. **SSE Manager** (`src/lib/server/sse/manager.ts`)
   - Tracks connections/disconnections
   - Records broadcast duration and recipient count

2. **Request Hooks** (`src/hooks.server.ts`)
   - Tracks all API request performance
   - Captures method, path, status, duration

3. **Persistence** (`src/lib/server/performance/persistence.ts`)
   - Auto-saves snapshots every minute
   - Cleans up data older than 7 days

## Monitoring Best Practices

### What to Watch
- **Concurrent Users**: Baseline vs peak usage
- **Broadcast P99**: Should stay <100ms for good UX
- **API P95**: Should stay <500ms
- **Slow Queries**: Investigate any >500ms

### Performance Targets
- SSE broadcast latency: <50ms (P95)
- API response time: <300ms (P95)
- Memory growth: Monitor for leaks
- Connection count: Plan capacity

## Troubleshooting

### Dashboard Shows 403 Error
- Ensure your user has `is_admin = true` in database
- Log out and log back in to refresh session

### No Metrics Showing
- Ensure application has been running with some activity
- Check browser console for errors
- Verify API endpoints return 200 status

### High Memory Usage
- Check metric retention settings in tracker.ts
- Review MAX_BROADCAST_SAMPLES and MAX_SLOW_QUERIES
- Consider reducing TIME_SERIES_RETENTION

## Future Enhancements

See METRICS.md for migration path to OpenTelemetry and additional monitoring capabilities.
