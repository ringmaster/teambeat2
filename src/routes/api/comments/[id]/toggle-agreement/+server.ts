import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { db } from '$lib/server/db';
import { comments, cards, boards } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { broadcastUpdatePresentation } from '$lib/server/sse/broadcast.js';

export const PUT: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const { id: commentId } = event.params;
    const { is_agreement } = await event.request.json();

    // Get comment with card and board info
    const [commentData] = await db
      .select({
        comment: comments,
        card: cards,
        board: boards
      })
      .from(comments)
      .innerJoin(cards, eq(comments.cardId, cards.id))
      .innerJoin(boards, eq(cards.boardId, boards.id))
      .where(eq(comments.id, commentId));

    if (!commentData) {
      return json({ success: false, error: 'Comment not found' }, { status: 404 });
    }

    // Update the comment's is_agreement field
    const [updated] = await db
      .update(comments)
      .set({ isAgreement: is_agreement })
      .where(eq(comments.id, commentId))
      .returning();

    // Broadcast the change to all users
    await broadcastUpdatePresentation(commentData.board.id, {
      comment_id: commentId,
      is_agreement: is_agreement,
      card_id: commentData.card.id
    });

    return json({
      success: true,
      comment: updated
    });
  } catch (error) {
    console.error('Error toggling comment agreement:', error);
    return json(
      {
        success: false,
        error: 'Failed to toggle comment agreement',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
};
