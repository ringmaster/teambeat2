#!/bin/sh

# TeamBeat Database Migration Script
# This script can be run as a pre-deploy job or manually in a Docker container

set -e  # Exit on any error

echo "🔄 Starting database migration..."

# Set database URL if not already set
export DATABASE_URL=${DATABASE_URL:-"/db/teambeat.db"}

echo "Using database: $DATABASE_URL"

# Detect database type from URL
if echo "$DATABASE_URL" | grep -q "^postgres"; then
    DB_TYPE="postgres"
    DRIZZLE_CONFIG="drizzle.config.postgres.ts"
    echo "✓ Detected PostgreSQL database"
else
    DB_TYPE="sqlite"
    DRIZZLE_CONFIG="drizzle.config.sqlite.ts"
    echo "✓ Detected SQLite database"

    # SQLite-specific setup
    if [ ! -d "./db" ]; then
        echo "⚠️  WARNING: Database directory ./db does not exist, creating it..."
        mkdir -p ./db
    fi

    if [ ! -w "./db" ]; then
        echo "❌ ERROR: Database directory ./db is not writable"
        exit 1
    fi
fi

# Verify migration files exist
if [ ! -f "$DRIZZLE_CONFIG" ]; then
    echo "❌ ERROR: Drizzle config not found: $DRIZZLE_CONFIG"
    exit 1
fi

if [ ! -d "drizzle" ]; then
    echo "❌ ERROR: Migration directory 'drizzle' not found"
    exit 1
fi

# Run migrations
echo "Running migrations with config: $DRIZZLE_CONFIG"

if npx drizzle-kit migrate --config="$DRIZZLE_CONFIG"; then
    echo "✅ Database migrations completed successfully"
    exit 0
else
    echo "❌ Database migration failed"

    # SQLite-specific recovery attempt
    if [ "$DB_TYPE" = "sqlite" ]; then
        echo "Attempting SQLite recovery..."

        # Create database file if it doesn't exist
        if [ ! -f "$DATABASE_URL" ]; then
            echo "Creating database file..."
            touch "$DATABASE_URL"
        fi

        # Try migration again
        echo "Retrying migration..."
        if npx drizzle-kit migrate --config="$DRIZZLE_CONFIG"; then
            echo "✅ Database migrations completed on retry"
            exit 0
        fi
    fi

    # For PostgreSQL, fail immediately
    if [ "$DB_TYPE" = "postgres" ]; then
        echo "❌ PostgreSQL migration failed - exiting"
        exit 1
    fi

    echo "❌ Migration failed after retry"
    exit 1
fi
