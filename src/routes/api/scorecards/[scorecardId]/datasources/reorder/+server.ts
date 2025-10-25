import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserForApi } from '$lib/server/auth/index.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { handleApiError } from '$lib/server/api-utils.js';
import { findScorecardById } from '$lib/server/repositories/scorecard.js';
import { reorderDatasources } from '$lib/server/repositories/scorecard-datasource.js';

// PUT /api/scorecards/[scorecardId]/datasources/reorder - Reorder datasources
export const PUT: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const scorecardId = event.params.scorecardId;
    const body = await event.request.json();

    // Get scorecard to check series access
    const scorecard = await findScorecardById(scorecardId);
    if (!scorecard) {
      return json(
        { success: false, error: 'Scorecard not found' },
        { status: 404 }
      );
    }

    // Check user has access (must be admin or facilitator)
    const userRole = await getUserRoleInSeries(user.userId, scorecard.seriesId);
    if (!userRole || userRole === 'member') {
      return json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Validate input
    if (!body.datasource_ids || !Array.isArray(body.datasource_ids)) {
      return json(
        { success: false, error: 'datasource_ids array is required' },
        { status: 400 }
      );
    }

    const datasources = await reorderDatasources(scorecardId, body.datasource_ids);

    return json({
      success: true,
      datasources
    });
  } catch (error) {
    return handleApiError(error, 'Failed to reorder datasources');
  }
};
