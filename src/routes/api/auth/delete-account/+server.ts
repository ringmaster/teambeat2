import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users, seriesMembers, cards, votes, comments } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionFromCookie } from '$lib/server/repositories/session';

export const DELETE: RequestHandler = async ({ cookies }) => {
  const sessionCookie = cookies.get('session');
  if (!sessionCookie) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await getSessionFromCookie(sessionCookie);
  if (!session) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Delete user - CASCADE DELETE handles votes, comments, cards, and series memberships
    await db.delete(users).where(eq(users.id, session.userId));

    // Clear the session cookie
    cookies.delete('session', { path: '/' });

    return json({ success: true });
  } catch (error) {
    console.error('Failed to delete account:', error);
    return json({ error: 'Failed to delete account' }, { status: 500 });
  }
};
