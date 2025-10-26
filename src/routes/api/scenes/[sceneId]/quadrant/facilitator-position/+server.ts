import { json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { db } from "$lib/server/db/index.js";
import { boards, cards, columns, scenes, seriesMembers } from "$lib/server/db/schema.js";
import { broadcastQuadrantFacilitatorPositionUpdated } from "$lib/server/sse/broadcast.js";
import type { RequestHandler } from "./$types";

export const PATCH: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const { sceneId } = event.params;
		const { card_id, facilitator_x, facilitator_y } = await event.request.json();

		// Validate inputs
		if (!card_id || facilitator_x === undefined || facilitator_y === undefined) {
			return json(
				{ success: false, error: "Missing required fields" },
				{ status: 400 },
			);
		}

		// Get scene and board
		const sceneWithBoard = await db
			.select()
			.from(scenes)
			.innerJoin(boards, eq(scenes.boardId, boards.id))
			.where(eq(scenes.id, sceneId));

		if (!sceneWithBoard || sceneWithBoard.length === 0) {
			return json(
				{ success: false, error: "Scene not found" },
				{ status: 404 },
			);
		}

		const scene = sceneWithBoard[0].scenes;
		const board = sceneWithBoard[0].boards;

		// Check if user is admin or facilitator
		const [membership] = await db
			.select()
			.from(seriesMembers)
			.where(
				and(
					eq(seriesMembers.userId, user.userId),
					eq(seriesMembers.seriesId, board.seriesId),
				),
			);

		if (!membership || !["admin", "facilitator"].includes(membership.role)) {
			return json(
				{
					success: false,
					error: "Only facilitators can adjust positions",
				},
				{ status: 403 },
			);
		}

		// Get the card
		const [card] = await db
			.select()
			.from(cards)
			.where(eq(cards.id, card_id))
			.limit(1);

		if (!card) {
			return json(
				{ success: false, error: "Card not found" },
				{ status: 404 },
			);
		}

		// Parse existing metadata
		const existingMetadataArray = card.quadrantMetadata
			? JSON.parse(card.quadrantMetadata)
			: [];

		// Find metadata for this scene
		const metadataForScene = existingMetadataArray.find(
			(m: any) => m.scene_id === sceneId,
		);

		if (!metadataForScene) {
			return json(
				{
					success: false,
					error: "No consensus data found for this card in this scene",
				},
				{ status: 400 },
			);
		}

		// Update facilitator position
		metadataForScene.facilitator_x = facilitator_x;
		metadataForScene.facilitator_y = facilitator_y;

		// Replace metadata for this scene
		const updatedMetadata = existingMetadataArray.filter(
			(m: any) => m.scene_id !== sceneId,
		);
		updatedMetadata.push(metadataForScene);

		// Update card
		await db
			.update(cards)
			.set({
				quadrantMetadata: JSON.stringify(updatedMetadata),
				updatedAt: new Date().toISOString(),
			})
			.where(eq(cards.id, card_id));

		// Broadcast the update to all users
		await broadcastQuadrantFacilitatorPositionUpdated(
			board.id,
			sceneId,
			card_id,
			facilitator_x,
			facilitator_y,
		);

		return json({
			success: true,
			card_id,
			facilitator_x,
			facilitator_y,
		});
	} catch (error) {
		console.error("Error updating facilitator position:", error);
		return json(
			{
				success: false,
				error: "Failed to update facilitator position",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
};
