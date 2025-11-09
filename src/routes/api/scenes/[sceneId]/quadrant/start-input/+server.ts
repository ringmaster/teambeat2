import { json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { db } from "$lib/server/db/index.js";
import { boards, scenes, seriesMembers } from "$lib/server/db/schema.js";
import { broadcastQuadrantPhaseChanged } from "$lib/server/sse/broadcast.js";
import { featureTracker } from "$lib/server/analytics/feature-tracker.js";
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
					error: "Only facilitators can start quadrant input phase",
				},
				{ status: 403 },
			);
		}

		// Update scene to input phase
		const [updatedScene] = await db
			.update(scenes)
			.set({ quadrantPhase: "input" })
			.where(eq(scenes.id, sceneId))
			.returning();

		// Track feature usage
		featureTracker.trackFeature('quadrant', 'input_started', user.userId, {
			boardId: board.id,
			metadata: { sceneId }
		});

		// Broadcast the phase change to all users
		await broadcastQuadrantPhaseChanged(board.id, sceneId, "input");

		return json({
			success: true,
			scene: {
				id: updatedScene.id,
				quadrantPhase: updatedScene.quadrantPhase,
			},
		});
	} catch (error) {
		console.error("Error starting quadrant input:", error);
		return json(
			{
				success: false,
				error: "Failed to start quadrant input",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
};
