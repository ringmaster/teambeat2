/**
 * GET /api/admin/performance/timeseries - Time series data for charts
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { performanceTracker } from '$lib/server/performance/tracker';
import { getSessionFromCookie } from '$lib/server/repositories/session';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

async function requireAdmin(cookies: any) {
	const sessionCookie = cookies.get('session');
	if (!sessionCookie) {
		throw error(401, 'Unauthorized');
	}

	const session = await getSessionFromCookie(sessionCookie);
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const [user] = await db
		.select({ isAdmin: users.is_admin })
		.from(users)
		.where(eq(users.id, session.userId))
		.limit(1);

	if (!user?.isAdmin) {
		throw error(403, 'Admin access required');
	}
}

export const GET: RequestHandler = async ({ cookies, url }) => {
	await requireAdmin(cookies);

	const metric = url.searchParams.get('metric') || 'all';
	const range = url.searchParams.get('range') || '1h';

	const timeSeries = performanceTracker.getTimeSeries();

	// Filter by time range
	const now = Date.now();
	const rangeMs = range === '5m' ? 5 * 60 * 1000 :
	                range === '15m' ? 15 * 60 * 1000 :
	                60 * 60 * 1000; // default 1h
	const cutoff = now - rangeMs;

	// Filter data by range
	const filtered = {
		concurrentUsers: timeSeries.concurrentUsers.filter(s => s.timestamp > cutoff),
		messagesSent: timeSeries.messagesSent.filter(s => s.timestamp > cutoff)
	};

	// Return specific metric or all
	if (metric === 'concurrentUsers') {
		return json(filtered.concurrentUsers);
	} else if (metric === 'messagesSent') {
		return json(filtered.messagesSent);
	} else {
		return json(filtered);
	}
};
