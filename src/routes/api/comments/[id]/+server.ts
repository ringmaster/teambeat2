import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserForApi } from '$lib/server/auth/index.js';
import { db } from '$lib/server/db';
import { comments, cards, boards, columns, seriesMembers } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { broadcastUpdatePresentation } from '$lib/server/sse/broadcast.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getSceneCapability, getCurrentScene } from '$lib/utils/scene-capability.js';

export const DELETE: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const { id: commentId } = event.params;

    // Get comment with card and board info
    const [commentData] = await db
      .select({
        comment: comments,
        card: cards,
        column: columns,
        board: boards
      })
      .from(comments)
      .innerJoin(cards, eq(comments.cardId, cards.id))
      .innerJoin(columns, eq(cards.columnId, columns.id))
      .innerJoin(boards, eq(columns.boardId, boards.id))
      .where(eq(comments.id, commentId));

    if (!commentData) {
      return json({ success: false, error: 'Comment not found' }, { status: 404 });
    }

    // Get board with scenes to check scene capabilities
    const boardWithScenes = await getBoardWithDetails(commentData.board.id);
    if (!boardWithScenes) {
      return json({ success: false, error: 'Board not found' }, { status: 404 });
    }

    // Check if current scene allows commenting (delete is an edit action)
    const currentScene = getCurrentScene(boardWithScenes.scenes, boardWithScenes.currentSceneId);
    if (!getSceneCapability(currentScene, boardWithScenes.status, 'allow_comments')) {
      return json(
        { success: false, error: 'Deleting comments not allowed in current scene' },
        { status: 403 }
      );
    }

    // Check permissions: user must be either the comment author, admin, or facilitator
    const isCommentAuthor = commentData.comment.userId === user.userId;

    // Check if user is admin or facilitator in the series
    const [membership] = await db
      .select()
      .from(seriesMembers)
      .where(
        and(
          eq(seriesMembers.seriesId, commentData.board.seriesId),
          eq(seriesMembers.userId, user.userId)
        )
      );

    const isAdminOrFacilitator = membership && (membership.role === 'admin' || membership.role === 'facilitator');

    if (!isCommentAuthor && !isAdminOrFacilitator) {
      return json(
        { success: false, error: 'You do not have permission to delete this comment' },
        { status: 403 }
      );
    }

    // Delete the comment
    await db
      .delete(comments)
      .where(eq(comments.id, commentId));

    // Broadcast the deletion to all users
    await broadcastUpdatePresentation(commentData.board.id, {
      deleted_comment_id: commentId,
      card_id: commentData.card.id
    });

    return json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return json(
      {
        success: false,
        error: 'Failed to delete comment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
};
