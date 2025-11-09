import { json } from "@sveltejs/kit";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { db } from "$lib/server/db";
import { boards, cards, columns, comments, users } from "$lib/server/db/schema";
import { getBoardWithDetails } from "$lib/server/repositories/board.js";
import {
	broadcastCardUpdated,
	broadcastUpdatePresentation,
} from "$lib/server/sse/broadcast.js";
import { enrichCardWithCounts } from "$lib/server/utils/cards-data.js";
import { getUserDisplayName } from "$lib/utils/animalNames";
import {
	getCurrentScene,
	getSceneCapability,
} from "$lib/utils/scene-capability.js";
import { featureTracker } from "$lib/server/analytics/feature-tracker.js";
import type { RequestHandler } from "./$types";

async function getCardCommentCounts(cardId: string) {
	// Get reaction counts grouped by emoji
	const reactionCounts = await db
		.select({
			emoji: comments.content,
			count: sql<number>`COUNT(*)`.as("count"),
		})
		.from(comments)
		.where(and(eq(comments.cardId, cardId), eq(comments.isReaction, true)))
		.groupBy(comments.content);

	// Get non-reaction comment count
	const [commentCount] = await db
		.select({
			count: sql<number>`COUNT(*)`.as("count"),
		})
		.from(comments)
		.where(and(eq(comments.cardId, cardId), eq(comments.isReaction, false)));

	return {
		reactions: reactionCounts.reduce(
			(acc, { emoji, count }) => {
				acc[emoji] = count;
				return acc;
			},
			{} as Record<string, number>,
		),
		commentCount: commentCount?.count || 0,
	};
}

export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const {
			card_id,
			content,
			is_agreement = false,
			is_reaction = false,
		} = await event.request.json();

		if (!content?.trim()) {
			return json(
				{ success: false, error: "Comment content is required" },
				{ status: 400 },
			);
		}

		// Get card with board info to verify it exists
		const [cardData] = await db
			.select({
				card: cards,
				column: columns,
				board: boards,
			})
			.from(cards)
			.innerJoin(columns, eq(cards.columnId, columns.id))
			.innerJoin(boards, eq(columns.boardId, boards.id))
			.where(eq(cards.id, card_id));

		if (!cardData) {
			return json({ success: false, error: "Card not found" }, { status: 404 });
		}

		// Get board with scenes to check scene capabilities
		const boardWithScenes = await getBoardWithDetails(cardData.board.id);
		if (!boardWithScenes) {
			return json(
				{ success: false, error: "Board not found" },
				{ status: 404 },
			);
		}

		// Check if current scene allows commenting
		const currentScene = getCurrentScene(
			boardWithScenes.scenes,
			boardWithScenes.currentSceneId,
		);
		if (
			!getSceneCapability(
				currentScene,
				boardWithScenes.status,
				"allow_comments",
			)
		) {
			return json(
				{
					success: false,
					error: "Adding comments not allowed in current scene",
				},
				{ status: 403 },
			);
		}

		// If this is a reaction, check if the user already has this reaction
		if (is_reaction) {
			const existingReaction = await db
				.select()
				.from(comments)
				.where(
					and(
						eq(comments.cardId, card_id),
						eq(comments.userId, user.userId),
						eq(comments.content, content.trim()),
						eq(comments.isReaction, true),
					),
				)
				.limit(1);

			if (existingReaction.length > 0) {
				// User already has this reaction, remove it
				await db
					.delete(comments)
					.where(eq(comments.id, existingReaction[0].id));

				// Enrich card with updated counts and broadcast
				const enrichedCard = await enrichCardWithCounts(cardData.card);
				await broadcastCardUpdated(cardData.board.id, enrichedCard);

				// Also broadcast for presentation mode
				await broadcastUpdatePresentation(cardData.board.id, {
					comment_removed: existingReaction[0].id,
					card_id: card_id,
				});

				return json({
					success: true,
					action: "removed",
					comment_id: existingReaction[0].id,
				});
			}
		}

		// Create the comment/reaction
		const commentId = nanoid();
		const now = new Date().toISOString();
		const [newComment] = await db
			.insert(comments)
			.values({
				id: commentId,
				cardId: card_id,
				userId: user.userId,
				content: content.trim(),
				isAgreement: is_agreement,
				isReaction: is_reaction,
				completed: false,
				completedByUserId: null,
				completedAt: null,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		// Track feature usage
		featureTracker.trackFeature(
			'comments',
			is_reaction ? 'reaction_added' : 'posted',
			user.userId,
			{
				boardId: cardData.board.id,
				metadata: { cardId: card_id, isAgreement: is_agreement }
			}
		);

		// Get user info for the response
		const [userData] = await db
			.select({
				name: users.name,
				email: users.email,
			})
			.from(users)
			.where(eq(users.id, user.userId));

		const realUserName = userData?.name || userData?.email || "Unknown User";
		const displayUserName = getUserDisplayName(
			realUserName,
			cardData.board.id,
			cardData.board.blameFreeMode || false,
		);

		const commentWithUser = {
			...newComment,
			userName: displayUserName,
		};

		// Enrich card with updated counts and broadcast
		const enrichedCard = await enrichCardWithCounts(cardData.card);
		await broadcastCardUpdated(cardData.board.id, enrichedCard);

		// Also broadcast for presentation mode
		await broadcastUpdatePresentation(cardData.board.id, {
			new_comment: commentWithUser,
			card_id: card_id,
		});

		return json({
			success: true,
			action: "added",
			comment: commentWithUser,
		});
	} catch (error) {
		console.error("Error creating comment:", error);
		return json(
			{
				success: false,
				error: "Failed to create comment",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
};
