import { json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { handleApiError } from "$lib/server/api-utils.js";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { db } from "$lib/server/db/index.js";
import { cards, columns, comments, users } from "$lib/server/db/schema.js";
import { getBoardWithDetails } from "$lib/server/repositories/board.js";
import { getUserRoleInSeries } from "$lib/server/repositories/board-series.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const boardId = event.params.id;

		const board = await getBoardWithDetails(boardId);
		if (!board) {
			return json(
				{ success: false, error: "Board not found" },
				{ status: 404 },
			);
		}

		// Check if user has access to this board
		const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
		if (!userRole) {
			return json({ success: false, error: "Access denied" }, { status: 403 });
		}

		// Get all comments for cards in this board
		const boardComments = await db
			.select({
				id: comments.id,
				cardId: comments.cardId,
				userId: comments.userId,
				userName: users.name,
				content: comments.content,
				isAgreement: comments.isAgreement,
				isReaction: comments.isReaction,
				createdAt: comments.createdAt,
			})
			.from(comments)
			.innerJoin(cards, eq(comments.cardId, cards.id))
			.innerJoin(columns, eq(cards.columnId, columns.id))
			.leftJoin(users, eq(comments.userId, users.id))
			.where(eq(columns.boardId, boardId))
			.orderBy(comments.createdAt);

		return json({
			success: true,
			comments: boardComments,
		});
	} catch (error) {
		return handleApiError(error, "Failed to fetch comments");
	}
};
