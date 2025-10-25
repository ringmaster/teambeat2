import { error } from "@sveltejs/kit";
import { requireUser } from "$lib/server/auth/index.js";
import { refreshPresenceOnBoardAction } from "$lib/server/middleware/presence.js";
import { findAgreementsByBoardId } from "$lib/server/repositories/agreement.js";
import { getBoardWithDetails } from "$lib/server/repositories/board.js";
import {
	addUserToSeries,
	getUserRoleInSeries,
} from "$lib/server/repositories/board-series.js";
import { getLastHealthCheckDate } from "$lib/server/repositories/health";
import { getScorecardCountsByBoard } from "$lib/server/repositories/scene-scorecard";
import { getTemplateList } from "$lib/server/templates.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	const { params, setHeaders } = event;

	// Set cache control headers to prevent aggressive caching of dynamic board data
	setHeaders({
		"cache-control": "private, no-cache, no-store, must-revalidate",
		expires: "0",
		pragma: "no-cache",
	});

	// Require authenticated user (throws redirect if not authenticated)
	const user = requireUser(event);

	// Update user presence on this board
	await refreshPresenceOnBoardAction(event);

	// Load board with full details
	const board = await getBoardWithDetails(params.id);
	if (!board) {
		throw error(404, "Board not found");
	}

	// Check if user has access to this board and get their role
	let userRole = await getUserRoleInSeries(user.userId, board.seriesId);
	if (!userRole) {
		// Only auto-add users to active boards
		if (board.status === "active") {
			await addUserToSeries(board.seriesId, user.userId, "member");
			userRole = "member";
		} else {
			// User not a member and board is not active
			throw error(404, "Board not found");
		}
	}

	// Non-admin/facilitator users cannot access draft boards
	if (
		board.status === "draft" &&
		!["admin", "facilitator"].includes(userRole)
	) {
		throw error(404, "Board not found");
	}

	// Load all necessary data in parallel
	const [agreements, templates, lastHealthCheckDate, scorecardCountsByScene] =
		await Promise.all([
			findAgreementsByBoardId(params.id),
			Promise.resolve(getTemplateList()),
			board.seriesId
				? getLastHealthCheckDate(board.seriesId)
				: Promise.resolve(null),
			getScorecardCountsByBoard(params.id),
		]);

	// Create page title
	const pageTitle = board.series
		? `${board.name} - ${board.series} - TeamBeat`
		: `${board.name} - TeamBeat`;

	// Create description for OpenGraph
	const description = "Collaborative team meetings for agile teams";

	return {
		board,
		cards: board.cards || [],
		agreements: agreements || [],
		templates: templates || [],
		user,
		userRole,
		lastHealthCheckDate,
		scorecardCountsByScene,
		pageTitle,
		description,
	};
};
