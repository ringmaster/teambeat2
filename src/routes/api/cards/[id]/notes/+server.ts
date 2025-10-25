import { json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { db } from "$lib/server/db";
import { cards, columns } from "$lib/server/db/schema";
import { releaseNotesLock } from "$lib/server/notes-lock.js";
import { broadcastUpdatePresentation } from "$lib/server/sse/broadcast.js";
import type { RequestHandler } from "./$types";

export const PUT: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const { id: cardId } = event.params;
		const { content } = await event.request.json();

		// Update the card notes
		const [updated] = await db
			.update(cards)
			.set({ notes: content })
			.where(eq(cards.id, cardId))
			.returning();

		if (!updated) {
			return json({ success: false, error: "Card not found" }, { status: 404 });
		}

		// Release the lock after saving
		releaseNotesLock(cardId, user.userId);

		// Get board ID to broadcast the update
		const cardWithBoard = await db
			.select({ boardId: columns.boardId })
			.from(cards)
			.innerJoin(columns, eq(cards.columnId, columns.id))
			.where(eq(cards.id, cardId))
			.limit(1);

		if (cardWithBoard.length > 0) {
			const boardId = cardWithBoard[0].boardId;

			// Add small delay to ensure database changes are reflected
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Broadcast the presentation update with lock status change
			await broadcastUpdatePresentation(boardId, {
				card_id: cardId,
			});
		}

		return json({
			success: true,
			notes: updated.notes,
		});
	} catch (error) {
		console.error("Error updating card notes:", error);
		return json(
			{
				success: false,
				error: "Failed to update notes",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
};
