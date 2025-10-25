import { json } from "@sveltejs/kit";
import { z } from "zod";
import { requireUserForApi } from "$lib/server/auth/index.js";
import {
	findBoardByColumnId,
	getBoardWithDetails,
} from "$lib/server/repositories/board.js";
import { getUserRoleInSeries } from "$lib/server/repositories/board-series.js";
import {
	findCardById,
	getCardsForBoard,
	moveCardToColumn,
	moveGroupToColumn,
	ungroupCard,
} from "$lib/server/repositories/card.js";
import { broadcastCardUpdated } from "$lib/server/sse/broadcast.js";
import {
	enrichCardsWithCounts,
	enrichCardWithCounts,
} from "$lib/server/utils/cards-data.js";
import {
	getCurrentScene,
	getSceneCapability,
} from "$lib/utils/scene-capability.js";
import type { RequestHandler } from "./$types";

const moveCardSchema = z.object({
	columnId: z.string().uuid(),
});

export const PUT: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const cardId = event.params.id;
		const body = await event.request.json();
		const data = moveCardSchema.parse(body);

		const card = await findCardById(cardId);
		if (!card) {
			return json({ success: false, error: "Card not found" }, { status: 404 });
		}

		// Get board information through column relationship
		const boardId = await findBoardByColumnId(card.columnId);
		if (!boardId) {
			return json(
				{ success: false, error: "Column not found" },
				{ status: 404 },
			);
		}

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

		// Check if current scene allows moving cards
		const currentScene = getCurrentScene(board.scenes, board.currentSceneId);
		if (!getSceneCapability(currentScene, board.status, "allow_move_cards")) {
			return json(
				{ success: false, error: "Moving cards not allowed in current scene" },
				{ status: 403 },
			);
		}

		// Verify the target column exists in this board
		const targetColumn = board.columns.find((col) => col.id === data.columnId);
		if (!targetColumn) {
			return json(
				{ success: false, error: "Target column not found" },
				{ status: 404 },
			);
		}

		// Check if this is a group lead card - if so, move the entire group
		if (card.isGroupLead && card.groupId) {
			await moveGroupToColumn(cardId, data.columnId);

			// Get all cards in the group and broadcast updates
			const updatedCards = await getCardsForBoard(board.id);
			const groupCards = updatedCards.filter((c) => c.groupId === card.groupId);

			// Enrich cards with counts before broadcasting
			const enrichedGroupCards = await enrichCardsWithCounts(groupCards);
			for (const groupCard of enrichedGroupCards) {
				broadcastCardUpdated(board.id, groupCard);
			}

			return json({
				success: true,
				groupMoved: true,
				groupId: card.groupId,
			});
		} else {
			// Check if this card is part of a group (subordinate card)
			if (card.groupId && !card.isGroupLead) {
				// This is a subordinate card being moved out of its group
				// First, remove it from the group
				const ungroupResult = await ungroupCard(cardId);

				// Then move it to the target column
				const updatedCard = await moveCardToColumn(cardId, data.columnId);

				// Get all cards to check for remaining group members
				const allCards = await getCardsForBoard(board.id);

				// Broadcast update for the moved card with counts
				const enrichedCard = await enrichCardWithCounts(updatedCard);
				broadcastCardUpdated(board.id, enrichedCard);

				// Broadcast updates for any cards affected by ungrouping (like last remaining card losing group lead status)
				for (const affectedCardId of ungroupResult.affectedCardIds) {
					const affectedCard = allCards.find((c) => c.id === affectedCardId);
					if (affectedCard) {
						const enrichedAffectedCard =
							await enrichCardWithCounts(affectedCard);
						broadcastCardUpdated(board.id, enrichedAffectedCard);
					}
				}

				// Broadcast updates for any remaining cards in the original group
				if (card.groupId) {
					const remainingGroupCards = allCards.filter(
						(c) => c.groupId === card.groupId,
					);
					const enrichedRemainingCards =
						await enrichCardsWithCounts(remainingGroupCards);
					for (const groupCard of enrichedRemainingCards) {
						broadcastCardUpdated(board.id, groupCard);
					}
				}

				return json({
					success: true,
					card: enrichedCard,
					ungrouped: true,
				});
			} else {
				// Move single ungrouped card
				const updatedCard = await moveCardToColumn(cardId, data.columnId);

				// Enrich and broadcast the updated card to all clients
				const enrichedCard = await enrichCardWithCounts(updatedCard);
				broadcastCardUpdated(board.id, enrichedCard);

				return json({
					success: true,
					card: enrichedCard,
				});
			}
		}
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}

		if (error instanceof z.ZodError) {
			return json(
				{ success: false, error: "Invalid input", details: error.errors },
				{ status: 400 },
			);
		}

		return json(
			{ success: false, error: "Failed to move card" },
			{ status: 500 },
		);
	}
};
