import type { RequestEvent } from "@sveltejs/kit";
import { getSession } from "../auth/session.js";
import { updatePresence } from "../repositories/presence.js";

/**
 * Middleware to automatically update user presence when they make API calls to board endpoints
 */
export async function updatePresenceFromRequest(
	event: RequestEvent,
	boardId: string,
): Promise<void> {
	try {
		// Get session from cookies
		const sessionId = event.cookies.get("session");
		if (!sessionId) return;

		const session = getSession(sessionId);
		if (!session) return;

		// Update presence for this user on this board
		await updatePresence(session.userId, boardId);
	} catch (error) {
		// Log error but don't fail the request
		console.error("Failed to update presence from request:", error);
	}
}

/**
 * Helper to extract board ID from request parameters
 */
export function getBoardIdFromParams(
	params: Record<string, string>,
): string | null {
	return params.id || null;
}

/**
 * Wrapper function that combines presence update with board ID extraction
 */
export async function refreshPresenceOnBoardAction(
	event: RequestEvent,
): Promise<void> {
	const boardId = getBoardIdFromParams(event.params);
	if (boardId) {
		await updatePresenceFromRequest(event, boardId);
	}
}
