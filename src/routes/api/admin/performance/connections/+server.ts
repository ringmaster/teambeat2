/**
 * GET /api/admin/performance/connections - List all connected SSE clients
 * POST /api/admin/performance/connections - Kick a user or client
 */

import { error, json } from "@sveltejs/kit";
import { eq, inArray } from "drizzle-orm";
import { db } from "$lib/server/db";
import { boards, users } from "$lib/server/db/schema";
import { sseManager } from "$lib/server/sse/manager";
import { getSessionFromCookie } from "$lib/server/repositories/session";
import type { RequestHandler } from "./$types";

async function requireAdmin(cookies: any) {
	const sessionCookie = cookies.get("session");
	if (!sessionCookie) {
		throw error(401, "Unauthorized");
	}

	const session = await getSessionFromCookie(sessionCookie);
	if (!session) {
		throw error(401, "Unauthorized");
	}

	const [user] = await db
		.select({ isAdmin: users.is_admin })
		.from(users)
		.where(eq(users.id, session.userId))
		.limit(1);

	if (!user?.isAdmin) {
		throw error(403, "Admin access required");
	}

	return session;
}

export const GET: RequestHandler = async ({ cookies }) => {
	await requireAdmin(cookies);

	const connections = sseManager.getAllConnectedClients();

	// Get unique user and board IDs
	const userIds = [
		...new Set(connections.map((c) => c.userId).filter(Boolean)),
	] as string[];
	const boardIds = [
		...new Set(connections.map((c) => c.boardId).filter(Boolean)),
	] as string[];

	// Fetch user names
	const userMap = new Map<string, string>();
	if (userIds.length > 0) {
		const userRecords = await db
			.select({ id: users.id, name: users.name, email: users.email })
			.from(users)
			.where(inArray(users.id, userIds));

		for (const user of userRecords) {
			userMap.set(user.id, user.name || user.email);
		}
	}

	// Fetch board names
	const boardMap = new Map<string, string>();
	if (boardIds.length > 0) {
		const boardRecords = await db
			.select({ id: boards.id, name: boards.name })
			.from(boards)
			.where(inArray(boards.id, boardIds));

		for (const board of boardRecords) {
			boardMap.set(board.id.toString(), board.name);
		}
	}

	// Enrich connections with names
	const enrichedConnections = connections.map((conn) => ({
		...conn,
		userName: conn.userId ? userMap.get(conn.userId) || "Unknown" : null,
		boardName: conn.boardId ? boardMap.get(conn.boardId) || "Unknown" : null,
	}));

	// Group by user
	const byUser = new Map<
		string,
		{
			userId: string;
			userName: string;
			connections: typeof enrichedConnections;
		}
	>();

	for (const conn of enrichedConnections) {
		if (conn.userId) {
			if (!byUser.has(conn.userId)) {
				byUser.set(conn.userId, {
					userId: conn.userId,
					userName: conn.userName || "Unknown",
					connections: [],
				});
			}
			byUser.get(conn.userId)!.connections.push(conn);
		}
	}

	// Group by board
	const byBoard = new Map<
		string,
		{
			boardId: string;
			boardName: string;
			users: Array<{
				userId: string;
				userName: string;
				clientId: string;
				connectedAt: number;
				lastSeen: number;
			}>;
		}
	>();

	// Add a special group for connections not on any board
	byBoard.set("__no_board__", {
		boardId: "__no_board__",
		boardName: "Not on a board",
		users: [],
	});

	for (const conn of enrichedConnections) {
		const boardKey = conn.boardId || "__no_board__";
		if (!byBoard.has(boardKey)) {
			byBoard.set(boardKey, {
				boardId: boardKey,
				boardName: conn.boardName || "Unknown Board",
				users: [],
			});
		}
		byBoard.get(boardKey)!.users.push({
			userId: conn.userId || "__anonymous__",
			userName: conn.userName || "Anonymous",
			clientId: conn.clientId,
			connectedAt: conn.connectedAt,
			lastSeen: conn.lastSeen,
		});
	}

	// Remove empty "not on a board" group
	if (byBoard.get("__no_board__")!.users.length === 0) {
		byBoard.delete("__no_board__");
	}

	return json({
		totalConnections: connections.length,
		uniqueUsers: userIds.length,
		uniqueBoards: boardIds.length,
		connections: enrichedConnections,
		byUser: Array.from(byUser.values()),
		byBoard: Array.from(byBoard.values()),
	});
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	await requireAdmin(cookies);

	const body = await request.json();
	const { action, userId, clientId, redirectTo } = body;

	if (action === "kickUser" && userId) {
		const kickedCount = sseManager.kickUser(userId, redirectTo || "/dashboard");
		return json({
			success: true,
			message: `Kicked ${kickedCount} connection(s) for user`,
			kickedCount,
		});
	}

	if (action === "kickClient" && clientId) {
		const success = sseManager.kickClient(clientId, redirectTo || "/dashboard");
		return json({
			success,
			message: success ? "Client disconnected" : "Client not found",
		});
	}

	throw error(400, "Invalid action. Use kickUser or kickClient");
};
