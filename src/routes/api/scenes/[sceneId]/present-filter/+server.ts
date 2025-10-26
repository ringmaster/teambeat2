import { json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { db } from "$lib/server/db/index.js";
import { boards, scenes, seriesMembers } from "$lib/server/db/schema.js";
import { broadcastPresentFilterChanged } from "$lib/server/sse/broadcast.js";
import type { RequestHandler } from "./$types";

export const PUT: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const { sceneId } = event.params;
		const { type, quadrant_scene_id, quadrant_label } =
			await event.request.json();

		// Validate required fields
		if (!type) {
			return json(
				{ success: false, error: "type is required" },
				{ status: 400 },
			);
		}

		// Validate type
		if (!["votes", "quadrant"].includes(type)) {
			return json(
				{ success: false, error: 'type must be "votes" or "quadrant"' },
				{ status: 400 },
			);
		}

		// If type is quadrant, validate required fields
		if (type === "quadrant" && (!quadrant_scene_id || !quadrant_label)) {
			return json(
				{
					success: false,
					error:
						"quadrant_scene_id and quadrant_label are required for quadrant filter",
				},
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

		// Verify this is a present mode scene
		if (scene.mode !== "present") {
			return json(
				{
					success: false,
					error: "Can only set filters on present mode scenes",
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
					error: "Only facilitators can set present mode filters",
				},
				{ status: 403 },
			);
		}

		// Build filter object
		const filter: any = { type };
		if (type === "quadrant") {
			filter.scene_id = quadrant_scene_id;
			filter.quadrant_label = quadrant_label;
		}

		// Update scene with filter
		const [updatedScene] = await db
			.update(scenes)
			.set({ presentModeFilter: JSON.stringify(filter) })
			.where(eq(scenes.id, sceneId))
			.returning();

		// Broadcast the filter change to all users
		await broadcastPresentFilterChanged(board.id, sceneId, filter);

		return json({
			success: true,
			scene: {
				id: updatedScene.id,
				present_mode_filter: filter,
			},
		});
	} catch (error) {
		console.error("Error setting present filter:", error);
		return json(
			{
				success: false,
				error: "Failed to set present filter",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
};
