import { json } from "@sveltejs/kit";
import { handleApiError } from "$lib/server/api-utils.js";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { getUserRoleInSeries } from "$lib/server/repositories/board-series.js";
import { findScorecardById } from "$lib/server/repositories/scorecard.js";
import {
	createDatasource,
	findDatasourcesByScorecard,
} from "$lib/server/repositories/scorecard-datasource.js";
import type { RequestHandler } from "./$types";

// GET /api/scorecards/[scorecardId]/datasources - List datasources
export const GET: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const scorecardId = event.params.scorecardId;

		// Get scorecard to check series access
		const scorecard = await findScorecardById(scorecardId);
		if (!scorecard) {
			return json(
				{ success: false, error: "Scorecard not found" },
				{ status: 404 },
			);
		}

		// Check user has access to series
		const userRole = await getUserRoleInSeries(user.userId, scorecard.seriesId);
		if (!userRole) {
			return json({ success: false, error: "Access denied" }, { status: 403 });
		}

		const datasources = await findDatasourcesByScorecard(scorecardId);

		return json({
			success: true,
			datasources,
		});
	} catch (error) {
		return handleApiError(error, "Failed to fetch datasources");
	}
};

// POST /api/scorecards/[scorecardId]/datasources - Create datasource
export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const scorecardId = event.params.scorecardId;
		const body = await event.request.json();

		// Get scorecard to check series access
		const scorecard = await findScorecardById(scorecardId);
		if (!scorecard) {
			return json(
				{ success: false, error: "Scorecard not found" },
				{ status: 404 },
			);
		}

		// Check user has access to series (must be admin or facilitator)
		const userRole = await getUserRoleInSeries(user.userId, scorecard.seriesId);
		if (!userRole || userRole === "member") {
			return json(
				{ success: false, error: "Insufficient permissions" },
				{ status: 403 },
			);
		}

		// Validate input
		if (!body.name || typeof body.name !== "string") {
			return json(
				{ success: false, error: "Name is required" },
				{ status: 400 },
			);
		}

		if (!body.source_type || !["paste", "api"].includes(body.source_type)) {
			return json(
				{
					success: false,
					error: "Valid source_type is required (paste or api)",
				},
				{ status: 400 },
			);
		}

		if (!body.rules || !Array.isArray(body.rules)) {
			return json(
				{ success: false, error: "Rules array is required" },
				{ status: 400 },
			);
		}

		const datasource = await createDatasource({
			scorecardId,
			name: body.name,
			sourceType: body.source_type,
			dataSchema: body.data_schema,
			rules: body.rules,
			apiConfig: body.api_config,
		});

		return json(
			{
				success: true,
				datasource,
			},
			{ status: 201 },
		);
	} catch (error) {
		return handleApiError(error, "Failed to create datasource");
	}
};
