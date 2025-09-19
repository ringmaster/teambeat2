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
        // Start a transaction to delete all user data
        await db.transaction((tx) => {
            // Delete user's votes
            tx.delete(votes).where(eq(votes.userId, session.userId)).run();

            // Delete user's comments
            tx.delete(comments).where(eq(comments.userId, session.userId)).run();

            // Delete user's cards
            tx.delete(cards).where(eq(cards.userId, session.userId)).run();

            // Remove user from series
            tx.delete(seriesMembers).where(eq(seriesMembers.userId, session.userId)).run();

            // Finally, delete the user
            tx.delete(users).where(eq(users.id, session.userId)).run();
        });

        // Clear the session cookie
        cookies.delete('session', { path: '/' });

        return json({ success: true });
    } catch (error) {
        console.error('Failed to delete account:', error);
        return json({ error: 'Failed to delete account' }, { status: 500 });
    }
};
