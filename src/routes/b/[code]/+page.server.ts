import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { requireUser } from "$lib/server/auth";
import {
	findSeriesByShortCode,
	getUserRoleInSeries,
} from "$lib/server/repositories/board-series";
import { findCurrentActiveBoard } from "$lib/server/repositories/board";

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const { code } = event.params;

	// Decode short code to find series
	const series = await findSeriesByShortCode(code);
	if (!series) {
		throw redirect(303, "/dashboard");
	}

	// Check user has access to this series
	const userRole = await getUserRoleInSeries(user.userId, series.id);
	if (!userRole) {
		throw redirect(303, "/dashboard");
	}

	// Find current active board
	const board = await findCurrentActiveBoard(series.id);
	if (!board) {
		throw redirect(303, "/dashboard");
	}

	throw redirect(303, `/board/${board.id}`);
};
