import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

// Use different database files based on environment
const getDatabasePath = () => {
  const nodeEnv = process.env.NODE_ENV;

  if (nodeEnv === 'test') {
    return 'teambeat-test.db';
  } else if (nodeEnv === 'development') {
    return 'teambeat.db';
  } else {
    return process.env.DATABASE_PATH || 'teambeat.db';
  }
};

const sqlite = new Database(getDatabasePath());
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });
