import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle/postgres',
  schema: './src/lib/server/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost/teambeat',
  },
});
