import { error } from "@sveltejs/kit";
import { requireUser } from "$lib/server/auth/index.js";
import { getUserRoleInSeries } from "$lib/server/repositories/board-series.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const seriesId = event.params.seriesId;

	// Get user's role in this series
	const userRole = await getUserRoleInSeries(user.userId, seriesId);

	if (!userRole || userRole !== "admin") {
		throw error(403, "Only series administrators can access scorecards");
	}

	return {
		seriesId,
		canEdit: true,
	};
};
