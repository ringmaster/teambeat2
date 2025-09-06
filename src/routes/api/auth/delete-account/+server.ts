import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { users, sessions, boards, cards, votes, comments, seriesUsers } from '$lib/server/db/schema';
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
        await db.transaction(async (tx) => {
            // Delete all user's sessions
            await tx.delete(sessions).where(eq(sessions.userId, session.userId));
            
            // Delete user's votes
            await tx.delete(votes).where(eq(votes.userId, session.userId));
            
            // Delete user's comments
            await tx.delete(comments).where(eq(comments.userId, session.userId));
            
            // Delete user's cards
            await tx.delete(cards).where(eq(cards.userId, session.userId));
            
            // Delete user's boards
            await tx.delete(boards).where(eq(boards.createdBy, session.userId));
            
            // Remove user from series
            await tx.delete(seriesUsers).where(eq(seriesUsers.userId, session.userId));
            
            // Finally, delete the user
            await tx.delete(users).where(eq(users.id, session.userId));
        });

        // Clear the session cookie
        cookies.delete('session', { path: '/' });

        return json({ success: true });
    } catch (error) {
        console.error('Failed to delete account:', error);
        return json({ error: 'Failed to delete account' }, { status: 500 });
    }
};