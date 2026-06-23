import { json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { getBoardSeriesForUser, requireSeriesMember } from "$lib/server/api/v1-access.js";
import { db } from "$lib/server/db/index.js";
import { agreements, users } from "$lib/server/db/schema.js";
import { createAgreement } from "$lib/server/repositories/agreement.js";
import { getBoardWithDetails } from "$lib/server/repositories/board.js";
import { broadcastAgreementsUpdated } from "$lib/server/sse/broadcast.js";
import { buildEnrichedAgreementsData } from "$lib/server/utils/agreements-data.js";
import type { RequestHandler } from "./$types";

const createAgreementSchema = z.object({
	content: z.string().min(1).max(1000),
});

export const GET: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const boardId = event.params.id;

		const access = await getBoardSeriesForUser(user.userId, boardId);
		if (access === "not_found")
			return json({ success: false, error: "Board not found" }, { status: 404 });
		if (access === "forbidden")
			return json({ success: false, error: "Access denied" }, { status: 403 });

		const completedParam = event.url.searchParams.get("completed");
		const completedFilter =
			completedParam === "true" ? true : completedParam === "false" ? false : null;

		const result = await db
			.select({
				id: agreements.id,
				content: agreements.content,
				completed: agreements.completed,
				createdAt: agreements.createdAt,
				completedAt: agreements.completedAt,
				completedByName: users.name,
			})
			.from(agreements)
			.leftJoin(users, eq(users.id, agreements.completedByUserId))
			.where(
				and(
					eq(agreements.boardId, boardId),
					completedFilter !== null ? eq(agreements.completed, completedFilter) : undefined,
				),
			)
			.orderBy(agreements.createdAt);

		return json({ success: true, agreements: result });
	} catch (err) {
		if (err instanceof Response) return err as Response;
		return json({ success: false, error: "Failed to fetch agreements" }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const boardId = event.params.id;

		const access = await getBoardSeriesForUser(user.userId, boardId);
		if (access === "not_found")
			return json({ success: false, error: "Board not found" }, { status: 404 });
		if (access === "forbidden")
			return json({ success: false, error: "Access denied" }, { status: 403 });

		const member = await requireSeriesMember(user.userId, access.seriesId);
		if (!member || (member.role !== "admin" && member.role !== "facilitator")) {
			return json(
				{ success: false, error: "Only facilitators and admins can create agreements" },
				{ status: 403 },
			);
		}

		const body = await event.request.json();
		const data = createAgreementSchema.parse(body);

		const agreement = await createAgreement({ boardId, userId: user.userId, content: data.content });

		const board = await getBoardWithDetails(boardId);
		if (board) {
			const enriched = await buildEnrichedAgreementsData(boardId, board);
			broadcastAgreementsUpdated(boardId, enriched);
		}

		return json({ success: true, agreement }, { status: 201 });
	} catch (err) {
		if (err instanceof Response) return err as Response;
		return json({ success: false, error: "Failed to create agreement" }, { status: 500 });
	}
};
