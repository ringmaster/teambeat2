import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserForApi } from '$lib/server/auth/index.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { handleApiError } from '$lib/server/api-utils.js';
import { findScorecardById } from '$lib/server/repositories/scorecard.js';
import {
  findDatasourceById,
  updateDatasource,
  deleteDatasource
} from '$lib/server/repositories/scorecard-datasource.js';

// GET /api/scorecards/[scorecardId]/datasources/[id] - Get datasource
export const GET: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const scorecardId = event.params.scorecardId;
    const datasourceId = event.params.id;

    // Get scorecard to check series access
    const scorecard = await findScorecardById(scorecardId);
    if (!scorecard) {
      return json(
        { success: false, error: 'Scorecard not found' },
        { status: 404 }
      );
    }

    // Check user has access
    const userRole = await getUserRoleInSeries(user.userId, scorecard.seriesId);
    if (!userRole) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const datasource = await findDatasourceById(datasourceId);

    if (!datasource || datasource.scorecardId !== scorecardId) {
      return json(
        { success: false, error: 'Datasource not found' },
        { status: 404 }
      );
    }

    return json({
      success: true,
      datasource
    });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch datasource');
  }
};

// PUT /api/scorecards/[scorecardId]/datasources/[id] - Update datasource
export const PUT: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const scorecardId = event.params.scorecardId;
    const datasourceId = event.params.id;
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

    // Verify datasource exists and belongs to scorecard
    const existing = await findDatasourceById(datasourceId);
    if (!existing || existing.scorecardId !== scorecardId) {
      return json(
        { success: false, error: 'Datasource not found' },
        { status: 404 }
      );
    }

    const datasource = await updateDatasource(datasourceId, {
      name: body.name,
      dataSchema: body.data_schema,
      rules: body.rules,
      apiConfig: body.api_config
    });

    return json({
      success: true,
      datasource
    });
  } catch (error) {
    return handleApiError(error, 'Failed to update datasource');
  }
};

// DELETE /api/scorecards/[scorecardId]/datasources/[id] - Delete datasource
export const DELETE: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const scorecardId = event.params.scorecardId;
    const datasourceId = event.params.id;

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

    // Verify datasource exists and belongs to scorecard
    const existing = await findDatasourceById(datasourceId);
    if (!existing || existing.scorecardId !== scorecardId) {
      return json(
        { success: false, error: 'Datasource not found' },
        { status: 404 }
      );
    }

    await deleteDatasource(datasourceId);

    return json({
      success: true
    });
  } catch (error) {
    return handleApiError(error, 'Failed to delete datasource');
  }
};
