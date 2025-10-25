import { json } from "@sveltejs/kit";
import { handleApiError } from "$lib/server/api-utils.js";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { getUserRoleInSeries } from "$lib/server/repositories/board-series.js";
import { findSceneById } from "$lib/server/repositories/scene.js";
import {
	collectDataAndProcess,
	findSceneScorecardById,
} from "$lib/server/repositories/scene-scorecard.js";
import { broadcastScorecardDataCollected } from "$lib/server/sse/broadcast.js";
import type { RequestHandler } from "./$types";

// POST /api/scene-scorecards/[id]/collect-data - Collect and process data
export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const sceneScorecardId = event.params.id;
		const body = await event.request.json();

		// Get scene scorecard to verify it exists
		const sceneScorecard = await findSceneScorecardById(sceneScorecardId);
		if (!sceneScorecard) {
			return json(
				{ success: false, error: "Scene scorecard not found" },
				{ status: 404 },
			);
		}

		// Get scene to check series access
		const scene = await findSceneById(sceneScorecard.sceneId);
		if (!scene) {
			return json(
				{ success: false, error: "Scene not found" },
				{ status: 404 },
			);
		}

		// Check user has access (must be admin or facilitator)
		const userRole = await getUserRoleInSeries(user.userId, scene.seriesId);
		if (!userRole || userRole === "member") {
			return json(
				{ success: false, error: "Insufficient permissions" },
				{ status: 403 },
			);
		}

		// Validate input - expects { datasource_data: { [datasourceId]: data } }
		if (!body.datasource_data || typeof body.datasource_data !== "object") {
			return json(
				{ success: false, error: "datasource_data object is required" },
				{ status: 400 },
			);
		}

		const result = await collectDataAndProcess(
			sceneScorecardId,
			body.datasource_data,
		);

		// Broadcast to board users
		broadcastScorecardDataCollected(
			scene.boardId,
			sceneScorecardId,
			result.processedAt,
			result.resultCount,
		);

		// Prepare client-friendly error messages
		const clientErrors = result.errors.map((error) => ({
			datasource: error.datasourceName,
			rule: error.ruleId,
			message: error.error,
			itemIndex: error.itemIndex,
		}));

		return json({
			success: true,
			processedAt: result.processedAt,
			resultCount: result.resultCount,
			errors: clientErrors.length > 0 ? clientErrors : undefined,
		});
	} catch (error) {
		return handleApiError(error, "Failed to collect and process data");
	}
};
