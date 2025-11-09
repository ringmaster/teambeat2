import { json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { db } from "$lib/server/db/index.js";
import { boards, cards, scenes, seriesMembers } from "$lib/server/db/schema.js";
import {
	validatePositionValues,
	getQuadrantLabel,
	type QuadrantConfig,
} from "$lib/server/utils/quadrant-calculator.js";
import { broadcastCardQuadrantAdjusted } from "$lib/server/sse/broadcast.js";
import { featureTracker } from "$lib/server/analytics/feature-tracker.js";
import type { RequestHandler } from "./$types";

export const PUT: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const { cardId } = event.params;
		const { scene_id, x_value, y_value } = await event.request.json();

		// Validate required fields
		if (!scene_id || x_value === undefined || y_value === undefined) {
			return json(
				{
					success: false,
					error: "scene_id, x_value, and y_value are required",
				},
				{ status: 400 },
			);
		}

		// Validate position values are in range 1-96
		if (!validatePositionValues(x_value, y_value)) {
			return json(
				{
					success: false,
					error: "x_value and y_value must be between 1 and 96",
				},
				{ status: 400 },
			);
		}

		// Get card and verify it exists
		const [card] = await db.select().from(cards).where(eq(cards.id, cardId));

		if (!card) {
			return json({ success: false, error: "Card not found" }, { status: 404 });
		}

		// Get scene to verify it's a quadrant scene and get config
		const sceneWithBoard = await db
			.select()
			.from(scenes)
			.innerJoin(boards, eq(scenes.boardId, boards.id))
			.where(eq(scenes.id, scene_id));

		if (!sceneWithBoard || sceneWithBoard.length === 0) {
			return json(
				{ success: false, error: "Scene not found" },
				{ status: 404 },
			);
		}

		const scene = sceneWithBoard[0].scenes;
		const board = sceneWithBoard[0].boards;

		// Verify this is a quadrant scene in results phase
		if (scene.mode !== "quadrant") {
			return json(
				{ success: false, error: "Scene is not a quadrant scene" },
				{ status: 400 },
			);
		}

		if (scene.quadrantPhase !== "results") {
			return json(
				{
					success: false,
					error: "Can only adjust positions in results phase",
				},
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
					error: "Only facilitators can adjust quadrant positions",
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

		// Calculate new quadrant label
		const quadrant_label = getQuadrantLabel(x_value, y_value, config);

		// Update card metadata
		const existingMetadataArray = card.quadrantMetadata
			? JSON.parse(card.quadrantMetadata)
			: [];

		// Find and update the metadata for this scene
		const metadataIndex = existingMetadataArray.findIndex(
			(m: any) => m.scene_id === scene_id,
		);

		if (metadataIndex === -1) {
			return json(
				{
					success: false,
					error: "No consensus data found for this card in this scene",
				},
				{ status: 400 },
			);
		}

		existingMetadataArray[metadataIndex] = {
			...existingMetadataArray[metadataIndex],
			facilitator_x: x_value,
			facilitator_y: y_value,
			quadrant_label,
			timestamp: new Date().toISOString(),
		};

		await db
			.update(cards)
			.set({
				quadrantMetadata: JSON.stringify(existingMetadataArray),
				updatedAt: new Date().toISOString(),
			})
			.where(eq(cards.id, cardId));

		// Track feature usage
		featureTracker.trackFeature('quadrant', 'position_adjusted', user.userId, {
			boardId: board.id,
			metadata: { cardId, sceneId: scene_id, quadrantLabel: quadrant_label }
		});

		// Broadcast the adjustment to all users
		await broadcastCardQuadrantAdjusted(
			board.id,
			cardId,
			scene_id,
			x_value,
			y_value,
			quadrant_label,
		);

		return json({
			success: true,
			quadrant_metadata: existingMetadataArray[metadataIndex],
		});
	} catch (error) {
		console.error("Error adjusting quadrant position:", error);
		return json(
			{
				success: false,
				error: "Failed to adjust quadrant position",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
};
