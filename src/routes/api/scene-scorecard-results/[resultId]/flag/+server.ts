import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { handleApiError } from '$lib/server/api-utils.js';
import { findSceneById } from '$lib/server/repositories/scene.js';
import {
  findSceneScorecardById,
  flagResultForDiscussion
} from '$lib/server/repositories/scene-scorecard.js';
import { db } from '$lib/server/db/index.js';
import { sceneScorecardResults } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { broadcastScorecardResultFlagged } from '$lib/server/sse/broadcast.js';

// POST /api/scene-scorecard-results/[resultId]/flag - Flag result for discussion
export const POST: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const resultId = event.params.resultId;
    const body = await event.request.json();

    // Get result to verify it exists
    const result = await db.select()
      .from(sceneScorecardResults)
      .where(eq(sceneScorecardResults.id, resultId))
      .limit(1);

    if (result.length === 0) {
      return json(
        { success: false, error: 'Result not found' },
        { status: 404 }
      );
    }

    // Get scene scorecard
    const sceneScorecard = await findSceneScorecardById(result[0].sceneScorecardId);
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

    // Validate input
    if (!body.card_id || typeof body.card_id !== 'string') {
      return json(
        { success: false, error: 'card_id is required' },
        { status: 400 }
      );
    }

    await flagResultForDiscussion(resultId, body.card_id);

    // Broadcast to board users
    broadcastScorecardResultFlagged(scene.boardId, resultId, body.card_id);

    return json({
      success: true
    });
  } catch (error) {
    return handleApiError(error, 'Failed to flag result for discussion');
  }
};
