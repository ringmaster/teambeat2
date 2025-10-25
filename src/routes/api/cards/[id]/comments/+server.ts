import { json } from "@sveltejs/kit";
import { and, desc, eq } from "drizzle-orm";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { db } from "$lib/server/db";
import { boards, cards, columns, comments, users } from "$lib/server/db/schema";
import { getUserDisplayName } from "$lib/utils/animalNames";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const cardId = event.params.id;

		// Get card with board info to verify it exists and user has access
		const [cardData] = await db
			.select({
				card: cards,
				column: columns,
				board: boards,
			})
			.from(cards)
			.innerJoin(columns, eq(cards.columnId, columns.id))
			.innerJoin(boards, eq(columns.boardId, boards.id))
			.where(eq(cards.id, cardId));

		if (!cardData) {
			return json({ success: false, error: "Card not found" }, { status: 404 });
		}

		// Get all comments for this card with user information
		const cardComments = await db
			.select({
				comment: comments,
				user: users,
			})
			.from(comments)
			.leftJoin(users, eq(comments.userId, users.id))
			.where(eq(comments.cardId, cardId))
			.orderBy(desc(comments.createdAt));

		// Transform comments to include display names
		const transformedComments = cardComments.map((item) => {
			const realUserName =
				item.user?.name || item.user?.email || "Unknown User";
			const displayUserName = getUserDisplayName(
				realUserName,
				cardData.board.id,
				cardData.board.blameFreeMode || false,
			);

			return {
				...item.comment,
				userName: displayUserName,
				userEmail: cardData.board.blameFreeMode ? null : item.user?.email,
			};
		});

		return json({
			success: true,
			comments: transformedComments,
			card: {
				id: cardData.card.id,
				content: cardData.card.content,
			},
		});
	} catch (error) {
		console.error("Failed to get comments:", error);
		return json(
			{ success: false, error: "Failed to get comments" },
			{ status: 500 },
		);
	}
};
