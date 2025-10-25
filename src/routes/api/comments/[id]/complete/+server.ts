import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserForApi } from '$lib/server/auth/index.js';
import { db } from '$lib/server/db/index.js';
import { comments, cards, columns } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { setCommentCompletion } from '$lib/server/repositories/agreement.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { broadcastAgreementsUpdated } from '$lib/server/sse/broadcast.js';
import { handleApiError } from '$lib/server/api-utils.js';
import { refreshPresenceOnBoardAction } from '$lib/server/middleware/presence.js';
import { buildEnrichedAgreementsData } from '$lib/server/utils/agreements-data.js';
import { z } from 'zod';

const completeCommentSchema = z.object({
  completed: z.boolean()
});

export const PUT: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const commentId = event.params.id;
    const body = await event.request.json();
    const data = completeCommentSchema.parse(body);

    // Find the comment and get board info
    const [commentData] = await db
      .select({
        commentId: comments.id,
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
        { success: false, error: 'Only facilitators and admins can mark agreements as complete' },
        { status: 403 }
      );
    }

    const updatedComment = await setCommentCompletion(
      commentId,
      data.completed,
      user.userId
    );

    // Broadcast updated agreements list to all clients
    const agreements = await buildEnrichedAgreementsData(commentData.boardId, board);
    broadcastAgreementsUpdated(commentData.boardId, agreements);

    const updatedEnrichedComment = agreements.find(a => a.id === commentId);

    return json({
      success: true,
      comment: updatedEnrichedComment || updatedComment
    });
  } catch (error) {
    return handleApiError(error, 'Failed to update comment completion status');
  }
};
