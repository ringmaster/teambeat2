import { json } from "@sveltejs/kit";
import { requireUserForApi } from "$lib/server/auth/index.js";
import {
	createOrUpdateQuadrantPosition,
	deleteQuadrantPosition,
} from "$lib/server/repositories/quadrant-position.js";
import { validatePositionValues } from "$lib/server/utils/quadrant-calculator.js";
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

		// Create or update the position
		const position = await createOrUpdateQuadrantPosition(
			cardId,
			user.userId,
			scene_id,
			x_value,
			y_value,
		);

		return json({
			success: true,
			position: {
				id: position.id,
				card_id: position.cardId,
				user_id: position.userId,
				scene_id: position.sceneId,
				x_value: position.xValue,
				y_value: position.yValue,
				updated_at: position.updatedAt,
			},
		});
	} catch (error) {
		console.error("Error updating quadrant position:", error);
		return json(
			{
				success: false,
				error: "Failed to update quadrant position",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const { cardId } = event.params;
		const sceneId = event.url.searchParams.get("scene_id");

		if (!sceneId) {
			return json(
				{ success: false, error: "scene_id query parameter is required" },
				{ status: 400 },
			);
		}

		// Delete the position
		await deleteQuadrantPosition(cardId, user.userId, sceneId);

		return json({ success: true });
	} catch (error) {
		console.error("Error deleting quadrant position:", error);
		return json(
			{
				success: false,
				error: "Failed to delete quadrant position",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
};
