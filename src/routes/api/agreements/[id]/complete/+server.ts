import { json } from "@sveltejs/kit";
import { z } from "zod";
import { handleApiError } from "$lib/server/api-utils.js";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { refreshPresenceOnBoardAction } from "$lib/server/middleware/presence.js";
import {
	findAgreementById,
	setAgreementCompletion,
} from "$lib/server/repositories/agreement.js";
import { getBoardWithDetails } from "$lib/server/repositories/board.js";
import { getUserRoleInSeries } from "$lib/server/repositories/board-series.js";
import { broadcastAgreementsUpdated } from "$lib/server/sse/broadcast.js";
import { buildEnrichedAgreementsData } from "$lib/server/utils/agreements-data.js";
import { featureTracker } from "$lib/server/analytics/feature-tracker.js";
import type { RequestHandler } from "./$types";

const completeAgreementSchema = z.object({
	completed: z.boolean(),
});

export const PUT: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const agreementId = event.params.id;
		const body = await event.request.json();
		const data = completeAgreementSchema.parse(body);

		const agreement = await findAgreementById(agreementId);
		if (!agreement) {
			return json(
				{ success: false, error: "Agreement not found" },
				{ status: 404 },
			);
		}

		await refreshPresenceOnBoardAction(event);

		const board = await getBoardWithDetails(agreement.boardId);
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
					error: "Only facilitators and admins can mark agreements as complete",
				},
				{ status: 403 },
			);
		}

		const updatedAgreement = await setAgreementCompletion(
			agreementId,
			data.completed,
			user.userId,
		);

		// Track feature usage
		featureTracker.trackFeature('agreements', data.completed ? 'completed' : 'uncompleted', user.userId, {
			boardId: agreement.boardId,
			metadata: { agreementId }
		});

		// Broadcast updated agreements list to all clients
		const agreements = await buildEnrichedAgreementsData(
			agreement.boardId,
			board,
		);
		broadcastAgreementsUpdated(agreement.boardId, agreements);

		const updatedEnrichedAgreement = agreements.find(
			(a) => a.id === agreementId,
		);

		return json({
			success: true,
			agreement: updatedEnrichedAgreement || updatedAgreement,
		});
	} catch (error) {
		return handleApiError(
			error,
			"Failed to update agreement completion status",
		);
	}
};
