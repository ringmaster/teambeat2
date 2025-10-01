#!/bin/sh

# TeamBeat Application Startup Script
# This script handles database initialization and starts the SvelteKit application

set -e  # Exit on any error

echo "Starting TeamBeat application..."

# Set database URL if not already set
export DATABASE_URL=${DATABASE_URL:-"/db/teambeat.db"}

echo "Using database: $DATABASE_URL"

# Detect database type from URL
if echo "$DATABASE_URL" | grep -q "^postgres"; then
    DB_TYPE="postgres"
    DRIZZLE_CONFIG="drizzle.config.postgres.ts"
    echo "Detected PostgreSQL database"
else
    DB_TYPE="sqlite"
    DRIZZLE_CONFIG="drizzle.config.sqlite.ts"
    echo "Detected SQLite database"

    # SQLite-specific setup
    if [ ! -d "/db" ]; then
        echo "ERROR: Database directory /db does not exist"
        exit 1
    fi

    if [ ! -w "/db" ]; then
        echo "ERROR: Database directory /db is not writable"
        exit 1
    fi
fi

# Run database migrations if needed
echo "Checking for database migrations..."
if [ -f "$DRIZZLE_CONFIG" ] && [ -d "drizzle" ]; then
    echo "Running database migrations with config: $DRIZZLE_CONFIG"

    # Run migrations with proper error handling
    if npx drizzle-kit migrate --config="$DRIZZLE_CONFIG"; then
        echo "✅ Database migrations completed successfully"
    else
        echo "❌ Database migration failed"

        # SQLite-specific recovery
        if [ "$DB_TYPE" = "sqlite" ]; then
            echo "Checking if database file exists..."

            # Create database file if it doesn't exist
            if [ ! -f "$DATABASE_URL" ]; then
                echo "Creating database file..."
                touch "$DATABASE_URL"
            fi

            # Try migration again
            echo "Retrying migration..."
            if npx drizzle-kit migrate --config="$DRIZZLE_CONFIG"; then
                echo "✅ Database migrations completed on retry"
            else
                echo "❌ Database migration failed on retry - continuing anyway"
                echo "The application will create tables on first use if needed"
            fi
        else
            echo "❌ PostgreSQL migration failed - exiting"
            exit 1
        fi
    fi
else
    echo "❌ Migration files not found"
    echo "Contents of current directory:"
    ls -la
    echo "Contents of drizzle directory:"
    ls -la drizzle/ || echo "Drizzle directory not found"
    exit 1
fi

# SQLite-specific: Ensure proper database permissions
if [ "$DB_TYPE" = "sqlite" ] && [ -f "$DATABASE_URL" ]; then
    chmod 644 "$DATABASE_URL"
    echo "Database file permissions set"
fi

# Start the application
echo "🚀 Starting SvelteKit application on port ${PORT:-3000}..."
exec node build/index.js
