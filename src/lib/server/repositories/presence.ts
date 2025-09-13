import { db } from '../db/index.js';
import { presence } from '../db/schema.js';
import { eq, and, gte, lt } from 'drizzle-orm';
import { PRESENCE_TIMEOUT_MS, PRESENCE_CLEANUP_INTERVAL_MS } from '../constants.js';

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
	const activeThreshold = Date.now() - PRESENCE_TIMEOUT_MS;

	const activeUsers = await db
		.select({
			userId: presence.userId,
			lastSeen: presence.lastSeen,
			currentActivity: presence.currentActivity
		})
		.from(presence)
		.where(
		  eq(presence.boardId, boardId)
		);

	return activeUsers;
}

export async function getUsersNearingTimeout(boardId: string) {
	const now = Date.now();
	const nearTimeoutThreshold = now - (PRESENCE_TIMEOUT_MS * 0.7); // 70% of timeout
	const activeThreshold = now - PRESENCE_TIMEOUT_MS;

	const nearTimeoutUsers = await db
		.select({
			userId: presence.userId,
			lastSeen: presence.lastSeen,
			currentActivity: presence.currentActivity
		})
		.from(presence)
		.where(
			and(
				eq(presence.boardId, boardId),
				gte(presence.lastSeen, activeThreshold),
				lt(presence.lastSeen, nearTimeoutThreshold)
			)
		);

	return nearTimeoutUsers;
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
	const staleThreshold = Date.now() - PRESENCE_TIMEOUT_MS;

	const deletedRows = await db
		.delete(presence)
		.where(
			lt(presence.lastSeen, staleThreshold)
		);

	return deletedRows;
}

// Clean up stale presence periodically
setInterval(cleanupStalePresence, PRESENCE_CLEANUP_INTERVAL_MS);
