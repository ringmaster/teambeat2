import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index.js';
import { users } from '$lib/server/db/schema.js';

export const GET: RequestHandler = async () => {
  try {
    // Test database connectivity with a simple query using Drizzle
    const result = db.select().from(users).limit(1).all();

    // If we can query the users table, the database is accessible
    return json({
      success: true,
      status: 'healthy',
      database: {
        connected: true,
        status: 'operational',
        tables_accessible: true
      },
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: '1.0.0'
    });

  } catch (error) {
    console.error('Health check failed:', error);

    return json(
      {
        success: false,
        status: 'unhealthy',
        database: {
          connected: false,
          status: 'error',
          tables_accessible: false
        },
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown database error'
      },
      { status: 503 }
    );
  }
};
