import { json } from "@sveltejs/kit";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { getBoardWithDetails } from "$lib/server/repositories/board.js";
import { getUserRoleInSeries } from "$lib/server/repositories/board-series.js";
import { buildCompleteVotingResponse } from "$lib/server/utils/voting-data.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
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

		// Check if user has access to this board
		const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
		if (!userRole) {
			return json({ success: false, error: "Access denied" }, { status: 403 });
		}

		// Check if current scene shows votes to determine what data to return
		const currentScene = board.scenes?.find(
			(s) => s.id === board.currentSceneId,
		);
		const shouldShowAllVotes = currentScene?.showVotes || false;

		// Use shared function to build complete voting response
		const response = await buildCompleteVotingResponse(
			boardId,
			user.userId,
			shouldShowAllVotes,
		);

		return json(response);
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}

		return json(
			{ success: false, error: "Failed to fetch user voting data" },
			{ status: 500 },
		);
	}
};
