import { and, eq, gte, lt } from "drizzle-orm";
import {
	PRESENCE_CLEANUP_INTERVAL_MS,
	PRESENCE_TIMEOUT_MS,
} from "../constants.js";
import { db } from "../db/index.js";
import { presence } from "../db/schema.js";

export async function updatePresence(
	userId: string,
	boardId: string,
	activity?: string,
) {
	const lastSeen = Date.now();

	try {
		// Use upsert pattern for both SQLite and PostgreSQL
		await db
			.insert(presence)
			.values({
				userId,
				boardId,
				lastSeen,
				currentActivity: activity,
			})
			.onConflictDoUpdate({
				target: [presence.userId, presence.boardId],
				set: {
					lastSeen,
					currentActivity: activity,
				},
			});
	} catch (error: any) {
		// Silently ignore foreign key violations (board/user doesn't exist)
		// This can happen when a board is deleted while users are still connected
		if (error?.cause?.code === "23503") {
			// PostgreSQL foreign key violation
			return;
		}
		// Re-throw other errors
		throw error;
	}
}

export async function getBoardPresence(boardId: string) {
	const activeThreshold = Date.now() - PRESENCE_TIMEOUT_MS;

	const activeUsers = await db
		.select({
			userId: presence.userId,
			lastSeen: presence.lastSeen,
			currentActivity: presence.currentActivity,
		})
		.from(presence)
		.where(eq(presence.boardId, boardId));

	return activeUsers;
}

export async function getUsersNearingTimeout(boardId: string) {
	const now = Date.now();
	const nearTimeoutThreshold = now - PRESENCE_TIMEOUT_MS * 0.7; // 70% of timeout

	const nearTimeoutUsers = await db
		.select({
			userId: presence.userId,
			lastSeen: presence.lastSeen,
			currentActivity: presence.currentActivity,
		})
		.from(presence)
		.where(
			and(
				eq(presence.boardId, boardId),
				lt(presence.lastSeen, nearTimeoutThreshold),
			),
		);

	return nearTimeoutUsers;
}

export async function removePresence(userId: string, boardId: string) {
	await db
		.delete(presence)
		.where(and(eq(presence.userId, userId), eq(presence.boardId, boardId)));
}

export async function cleanupStalePresence() {
	const staleThreshold = Date.now() - PRESENCE_CLEANUP_INTERVAL_MS;

	const deletedRows = await db
		.delete(presence)
		.where(lt(presence.lastSeen, staleThreshold));

	return deletedRows;
}

// Clean up stale presence periodically
setInterval(cleanupStalePresence, PRESENCE_CLEANUP_INTERVAL_MS);
