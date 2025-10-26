import { json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { db } from "$lib/server/db/index.js";
import { boards, cards, columns, scenes, seriesMembers } from "$lib/server/db/schema.js";
import { getQuadrantPositionsForCard } from "$lib/server/repositories/quadrant-position.js";
import {
	calculateConsensusPosition,
	getModeQuadrant,
	getQuadrantLabel,
	type QuadrantConfig,
} from "$lib/server/utils/quadrant-calculator.js";
import { broadcastQuadrantResultsCalculated, broadcastSceneChanged } from "$lib/server/sse/broadcast.js";
import { findSceneById } from "$lib/server/repositories/scene.js";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const { sceneId } = event.params;

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

		// Verify this is a quadrant scene
		if (scene.mode !== "quadrant") {
			return json(
				{ success: false, error: "Scene is not a quadrant scene" },
				{ status: 400 },
			);
		}

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
					error: "Only facilitators can calculate consensus",
				},
				{ status: 403 },
			);
		}

		// Parse quadrant config
		if (!scene.quadrantConfig) {
			return json(
				{ success: false, error: "Scene has no quadrant configuration" },
				{ status: 400 },
			);
		}

		const config: QuadrantConfig = JSON.parse(scene.quadrantConfig);

		// Get all cards for the board
		const allCards = await db
			.select()
			.from(cards)
			.innerJoin(
				columns,
				eq(cards.columnId, columns.id),
			)
			.where(eq(columns.boardId, board.id));

		const cardPositions: any[] = [];

		// Calculate consensus for each card
		for (const cardRow of allCards) {
			const card = cardRow.cards;
			const positions = await getQuadrantPositionsForCard(card.id, sceneId);

			// Get existing metadata
			const existingMetadataArray = card.quadrantMetadata
				? JSON.parse(card.quadrantMetadata)
				: [];

			if (positions.length === 0) {
				// Remove metadata for this scene if there are no positions
				const updatedMetadata = existingMetadataArray.filter(
					(m: any) => m.scene_id !== sceneId,
				);

				// Only update if there was metadata to remove
				if (existingMetadataArray.length !== updatedMetadata.length) {
					await db
						.update(cards)
						.set({
							quadrantMetadata: JSON.stringify(updatedMetadata),
							updatedAt: new Date().toISOString(),
						})
						.where(eq(cards.id, card.id));
				}
				continue;
			}

			// Calculate consensus position with quality metrics
			const { consensus_x, consensus_y, std_dev, consensus_score, spread } =
				calculateConsensusPosition(positions);

			// Calculate mode quadrant
			const mode_quadrant = getModeQuadrant(positions, config);

			// Get quadrant label from consensus position
			const quadrant_label = getQuadrantLabel(consensus_x, consensus_y, config);

			// Build metadata for this card
			const metadata = {
				scene_id: sceneId,
				consensus_x,
				consensus_y,
				facilitator_x: consensus_x, // Initially same as consensus
				facilitator_y: consensus_y,
				mode_quadrant,
				quadrant_label,
				participant_count: positions.length,
				std_dev,
				consensus_score,
				spread,
				timestamp: new Date().toISOString(),
			};

			// Update card with quadrant metadata
			// Replace or add metadata for this scene (existingMetadataArray already loaded above)
			const updatedMetadata = existingMetadataArray.filter(
				(m: any) => m.scene_id !== sceneId,
			);
			updatedMetadata.push(metadata);

			await db
				.update(cards)
				.set({
					quadrantMetadata: JSON.stringify(updatedMetadata),
					updatedAt: new Date().toISOString(),
				})
				.where(eq(cards.id, card.id));

			// Add to response
			cardPositions.push({
				card_id: card.id,
				consensus_x,
				consensus_y,
				facilitator_x: consensus_x,
				facilitator_y: consensus_y,
				mode_quadrant,
				quadrant_label,
				participant_count: positions.length,
				std_dev,
				consensus_score,
				spread,
			});
		}

		// Update scene to results phase
		await db
			.update(scenes)
			.set({ quadrantPhase: "results" })
			.where(eq(scenes.id, sceneId));

		// Get the updated scene and broadcast the change
		const updatedScene = await findSceneById(sceneId);
		if (board.currentSceneId === sceneId) {
			await broadcastSceneChanged(board.id, updatedScene);
		}

		// Broadcast the results to all users
		await broadcastQuadrantResultsCalculated(board.id, sceneId, cardPositions);

		return json({
			success: true,
			scene: {
				id: scene.id,
				quadrant_phase: "results",
			},
			card_positions: cardPositions,
		});
	} catch (error) {
		console.error("Error calculating consensus:", error);
		return json(
			{
				success: false,
				error: "Failed to calculate consensus",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
};
