#!/bin/sh

# TeamBeat Application Startup Script
# This script handles database initialization and starts the SvelteKit application

set -e  # Exit on any error

echo "Starting TeamBeat application..."

# Check if database directory exists and is writable
if [ ! -d "/db" ]; then
    echo "ERROR: Database directory /db does not exist"
    exit 1
fi

if [ ! -w "/db" ]; then
    echo "ERROR: Database directory /db is not writable"
    exit 1
fi

# Set database URL if not already set
export DATABASE_URL=${DATABASE_URL:-"/db/teambeat.db"}

echo "Using database: $DATABASE_URL"

# Run database migrations if needed
echo "Checking for database migrations..."
if [ -f "drizzle.config.ts" ] && [ -d "drizzle" ]; then
    echo "Running database migrations..."

    # Set the DATABASE_URL for the migration command
    export DATABASE_URL="$DATABASE_URL"

    # Run migrations with proper error handling
    if npx drizzle-kit migrate; then
        echo "✅ Database migrations completed successfully"
    else
        echo "❌ Database migration failed, checking if database exists..."

        # Create database file if it doesn't exist
        if [ ! -f "$DATABASE_URL" ]; then
            echo "Creating database file..."
            touch "$DATABASE_URL"
        fi

        # Try migration again
        echo "Retrying migration..."
        if npx drizzle-kit migrate; then
            echo "✅ Database migrations completed on retry"
        else
            echo "❌ Database migration failed on retry - continuing anyway"
            echo "The application will create tables on first use if needed"
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

# Ensure proper database permissions
if [ -f "$DATABASE_URL" ]; then
    chmod 644 "$DATABASE_URL"
    echo "Database file permissions set"
fi

# Start the application
echo "🚀 Starting SvelteKit application on port ${PORT:-3000}..."
exec node build/index.js
