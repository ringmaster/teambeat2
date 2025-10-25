import { json } from "@sveltejs/kit";
import { handleApiError } from "$lib/server/api-utils.js";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { getUserRoleInSeries } from "$lib/server/repositories/board-series.js";
import {
	createScorecard,
	findScorecardsBySeries,
} from "$lib/server/repositories/scorecard.js";
import type { RequestHandler } from "./$types";

// GET /api/series/[seriesId]/scorecards - List all scorecards in series
export const GET: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const seriesId = event.params.seriesId;

		// Check user has access to series
		const userRole = await getUserRoleInSeries(user.userId, seriesId);
		if (!userRole) {
			return json({ success: false, error: "Access denied" }, { status: 403 });
		}

		const scorecards = await findScorecardsBySeries(seriesId);

		return json({
			success: true,
			scorecards,
		});
	} catch (error) {
		return handleApiError(error, "Failed to fetch scorecards");
	}
};

// POST /api/series/[seriesId]/scorecards - Create new scorecard
export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const seriesId = event.params.seriesId;
		const body = await event.request.json();

		// Check user has access to series (must be admin or facilitator)
		const userRole = await getUserRoleInSeries(user.userId, seriesId);
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

		const scorecard = await createScorecard({
			seriesId,
			name: body.name,
			description: body.description,
			createdByUserId: user.userId,
		});

		return json(
			{
				success: true,
				scorecard,
			},
			{ status: 201 },
		);
	} catch (error) {
		return handleApiError(error, "Failed to create scorecard");
	}
};
