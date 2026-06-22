import { json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { requireSeriesMember } from "$lib/server/api/v1-access.js";
import { db } from "$lib/server/db/index.js";
import { boards, cards, columns } from "$lib/server/db/schema.js";
import { getCardById, updateCard } from "$lib/server/repositories/card.js";
import { getBoardWithDetails } from "$lib/server/repositories/board.js";
import { broadcastCardUpdated } from "$lib/server/sse/broadcast.js";
import { enrichCardWithCounts } from "$lib/server/utils/cards-data.js";
import { getCurrentScene, getSceneCapability } from "$lib/utils/scene-capability.js";
import type { RequestHandler } from "./$types";

const patchCardSchema = z.object({
	content: z.string().min(1).max(1000).optional(),
	notes: z.string().max(5000).optional().nullable(),
});

export const PATCH: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const cardId = event.params.id;

		const body = await event.request.json();
		const data = patchCardSchema.parse(body);

		// Get card + board context
		const [cardData] = await db
			.select({ card: cards, boardId: boards.id, seriesId: boards.seriesId })
			.from(cards)
			.innerJoin(columns, eq(cards.columnId, columns.id))
			.innerJoin(boards, eq(columns.boardId, boards.id))
			.where(eq(cards.id, cardId));

		if (!cardData) return json({ success: false, error: "Card not found" }, { status: 404 });

		const member = await requireSeriesMember(user.userId, cardData.seriesId);
		if (!member) return json({ success: false, error: "Access denied" }, { status: 403 });

		const board = await getBoardWithDetails(cardData.boardId);
		if (!board) return json({ success: false, error: "Board not found" }, { status: 404 });

		const currentScene = getCurrentScene(board.scenes, board.currentSceneId);
		if (!getSceneCapability(currentScene, board.status, "allow_edit_cards"))
			return json({ success: false, error: "Editing cards not allowed in current scene" }, { status: 403 });

		const updatedCard = await updateCard(cardId, data);
		const enrichedCard = await enrichCardWithCounts(updatedCard);
		broadcastCardUpdated(cardData.boardId, enrichedCard);

		return json({ success: true, card: enrichedCard });
	} catch (err) {
		if (err instanceof Response) throw err;
		if (err instanceof z.ZodError)
			return json({ success: false, error: "Invalid input", details: err.errors }, { status: 400 });
		return json({ success: false, error: "Failed to update card" }, { status: 500 });
	}
};
