import { json } from "@sveltejs/kit";
import { z } from "zod";
import { handleApiError } from "$lib/server/api-utils.js";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { refreshPresenceOnBoardAction } from "$lib/server/middleware/presence.js";
import { getBoardWithDetails } from "$lib/server/repositories/board.js";
import { getUserRoleInSeries } from "$lib/server/repositories/board-series.js";
import { createCard } from "$lib/server/repositories/card.js";
import { broadcastCardCreated } from "$lib/server/sse/broadcast.js";
import {
	buildAllCardsData,
	enrichCardWithCounts,
} from "$lib/server/utils/cards-data.js";
import {
	getCurrentScene,
	getSceneCapability,
} from "$lib/utils/scene-capability.js";
import type { RequestHandler } from "./$types";

const createCardSchema = z.object({
	columnId: z.string().uuid(),
	content: z.string().min(1).max(1000),
	groupId: z.string().uuid().optional(),
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
		const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
		if (!userRole) {
			return json({ success: false, error: "Access denied" }, { status: 403 });
		}

		const cards = await buildAllCardsData(boardId);

		return json({
			success: true,
			cards,
		});
	} catch (error) {
		return handleApiError(error, "Failed to fetch cards");
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const boardId = event.params.id;
		const body = await event.request.json();
		const data = createCardSchema.parse(body);

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
		const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
		if (!userRole) {
			return json({ success: false, error: "Access denied" }, { status: 403 });
		}

		// Check if current scene allows adding cards
		const currentScene = getCurrentScene(board.scenes, board.currentSceneId);
		if (!getSceneCapability(currentScene, board.status, "allow_add_cards")) {
			return json(
				{ success: false, error: "Adding cards not allowed in current scene" },
				{ status: 403 },
			);
		}

		const card = await createCard({
			...data,
			userId: user.userId,
		});

		// Enrich card with counts (new cards will have 0 counts but keeps consistency)
		const enrichedCard = await enrichCardWithCounts(card);

		// Broadcast the new card to all clients
		broadcastCardCreated(boardId, enrichedCard);

		return json({
			success: true,
			card: enrichedCard,
		});
	} catch (error) {
		return handleApiError(error, "Failed to create card");
	}
};
