/**
 * GET /api/admin/performance - Current performance metrics
 * POST /api/admin/performance/reset - Reset counters
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

	return session;
}

export const GET: RequestHandler = async ({ cookies }) => {
	await requireAdmin(cookies);

	const stats = performanceTracker.getStats();
	return json(stats);
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	await requireAdmin(cookies);

	const { action } = await request.json();

	if (action === 'reset') {
		performanceTracker.reset();
		return json({ success: true });
	}

	throw error(400, 'Invalid action');
};
