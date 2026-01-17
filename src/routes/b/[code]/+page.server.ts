import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { requireUser } from "$lib/server/auth";
import {
	addUserToSeries,
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
		throw redirect(303, "/");
	}

	// Check user has access to this series, auto-add if not
	let userRole = await getUserRoleInSeries(user.userId, series.id);
	if (!userRole) {
		// Auto-add user as member when they use the series link
		await addUserToSeries(series.id, user.userId, "member");
		userRole = "member";
	}

	// Find current active board
	const board = await findCurrentActiveBoard(series.id);
	if (!board) {
		// No active board - redirect to home page
		throw redirect(303, "/");
	}

	throw redirect(303, `/board/${board.id}`);
};
