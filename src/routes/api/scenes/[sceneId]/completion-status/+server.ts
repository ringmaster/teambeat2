import { json } from "@sveltejs/kit";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { checkUserSurveyCompletion } from "$lib/server/repositories/health.js";
import { findSceneById } from "$lib/server/repositories/scene.js";
import type { RequestHandler } from "./$types";

/**
 * GET /api/scenes/[sceneId]/completion-status
 * Returns the user's survey completion status and continuation availability
 */
export const GET: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const sceneId = event.params.sceneId;

		const scene = await findSceneById(sceneId);
		if (!scene) {
			return json(
				{ success: false, error: "Scene not found" },
				{ status: 404 },
			);
		}

		// Check if this is a survey scene
		if (scene.mode !== "survey") {
			return json(
				{ success: false, error: "Scene is not a survey" },
				{ status: 400 },
			);
		}

		// Get completion status
		const completionStatus = await checkUserSurveyCompletion(
			sceneId,
			user.userId,
		);

		// Determine if continuation is available
		const continuationAvailable =
			completionStatus.completed &&
			scene.continuationEnabled &&
			scene.continuationSceneId != null;

		// Get continuation scene details if available
		let continuationSceneTitle: string | null = null;
		if (continuationAvailable && scene.continuationSceneId) {
			const continuationScene = await findSceneById(scene.continuationSceneId);
			if (continuationScene) {
				continuationSceneTitle = continuationScene.title;
			}
		}

		return json({
			success: true,
			completed: completionStatus.completed,
			totalQuestions: completionStatus.totalQuestions,
			answeredQuestions: completionStatus.answeredQuestions,
			continuationAvailable,
			continuationSceneId: scene.continuationSceneId,
			continuationSceneTitle,
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}

		console.error("Error checking completion status:", error);
		return json(
			{
				success: false,
				error: "Failed to check completion status",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
};
