import { json } from "@sveltejs/kit";
import { handleApiError } from "$lib/server/api-utils.js";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { getUserRoleInSeries } from "$lib/server/repositories/board-series.js";
import { findSceneById } from "$lib/server/repositories/scene.js";
import {
	attachScorecardToScene,
	findSceneScorecardsByScene,
} from "$lib/server/repositories/scene-scorecard.js";
import { broadcastScorecardAttached } from "$lib/server/sse/broadcast.js";
import type { RequestHandler } from "./$types";

// GET /api/scenes/[sceneId]/scorecards - List scorecards attached to scene
export const GET: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const sceneId = event.params.sceneId;

		// Get scene to check series access
		const scene = await findSceneById(sceneId);
		if (!scene) {
			return json(
				{ success: false, error: "Scene not found" },
				{ status: 404 },
			);
		}

		// Check user has access to series
		const userRole = await getUserRoleInSeries(user.userId, scene.seriesId);
		if (!userRole) {
			return json({ success: false, error: "Access denied" }, { status: 403 });
		}

		const sceneScorecards = await findSceneScorecardsByScene(sceneId);

		return json({
			success: true,
			sceneScorecards,
		});
	} catch (error) {
		return handleApiError(error, "Failed to fetch scene scorecards");
	}
};

// POST /api/scenes/[sceneId]/scorecards/attach - Attach scorecard to scene
export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const sceneId = event.params.sceneId;
		const body = await event.request.json();

		// Get scene to check series access
		const scene = await findSceneById(sceneId);
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

		// Validate input
		if (!body.scorecard_id || typeof body.scorecard_id !== "string") {
			return json(
				{ success: false, error: "scorecard_id is required" },
				{ status: 400 },
			);
		}

		const sceneScorecard = await attachScorecardToScene(
			sceneId,
			body.scorecard_id,
		);

		// Broadcast to board users
		broadcastScorecardAttached(scene.boardId, sceneScorecard);

		return json(
			{
				success: true,
				sceneScorecard,
			},
			{ status: 201 },
		);
	} catch (error) {
		return handleApiError(error, "Failed to attach scorecard to scene");
	}
};
