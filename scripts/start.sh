#!/bin/sh

# TeamBeat Application Startup Script
# This script starts the SvelteKit application
# For deployments with pre-deploy migrations (e.g., Digital Ocean), set SKIP_MIGRATION=true
# For standalone Docker deployments, migrations run automatically unless SKIP_MIGRATION=true

set -e  # Exit on any error

echo "Starting TeamBeat application..."

# Set database URL if not already set
export DATABASE_URL=${DATABASE_URL:-"/db/teambeat.db"}

echo "Using database: $DATABASE_URL"

# Check if we should run migrations (default: yes, unless SKIP_MIGRATION=true)
if [ "$SKIP_MIGRATION" != "true" ]; then
    echo "Running database migration..."

    if [ -f "./scripts/migrate.sh" ]; then
        ./scripts/migrate.sh
    else
        echo "⚠️  WARNING: migrate.sh not found, skipping migration"
    fi
else
    echo "⏭️  Skipping migration (SKIP_MIGRATION=true)"
fi

# SQLite-specific: Ensure proper database permissions
if echo "$DATABASE_URL" | grep -q -v "^postgres"; then
    if [ -f "$DATABASE_URL" ]; then
        chmod 644 "$DATABASE_URL" 2>/dev/null || true
        echo "Database file permissions set"
    fi
fi

# Start the application
echo "🚀 Starting SvelteKit application on port ${PORT:-3000}..."
exec node build/index.js
