import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { handleApiError } from '$lib/server/api-utils.js';
import { findSceneById } from '$lib/server/repositories/scene.js';
import {
  findSceneScorecardById,
  detachScorecardFromScene
} from '$lib/server/repositories/scene-scorecard.js';
import { broadcastScorecardDetached } from '$lib/server/sse/broadcast.js';

// DELETE /api/scene-scorecards/[id] - Detach scorecard from scene
export const DELETE: RequestHandler = async (event) => {
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

    // Check user has access (must be admin or facilitator)
    const userRole = await getUserRoleInSeries(user.userId, scene.seriesId);
    if (!userRole || userRole === 'member') {
      return json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    await detachScorecardFromScene(sceneScorecardId);

    // Broadcast to board users
    broadcastScorecardDetached(scene.boardId, sceneScorecardId);

    return json({
      success: true
    });
  } catch (error) {
    return handleApiError(error, 'Failed to detach scene scorecard');
  }
};
