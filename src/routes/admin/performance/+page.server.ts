/**
 * Server-side authentication check for performance dashboard
 */

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSessionFromCookie } from '$lib/server/repositories/session';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ cookies }) => {
	// Get session
	const sessionCookie = cookies.get('session');
	if (!sessionCookie) {
		throw redirect(302, '/login');
	}

	const session = await getSessionFromCookie(sessionCookie);
	if (!session) {
		throw redirect(302, '/login');
	}

	// Check if user is admin
	const [user] = await db
		.select({ isAdmin: users.is_admin })
		.from(users)
		.where(eq(users.id, session.userId))
		.limit(1);

	if (!user?.isAdmin) {
		throw redirect(302, '/');
	}
};
