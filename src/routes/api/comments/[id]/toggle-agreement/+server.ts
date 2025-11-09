import { json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { db } from "$lib/server/db";
import {
	boards,
	cards,
	columns,
	comments,
	seriesMembers,
} from "$lib/server/db/schema";
import { broadcastUpdatePresentation } from "$lib/server/sse/broadcast.js";
import { featureTracker } from "$lib/server/analytics/feature-tracker.js";
import type { RequestHandler } from "./$types";

export const PUT: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const { id: commentId } = event.params;
		const { is_agreement } = await event.request.json();

		// Get comment with card and board info
		const [commentData] = await db
			.select({
				comment: comments,
				card: cards,
				column: columns,
				board: boards,
			})
			.from(comments)
			.innerJoin(cards, eq(comments.cardId, cards.id))
			.innerJoin(columns, eq(cards.columnId, columns.id))
			.innerJoin(boards, eq(columns.boardId, boards.id))
			.where(eq(comments.id, commentId));

		if (!commentData) {
			return json(
				{ success: false, error: "Comment not found" },
				{ status: 404 },
			);
		}

		// Check if user is admin or facilitator in the series
		const [membership] = await db
			.select()
			.from(seriesMembers)
			.where(
				and(
					eq(seriesMembers.seriesId, commentData.board.seriesId),
					eq(seriesMembers.userId, user.userId),
				),
			);

		if (
			!membership ||
			(membership.role !== "admin" && membership.role !== "facilitator")
		) {
			return json(
				{
					success: false,
					error: "Only admins and facilitators can promote/demote comments",
				},
				{ status: 403 },
			);
		}

		// Update the comment's is_agreement field
		const [updated] = await db
			.update(comments)
			.set({ isAgreement: is_agreement })
			.where(eq(comments.id, commentId))
			.returning();

		// Track feature usage
		featureTracker.trackFeature('agreements', is_agreement ? 'promoted' : 'demoted', user.userId, {
			boardId: commentData.board.id,
			metadata: { commentId, cardId: commentData.card.id }
		});

		// Broadcast the change to all users
		await broadcastUpdatePresentation(commentData.board.id, {
			comment_id: commentId,
			is_agreement: is_agreement,
			card_id: commentData.card.id,
		});

		return json({
			success: true,
			comment: updated,
		});
	} catch (error) {
		console.error("Error toggling comment agreement:", error);
		return json(
			{
				success: false,
				error: "Failed to toggle comment agreement",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
};
