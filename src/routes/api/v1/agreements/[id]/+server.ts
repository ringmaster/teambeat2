import { json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { requireSeriesMember } from "$lib/server/api/v1-access.js";
import { db } from "$lib/server/db/index.js";
import { agreements, boards } from "$lib/server/db/schema.js";
import {
	findAgreementById,
	setAgreementCompletion,
	updateAgreement,
} from "$lib/server/repositories/agreement.js";
import { getBoardWithDetails } from "$lib/server/repositories/board.js";
import { broadcastAgreementsUpdated } from "$lib/server/sse/broadcast.js";
import { buildEnrichedAgreementsData } from "$lib/server/utils/agreements-data.js";
import type { RequestHandler } from "./$types";

const patchAgreementSchema = z.object({
	content: z.string().min(1).max(1000).optional(),
	completed: z.boolean().optional(),
});

export const PATCH: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const agreementId = event.params.id;

		const agreement = await findAgreementById(agreementId);
		if (!agreement) return json({ success: false, error: "Agreement not found" }, { status: 404 });

		// Get board to find seriesId
		const [boardRow] = await db
			.select({ seriesId: boards.seriesId })
			.from(boards)
			.where(eq(boards.id, agreement.boardId))
			.limit(1);
		if (!boardRow) return json({ success: false, error: "Board not found" }, { status: 404 });

		const member = await requireSeriesMember(user.userId, boardRow.seriesId);
		if (!member || (member.role !== "admin" && member.role !== "facilitator"))
			return json({ success: false, error: "Only facilitators and admins can update agreements" }, { status: 403 });

		const body = await event.request.json();
		const data = patchAgreementSchema.parse(body);

		let updated;
		if (data.completed !== undefined) {
			updated = await setAgreementCompletion(agreementId, data.completed, user.userId);
		}
		if (data.content !== undefined) {
			updated = await updateAgreement(agreementId, { content: data.content });
		}
		if (!updated) updated = agreement;

		// Broadcast updated agreements list
		const board = await getBoardWithDetails(agreement.boardId);
		if (board) {
			const enriched = await buildEnrichedAgreementsData(agreement.boardId, board);
			broadcastAgreementsUpdated(agreement.boardId, enriched);
		}

		return json({ success: true, agreement: updated });
	} catch (err) {
		if (err instanceof Response) throw err;
		if (err instanceof z.ZodError)
			return json({ success: false, error: "Invalid input", details: err.errors }, { status: 400 });
		return json({ success: false, error: "Failed to update agreement" }, { status: 500 });
	}
};
