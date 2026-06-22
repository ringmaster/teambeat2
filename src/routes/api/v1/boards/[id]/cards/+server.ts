import { json } from "@sveltejs/kit";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { getBoardSeriesForUser } from "$lib/server/api/v1-access.js";
import { db } from "$lib/server/db/index.js";
import { cards, columns } from "$lib/server/db/schema.js";
import { getBoardWithDetails } from "$lib/server/repositories/board.js";
import { createCard } from "$lib/server/repositories/card.js";
import { broadcastCardCreated } from "$lib/server/sse/broadcast.js";
import { enrichCardWithCounts } from "$lib/server/utils/cards-data.js";
import { getCurrentScene, getSceneCapability } from "$lib/utils/scene-capability.js";
import type { RequestHandler } from "./$types";

const createCardSchema = z.object({
	columnId: z.string().uuid(),
	content: z.string().min(1).max(1000),
	notes: z.string().max(5000).optional(),
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

		const result = await db
			.select({
				id: cards.id,
				columnId: cards.columnId,
				columnTitle: columns.title,
				content: cards.content,
				notes: cards.notes,
				groupId: cards.groupId,
				isGroupLead: cards.isGroupLead,
				seq: cards.seq,
				voteCount: sql<number>`(SELECT COUNT(*) FROM votes WHERE votes.card_id = ${cards.id})`,
				commentCount: sql<number>`(SELECT COUNT(*) FROM comments WHERE comments.card_id = ${cards.id} AND comments.is_reaction = 0)`,
				createdAt: cards.createdAt,
			})
			.from(cards)
			.innerJoin(columns, eq(columns.id, cards.columnId))
			.where(eq(columns.boardId, boardId))
			.orderBy(cards.seq, cards.createdAt);

		return json({ success: true, cards: result });
	} catch (err) {
		if (err instanceof Response) throw err;
		return json({ success: false, error: "Failed to fetch cards" }, { status: 500 });
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

		const body = await event.request.json();
		const data = createCardSchema.parse(body);

		const board = await getBoardWithDetails(boardId);
		if (!board) return json({ success: false, error: "Board not found" }, { status: 404 });

		const currentScene = getCurrentScene(board.scenes, board.currentSceneId);
		if (!getSceneCapability(currentScene, board.status, "allow_add_cards")) {
			return json(
				{ success: false, error: "Adding cards not allowed in current scene" },
				{ status: 403 },
			);
		}

		const card = await createCard({ ...data, userId: user.userId });
		const enrichedCard = await enrichCardWithCounts(card);
		broadcastCardCreated(boardId, enrichedCard);

		return json({ success: true, card: enrichedCard }, { status: 201 });
	} catch (err) {
		if (err instanceof Response) throw err;
		return json({ success: false, error: "Failed to create card" }, { status: 500 });
	}
};
