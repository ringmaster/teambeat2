import { json } from "@sveltejs/kit";
import { z } from "zod";
import { handleApiError } from "$lib/server/api-utils.js";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { refreshPresenceOnBoardAction } from "$lib/server/middleware/presence.js";
import {
	createAgreement,
	findAgreementsByBoardId,
	findCommentAgreementsByColumns,
} from "$lib/server/repositories/agreement.js";
import { getBoardWithDetails } from "$lib/server/repositories/board.js";
import { getUserRoleInSeries } from "$lib/server/repositories/board-series.js";
import { broadcastAgreementsUpdated } from "$lib/server/sse/broadcast.js";
import { buildEnrichedAgreementsData } from "$lib/server/utils/agreements-data.js";
import type { RequestHandler } from "./$types";

const createAgreementSchema = z.object({
	content: z.string().min(1).max(1000),
});

export const GET: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const boardId = event.params.id;

		await refreshPresenceOnBoardAction(event);

		const board = await getBoardWithDetails(boardId);
		if (!board) {
			return json(
				{ success: false, error: "Board not found" },
				{ status: 404 },
			);
		}

		const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
		if (!userRole) {
			return json({ success: false, error: "Access denied" }, { status: 403 });
		}

		const agreements = await buildEnrichedAgreementsData(boardId, board);

		return json({
			success: true,
			agreements,
		});
	} catch (error) {
		return handleApiError(error, "Failed to fetch agreements");
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const boardId = event.params.id;
		const body = await event.request.json();
		const data = createAgreementSchema.parse(body);

		await refreshPresenceOnBoardAction(event);

		const board = await getBoardWithDetails(boardId);
		if (!board) {
			return json(
				{ success: false, error: "Board not found" },
				{ status: 404 },
			);
		}

		const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
		if (!userRole || (userRole !== "admin" && userRole !== "facilitator")) {
			return json(
				{
					success: false,
					error: "Only facilitators and admins can create agreements",
				},
				{ status: 403 },
			);
		}

		const agreement = await createAgreement({
			boardId,
			userId: user.userId,
			content: data.content,
		});

		// Broadcast updated agreements list to all clients
		const agreements = await buildEnrichedAgreementsData(boardId, board);
		broadcastAgreementsUpdated(boardId, agreements);

		return json({
			success: true,
			agreement,
		});
	} catch (error) {
		return handleApiError(error, "Failed to create agreement");
	}
};
