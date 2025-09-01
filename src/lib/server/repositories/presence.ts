import { db } from '../db/index.js';
import { presence } from '../db/schema.js';
import { eq, and, gte } from 'drizzle-orm';

export async function updatePresence(userId: string, boardId: string, activity?: string) {
	const lastSeen = Date.now();
	
	// Use upsert pattern for SQLite
	await db
		.insert(presence)
		.values({
			userId,
			boardId,
			lastSeen,
			currentActivity: activity
		})
		.onConflictDoUpdate({
			target: [presence.userId, presence.boardId],
			set: {
				lastSeen,
				currentActivity: activity
			}
		});
}

export async function getBoardPresence(boardId: string) {
	const activeThreshold = Date.now() - (5 * 60 * 1000); // 5 minutes
	
	const activeUsers = await db
		.select({
			userId: presence.userId,
			lastSeen: presence.lastSeen,
			currentActivity: presence.currentActivity
		})
		.from(presence)
		.where(
			and(
				eq(presence.boardId, boardId),
				gte(presence.lastSeen, activeThreshold)
			)
		);
	
	return activeUsers;
}

export async function removePresence(userId: string, boardId: string) {
	await db
		.delete(presence)
		.where(
			and(
				eq(presence.userId, userId),
				eq(presence.boardId, boardId)
			)
		);
}

export async function cleanupStalePresence() {
	const staleThreshold = Date.now() - (10 * 60 * 1000); // 10 minutes
	
	await db
		.delete(presence)
		.where(
			gte(presence.lastSeen, staleThreshold)
		);
}

// Clean up stale presence every 5 minutes
setInterval(cleanupStalePresence, 5 * 60 * 1000);