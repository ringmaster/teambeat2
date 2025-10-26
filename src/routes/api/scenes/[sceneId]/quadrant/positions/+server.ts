import { json } from "@sveltejs/kit";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { getQuadrantPositionsForScene } from "$lib/server/repositories/quadrant-position.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const { sceneId } = event.params;

		// Get all positions for this user in this scene
		const positions = await getQuadrantPositionsForScene(sceneId, user.userId);

		// Transform to API response format
		const formattedPositions = positions.map((p) => ({
			id: p.id,
			card_id: p.cardId,
			x_value: p.xValue,
			y_value: p.yValue,
			created_at: p.createdAt,
			updated_at: p.updatedAt,
		}));

		return json({
			success: true,
			positions: formattedPositions,
		});
	} catch (error) {
		console.error("Error getting quadrant positions:", error);
		return json(
			{
				success: false,
				error: "Failed to get quadrant positions",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
};
