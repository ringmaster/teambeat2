import { json } from "@sveltejs/kit";
import { z } from "zod";
import { SCENE_FLAGS } from "$lib/scene-flags";
import { handleApiError } from "$lib/server/api-utils.js";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { refreshPresenceOnBoardAction } from "$lib/server/middleware/presence.js";
import { findAgreementById } from "$lib/server/repositories/agreement.js";
import { getBoardWithDetails } from "$lib/server/repositories/board.js";
import { getUserRoleInSeries } from "$lib/server/repositories/board-series.js";
import { createCard } from "$lib/server/repositories/card.js";
import { broadcastCardCreated } from "$lib/server/sse/broadcast.js";
import { enrichCardWithCounts } from "$lib/server/utils/cards-data.js";
import type { BoardStatus } from "$lib/types.js";
import { getSceneCapability } from "$lib/utils/scene-capability.js";
import type { RequestHandler } from "./$types";

const copyToCardSchema = z.object({
	column_id: z.string().uuid(),
});

export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const agreementId = event.params.id;
		const body = await event.request.json();
		const data = copyToCardSchema.parse(body);

		const agreement = await findAgreementById(agreementId);
		if (!agreement) {
			return json(
				{ success: false, error: "Agreement not found" },
				{ status: 404 },
			);
		}

		await refreshPresenceOnBoardAction(event);

		const board = await getBoardWithDetails(agreement.boardId);
		if (!board) {
			return json(
				{ success: false, error: "Board not found" },
				{ status: 404 },
			);
		}

		const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
		if (!userRole || (userRole !== "admin" && userRole !== "facilitator")) {
			return json(
				{
					success: false,
					error: "Only facilitators and admins can copy agreements to cards",
				},
				{ status: 403 },
			);
		}

		// Verify the column is visible in the current scene
		const currentScene = board.scenes.find(
			(s) => s.id === board.currentSceneId,
		);
		if (!currentScene) {
			return json(
				{ success: false, error: "No active scene" },
				{ status: 400 },
			);
		}

		// Check if adding cards is allowed using getSceneCapability
		if (
			!getSceneCapability(
				currentScene,
				board.status as BoardStatus,
				SCENE_FLAGS.ALLOW_ADD_CARDS,
			)
		) {
			return json(
				{ success: false, error: "Adding cards is not allowed for this scene" },
				{ status: 403 },
			);
		}

		const hiddenColumnIds = board.hiddenColumnsByScene?.[currentScene.id] || [];
		const visibleColumns = board.columns
			.filter((c) => !hiddenColumnIds.includes(c.id))
			.map((c) => c.id);

		if (!visibleColumns.includes(data.column_id)) {
			return json(
				{ success: false, error: "Column must be visible in current scene" },
				{ status: 400 },
			);
		}

		// Format content with indentation for markdown
		// Replace newlines with 4 spaces + tab for markdown indentation
		const formattedContent = agreement.content.replace(/\n/g, "\n    \t");

		// Create the card with formatted content
		const card = await createCard({
			columnId: data.column_id,
			userId: user.userId,
			content: formattedContent,
		});

		const enrichedCard = await enrichCardWithCounts(card);

		// Broadcast the new card to all clients
		broadcastCardCreated(agreement.boardId, enrichedCard);

		return json({
			success: true,
			card: enrichedCard,
		});
	} catch (error) {
		return handleApiError(error, "Failed to copy agreement to card");
	}
};
