import { json } from "@sveltejs/kit";
import { z } from "zod";
import { handleApiError } from "$lib/server/api-utils.js";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { refreshPresenceOnBoardAction } from "$lib/server/middleware/presence.js";
import {
	deleteBoard,
	getBoardWithDetails,
	updateBoardSettings,
	updateBoardStatus,
} from "$lib/server/repositories/board.js";
import {
	addUserToSeries,
	getUserRoleInSeries,
} from "$lib/server/repositories/board-series.js";
import { broadcastBoardUpdated } from "$lib/server/sse/broadcast.js";
import type { RequestHandler } from "./$types";

const updateBoardSchema = z.object({
	status: z.enum(["draft", "active", "completed", "archived"]).optional(),
	name: z.string().min(1).max(100).optional(),
	blameFreeMode: z.boolean().optional(),
	votingAllocation: z.number().int().min(0).max(20).optional(),
	votingEnabled: z.boolean().optional(),
	createdAt: z.string().datetime().optional(),
});

export const GET: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const boardId = event.params.id;

		// Update user presence on this board
		await refreshPresenceOnBoardAction(event);

		const board = await getBoardWithDetails(boardId);
		if (!board) {
			return json(
				{ success: false, error: "Board not found" },
				{ status: 404 },
			);
		}

		// Check if user has access to this board
		let userRole = await getUserRoleInSeries(user.userId, board.seriesId);
		if (!userRole) {
			// Only auto-add users to active boards
			if (board.status === "active") {
				await addUserToSeries(board.seriesId, user.userId, "member");
				userRole = "member";
			} else {
				// User not a member and board is not active
				return json(
					{ success: false, error: "Board not found" },
					{ status: 404 },
				);
			}
		}

		// Non-admin/facilitator users cannot access draft boards
		if (
			board.status === "draft" &&
			!["admin", "facilitator"].includes(userRole)
		) {
			return json(
				{ success: false, error: "Board not found" },
				{ status: 404 },
			);
		}

		return json({
			success: true,
			board,
			userRole,
		});
	} catch (error) {
		return handleApiError(error, "Failed to fetch board");
	}
};

export const PATCH: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const boardId = event.params.id;
		const body = await event.request.json();
		const data = updateBoardSchema.parse(body);

		// Update user presence on this board
		await refreshPresenceOnBoardAction(event);

		const board = await getBoardWithDetails(boardId);
		if (!board) {
			return json(
				{ success: false, error: "Board not found" },
				{ status: 404 },
			);
		}

		// Check if user has permission to update this board
		const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
		if (!userRole || !["admin", "facilitator"].includes(userRole)) {
			return json({ success: false, error: "Access denied" }, { status: 403 });
		}

		if (data.status) {
			await updateBoardStatus(boardId, data.status);
		}

		// Update board settings if provided
		const settingsData = {
			name: data.name,
			blameFreeMode: data.blameFreeMode,
			votingAllocation: data.votingAllocation,
			votingEnabled: data.votingEnabled,
			createdAt: data.createdAt,
		};

		// Filter out undefined values
		const filteredSettingsData = Object.fromEntries(
			Object.entries(settingsData).filter(([_, v]) => v !== undefined),
		);

		if (Object.keys(filteredSettingsData).length > 0) {
			await updateBoardSettings(boardId, filteredSettingsData);
		}

		// Get updated board data and broadcast to all connected clients
		const updatedBoard = await getBoardWithDetails(boardId);
		if (updatedBoard) {
			broadcastBoardUpdated(boardId, updatedBoard);
		}

		return json({
			success: true,
			board: updatedBoard,
		});
	} catch (error) {
		return handleApiError(error, "Failed to update board");
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const boardId = event.params.id;

		const board = await getBoardWithDetails(boardId);
		if (!board) {
			return json(
				{ success: false, error: "Board not found" },
				{ status: 404 },
			);
		}

		// Check if user has permission to delete this board
		const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
		if (!userRole || !["admin", "facilitator"].includes(userRole)) {
			return json({ success: false, error: "Access denied" }, { status: 403 });
		}

		// Delete the board and all its related data
		await deleteBoard(boardId);

		return json({
			success: true,
			message: "Board deleted successfully",
		});
	} catch (error) {
		return handleApiError(error, "Failed to delete board");
	}
};
