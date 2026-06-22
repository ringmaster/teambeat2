import { json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { db } from "$lib/server/db/index.js";
import { boards, cards, columns, comments, users } from "$lib/server/db/schema.js";
import { getBoardWithDetails } from "$lib/server/repositories/board.js";
import { broadcastCardUpdated, broadcastUpdatePresentation } from "$lib/server/sse/broadcast.js";
import { enrichCardWithCounts } from "$lib/server/utils/cards-data.js";
import { getUserDisplayName } from "$lib/utils/animalNames.js";
import { getCurrentScene, getSceneCapability } from "$lib/utils/scene-capability.js";
import type { RequestHandler } from "./$types";

const createCommentSchema = z.object({
	content: z.string().min(1).max(5000),
	is_agreement: z.boolean().optional().default(false),
	is_reaction: z.boolean().optional().default(false),
});

export const POST: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const cardId = event.params.id;

		const body = await event.request.json();
		const data = createCommentSchema.parse(body);

		// Get card with board context
		const [cardData] = await db
			.select({ card: cards, column: columns, board: boards })
			.from(cards)
			.innerJoin(columns, eq(cards.columnId, columns.id))
			.innerJoin(boards, eq(columns.boardId, boards.id))
			.where(eq(cards.id, cardId));

		if (!cardData) return json({ success: false, error: "Card not found" }, { status: 404 });

		// Check user has access to this board's series
		const boardWithDetails = await getBoardWithDetails(cardData.board.id);
		if (!boardWithDetails) return json({ success: false, error: "Board not found" }, { status: 404 });

		// Check series membership
		const { requireSeriesMember } = await import("$lib/server/api/v1-access.js");
		const member = await requireSeriesMember(user.userId, cardData.board.seriesId);
		if (!member) return json({ success: false, error: "Access denied" }, { status: 403 });

		// Check scene capability
		const currentScene = getCurrentScene(boardWithDetails.scenes, boardWithDetails.currentSceneId);
		if (!getSceneCapability(currentScene, boardWithDetails.status, "allow_comments")) {
			return json(
				{ success: false, error: "Adding comments not allowed in current scene" },
				{ status: 403 },
			);
		}

		// For reactions: toggle if the user already has this reaction
		if (data.is_reaction) {
			const [existing] = await db
				.select()
				.from(comments)
				.where(
					and(
						eq(comments.cardId, cardId),
						eq(comments.userId, user.userId),
						eq(comments.content, data.content.trim()),
						eq(comments.isReaction, true),
					),
				)
				.limit(1);

			if (existing) {
				await db.delete(comments).where(eq(comments.id, existing.id));
				const enrichedCard = await enrichCardWithCounts(cardData.card);
				await broadcastCardUpdated(cardData.board.id, enrichedCard);
				await broadcastUpdatePresentation(cardData.board.id, {
					comment_removed: existing.id,
					card_id: cardId,
				});
				return json({ success: true, action: "removed", comment_id: existing.id });
			}
		}

		const now = new Date().toISOString();
		const [newComment] = await db
			.insert(comments)
			.values({
				id: nanoid(),
				cardId,
				userId: user.userId,
				content: data.content.trim(),
				isAgreement: data.is_agreement,
				isReaction: data.is_reaction,
				completed: false,
				completedByUserId: null,
				completedAt: null,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		// Resolve display name (respects blame-free mode)
		const [userData] = await db
			.select({ name: users.name, email: users.email })
			.from(users)
			.where(eq(users.id, user.userId));
		const realName = userData?.name || userData?.email || "Unknown";
		const displayName = getUserDisplayName(realName, cardData.board.id, cardData.board.blameFreeMode || false);

		const enrichedCard = await enrichCardWithCounts(cardData.card);
		await broadcastCardUpdated(cardData.board.id, enrichedCard);
		await broadcastUpdatePresentation(cardData.board.id, {
			new_comment: { ...newComment, userName: displayName },
			card_id: cardId,
		});

		return json({ success: true, action: "added", comment: { ...newComment, userName: displayName } }, { status: 201 });
	} catch (err) {
		if (err instanceof Response) throw err;
		return json({ success: false, error: "Failed to create comment" }, { status: 500 });
	}
};
