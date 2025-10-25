import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserForApi } from '$lib/server/auth/index.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { handleApiError } from '$lib/server/api-utils.js';
import {
  getScorecardWithDatasources,
  updateScorecard,
  deleteScorecard
} from '$lib/server/repositories/scorecard.js';

// GET /api/series/[seriesId]/scorecards/[id] - Get scorecard with datasources
export const GET: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const seriesId = event.params.seriesId;
    const scorecardId = event.params.id;

    // Check user has access to series
    const userRole = await getUserRoleInSeries(user.userId, seriesId);
    if (!userRole) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const scorecard = await getScorecardWithDatasources(scorecardId);

    if (!scorecard) {
      return json(
        { success: false, error: 'Scorecard not found' },
        { status: 404 }
      );
    }

    // Verify scorecard belongs to this series
    if (scorecard.seriesId !== seriesId) {
      return json(
        { success: false, error: 'Scorecard not found' },
        { status: 404 }
      );
    }

    return json({
      success: true,
      scorecard
    });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch scorecard');
  }
};

// PUT /api/series/[seriesId]/scorecards/[id] - Update scorecard
export const PUT: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const seriesId = event.params.seriesId;
    const scorecardId = event.params.id;
    const body = await event.request.json();

    // Check user has access to series (must be admin or facilitator)
    const userRole = await getUserRoleInSeries(user.userId, seriesId);
    if (!userRole || userRole === 'member') {
      return json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Verify scorecard exists and belongs to this series
    const existing = await getScorecardWithDatasources(scorecardId);
    if (!existing || existing.seriesId !== seriesId) {
      return json(
        { success: false, error: 'Scorecard not found' },
        { status: 404 }
      );
    }

    const scorecard = await updateScorecard(scorecardId, {
      name: body.name,
      description: body.description
    });

    return json({
      success: true,
      scorecard
    });
  } catch (error) {
    return handleApiError(error, 'Failed to update scorecard');
  }
};

// DELETE /api/series/[seriesId]/scorecards/[id] - Delete scorecard
export const DELETE: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const seriesId = event.params.seriesId;
    const scorecardId = event.params.id;

    // Check user has access to series (must be admin or facilitator)
    const userRole = await getUserRoleInSeries(user.userId, seriesId);
    if (!userRole || userRole === 'member') {
      return json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Verify scorecard exists and belongs to this series
    const existing = await getScorecardWithDatasources(scorecardId);
    if (!existing || existing.seriesId !== seriesId) {
      return json(
        { success: false, error: 'Scorecard not found' },
        { status: 404 }
      );
    }

    await deleteScorecard(scorecardId);

    return json({
      success: true
    });
  } catch (error) {
    return handleApiError(error, 'Failed to delete scorecard');
  }
};
