import { json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { db } from "$lib/server/db";
import { cards, columns, users } from "$lib/server/db/schema";
import { acquireNotesLock } from "$lib/server/notes-lock.js";
import { broadcastUpdatePresentation } from "$lib/server/sse/broadcast.js";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const { id: cardId } = event.params;

		if (!cardId) {
			return json(
				{
					success: false,
					error: "Card ID is required",
				},
				{ status: 400 },
			);
		}

		// Get user name for lock display
		let userName = user.email;
		try {
			const userData = await db
				.select({ name: users.name })
				.from(users)
				.where(eq(users.id, user.userId))
				.limit(1);

			userName = userData[0]?.name || user.email;
		} catch (dbError) {
			console.warn("Could not fetch user name, using email:", dbError);
		}

		const result = acquireNotesLock(cardId, user.userId, userName);

		// Get board ID for broadcasting and present mode data
		const cardWithBoard = await db
			.select({ boardId: columns.boardId })
			.from(cards)
			.innerJoin(columns, eq(cards.columnId, columns.id))
			.where(eq(cards.id, cardId))
			.limit(1);

		if (cardWithBoard.length === 0) {
			return json(
				{
					success: false,
					error: "Card not found",
				},
				{ status: 404 },
			);
		}

		const boardId = cardWithBoard[0].boardId;

		if (result.success) {
			// Broadcast the presentation update with lock status change
			await broadcastUpdatePresentation(boardId, {
				card_id: cardId,
			});

			// Get present mode data to return with response (only if board is in present mode)
			let presentModeData = null;
			try {
				const { buildPresentModeData } = await import(
					"$lib/server/utils/present-mode-data.js"
				);
				presentModeData = await buildPresentModeData(boardId, user.userId);
			} catch (error) {
				console.warn(
					"Could not build present mode data:",
					error instanceof Error ? error.message : "Unknown error",
				);
			}

			return json({
				success: true,
				present_mode_data: presentModeData,
			});
		} else {
			// Lock is held by someone else - return 403 with complete information
			let presentModeData = null;
			try {
				const { buildPresentModeData } = await import(
					"$lib/server/utils/present-mode-data.js"
				);
				presentModeData = await buildPresentModeData(boardId, user.userId);
			} catch (error) {
				console.warn(
					"Could not build present mode data:",
					error instanceof Error ? error.message : "Unknown error",
				);
			}

			return json(
				{
					success: false,
					locked_by: result.lockedBy,
					expires_at: result.expiresAt,
					present_mode_data: presentModeData,
				},
				{ status: 403 },
			);
		}
	} catch (error) {
		console.error("Error acquiring notes lock:", error);
		return json(
			{
				success: false,
				error: "Failed to acquire notes lock",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const { id: cardId } = event.params;

		const { releaseNotesLock } = await import("$lib/server/notes-lock.js");
		const released = releaseNotesLock(cardId, user.userId);

		if (released) {
			// Get board ID to broadcast the lock release
			const cardWithBoard = await db
				.select({ boardId: columns.boardId })
				.from(cards)
				.innerJoin(columns, eq(cards.columnId, columns.id))
				.where(eq(cards.id, cardId))
				.limit(1);

			if (cardWithBoard.length > 0) {
				// Broadcast the presentation update with lock status change
				await broadcastUpdatePresentation(cardWithBoard[0].boardId, {
					card_id: cardId,
				});
			}
		}

		return json({ success: released });
	} catch (error) {
		console.error("Error releasing notes lock:", error);
		return json(
			{
				success: false,
				error: "Failed to release notes lock",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
};
