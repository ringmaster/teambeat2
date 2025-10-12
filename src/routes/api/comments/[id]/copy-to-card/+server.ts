import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { db } from '$lib/server/db/index.js';
import { comments, cards, columns } from '$lib/server/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { createCard } from '$lib/server/repositories/card.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { broadcastCardCreated } from '$lib/server/sse/broadcast.js';
import { handleApiError } from '$lib/server/api-utils.js';
import { refreshPresenceOnBoardAction } from '$lib/server/middleware/presence.js';
import { enrichCardWithCounts } from '$lib/server/utils/cards-data.js';
import { z } from 'zod';

const copyToCardSchema = z.object({
  column_id: z.string().uuid()
});

export const POST: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const commentId = event.params.id;
    const body = await event.request.json();
    const data = copyToCardSchema.parse(body);

    // Find the comment and get board info
    const [commentData] = await db
      .select({
        commentId: comments.id,
        commentContent: comments.content,
        cardId: cards.id,
        boardId: columns.boardId,
        isAgreement: comments.isAgreement
      })
      .from(comments)
      .innerJoin(cards, eq(cards.id, comments.cardId))
      .innerJoin(columns, eq(columns.id, cards.columnId))
      .where(eq(comments.id, commentId))
      .limit(1);

    if (!commentData) {
      return json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      );
    }

    if (!commentData.isAgreement) {
      return json(
        { success: false, error: 'Comment is not an agreement' },
        { status: 400 }
      );
    }

    await refreshPresenceOnBoardAction(event);

    const board = await getBoardWithDetails(commentData.boardId);
    if (!board) {
      return json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      );
    }

    const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!userRole || (userRole !== 'admin' && userRole !== 'facilitator')) {
      return json(
        { success: false, error: 'Only facilitators and admins can copy agreements to cards' },
        { status: 403 }
      );
    }

    // Verify the column is visible in the current scene
    const currentScene = board.scenes.find(s => s.id === board.currentSceneId);
    if (!currentScene) {
      return json(
        { success: false, error: 'No active scene' },
        { status: 400 }
      );
    }

    const hiddenColumnIds = board.hiddenColumnsByScene?.[currentScene.id] || [];
    const visibleColumns = board.columns.filter(c => !hiddenColumnIds.includes(c.id)).map(c => c.id);

    if (!visibleColumns.includes(data.column_id)) {
      return json(
        { success: false, error: 'Column must be visible in current scene' },
        { status: 400 }
      );
    }

    // Get reactions for the card
    const reactionCounts = await db
      .select({
        emoji: comments.content,
        count: sql<number>`COUNT(*)`.as('count')
      })
      .from(comments)
      .where(and(
        eq(comments.cardId, commentData.cardId),
        eq(comments.isReaction, true)
      ))
      .groupBy(comments.content);

    // Format reactions as text
    let formattedReactions = '';
    if (reactionCounts.length > 0) {
      const reactionTexts = reactionCounts.map(({ emoji, count }) => `(${count}×${emoji})`);
      formattedReactions = reactionTexts.join(' ');
    }

    // Format content with indentation for markdown
    // Replace newlines with 4 spaces + tab for markdown indentation
    const formattedContent = commentData.commentContent.replace(/\n/g, '\n    \t');

    // Build final content with reactions
    let finalContent = formattedContent;
    if (formattedReactions) {
      finalContent = formattedContent + '\n\n' + formattedReactions;
    }

    // Create the card with formatted content
    const card = await createCard({
      columnId: data.column_id,
      userId: user.userId,
      content: finalContent
    });

    const enrichedCard = await enrichCardWithCounts(card);

    // Broadcast the new card to all clients
    broadcastCardCreated(commentData.boardId, enrichedCard);

    return json({
      success: true,
      card: enrichedCard
    });
  } catch (error) {
    return handleApiError(error, 'Failed to copy agreement to card');
  }
};
