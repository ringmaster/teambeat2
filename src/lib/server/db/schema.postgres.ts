/**
 * PostgreSQL-specific schema export for Drizzle Kit
 * This file is used by drizzle.config.postgres.ts for migrations
 */

// Re-export everything from the main schema
// The main schema will use PostgreSQL types when DATABASE_URL is set
export * from "./schema.ts";
