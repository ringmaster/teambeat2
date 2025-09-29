import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

// Use DATABASE_URL environment variable, fallback to development database
const databaseUrl = process.env.DATABASE_URL || './teambeat.db';



const sqlite = new Database(databaseUrl);
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });
