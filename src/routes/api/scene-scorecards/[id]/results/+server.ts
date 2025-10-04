import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { handleApiError } from '$lib/server/api-utils.js';
import { findSceneById } from '$lib/server/repositories/scene.js';
import {
  findSceneScorecardById,
  getSceneScorecardResults
} from '$lib/server/repositories/scene-scorecard.js';

// GET /api/scene-scorecards/[id]/results - Get processed results
export const GET: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const sceneScorecardId = event.params.id;

    // Get scene scorecard to verify it exists
    const sceneScorecard = await findSceneScorecardById(sceneScorecardId);
    if (!sceneScorecard) {
      return json(
        { success: false, error: 'Scene scorecard not found' },
        { status: 404 }
      );
    }

    // Get scene to check series access
    const scene = await findSceneById(sceneScorecard.sceneId);
    if (!scene) {
      return json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      );
    }

    // Check user has access to series
    const userRole = await getUserRoleInSeries(user.userId, scene.seriesId);
    if (!userRole) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const results = await getSceneScorecardResults(sceneScorecardId);

    return json({
      success: true,
      results,
      processedAt: sceneScorecard.processedAt,
      collectedData: sceneScorecard.collectedData
    });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch scorecard results');
  }
};
