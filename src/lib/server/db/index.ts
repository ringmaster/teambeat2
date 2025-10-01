import Database from 'better-sqlite3';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

// Use DATABASE_URL environment variable, fallback to development database
const databaseUrl = process.env.DATABASE_URL || './teambeat.db';

// Detect database type from connection string
const isPostgres = databaseUrl.startsWith('postgres://') ||
  databaseUrl.startsWith('postgresql://');

// Create appropriate connection
let connection: Database.Database | postgres.Sql;
if (isPostgres) {
  connection = postgres(databaseUrl);
} else {
  // Handle file:// prefix if present
  const dbPath = databaseUrl.replace(/^file:\/\//, '');
  connection = new Database(dbPath);
  connection.pragma('journal_mode = WAL');
}

// Export database instance with appropriate driver
export const db = isPostgres
  ? drizzlePostgres(connection as postgres.Sql, { schema })
  : drizzleSqlite(connection as Database.Database, { schema });

// Export database capabilities for conditional logic
export const dbSupportsAsyncTransactions = isPostgres;
export const dbRequiresManualClose = !isPostgres;

// Export for cleanup/shutdown if needed
export const closeDatabase = () => {
  if (dbRequiresManualClose) {
    (connection as Database.Database).close();
  } else {
    // Connection will close when process exits
    // Can call (connection as postgres.Sql).end() if needed for graceful shutdown
  }
};
