import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { db } from '$lib/server/db';
import { comments, cards, boards, users, columns } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { broadcastUpdatePresentation } from '$lib/server/sse/broadcast.js';
import { nanoid } from 'nanoid';
import { getUserDisplayName } from '$lib/utils/animalNames';

export const POST: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const { card_id, content, is_agreement = false } = await event.request.json();

    if (!content?.trim()) {
      return json({ success: false, error: 'Comment content is required' }, { status: 400 });
    }

    // Get card with board info to verify it exists
    const [cardData] = await db
      .select({
        card: cards,
        column: columns,
        board: boards
      })
      .from(cards)
      .innerJoin(columns, eq(cards.columnId, columns.id))
      .innerJoin(boards, eq(columns.boardId, boards.id))
      .where(eq(cards.id, card_id));

    if (!cardData) {
      return json({ success: false, error: 'Card not found' }, { status: 404 });
    }

    // Create the comment
    const commentId = nanoid();
    const [newComment] = await db
      .insert(comments)
      .values({
        id: commentId,
        cardId: card_id,
        userId: user.userId,
        content: content.trim(),
        isAgreement: is_agreement
      })
      .returning();

    // Get user info for the response
    const [userData] = await db
      .select({
        name: users.name,
        email: users.email
      })
      .from(users)
      .where(eq(users.id, user.userId));

    const realUserName = userData?.name || userData?.email || 'Unknown User';
    const displayUserName = getUserDisplayName(
      realUserName,
      cardData.board.id,
      cardData.board.blameFreeMode || false
    );

    const commentWithUser = {
      ...newComment,
      userName: displayUserName
    };

    // Broadcast the new comment to all users viewing the board
    await broadcastUpdatePresentation(cardData.board.id, {
      new_comment: commentWithUser,
      card_id: card_id
    });

    return json({
      success: true,
      comment: commentWithUser
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    return json(
      {
        success: false,
        error: 'Failed to create comment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
};
