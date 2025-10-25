import { json } from "@sveltejs/kit";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { getColumnsBySeriesId } from "$lib/server/repositories/board.js";
import { getUserRoleInSeries } from "$lib/server/repositories/board-series.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const seriesId = event.params.seriesId;
		const excludeBoardId = event.url.searchParams.get("excludeBoardId");

		if (!seriesId) {
			return json(
				{ success: false, error: "Series ID is required" },
				{ status: 400 },
			);
		}

		// Check if user has access to this series
		const userRole = await getUserRoleInSeries(user.userId, seriesId);
		if (!userRole) {
			return json({ success: false, error: "Access denied" }, { status: 403 });
		}

		const columns = await getColumnsBySeriesId(
			seriesId,
			excludeBoardId || undefined,
		);

		return json({
			success: true,
			columns,
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}

		console.error("Failed to fetch columns:", error);
		return json(
			{ success: false, error: "Failed to fetch columns" },
			{ status: 500 },
		);
	}
};
