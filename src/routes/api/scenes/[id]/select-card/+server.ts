import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserForApi } from '$lib/server/auth/index.js';
import { db } from '$lib/server/db/index.js';
import { scenes, boards, seriesMembers, cards } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { broadcastUpdatePresentation } from '$lib/server/sse/broadcast.js';

export const PUT: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const { id: sceneId } = event.params;
    const { card_id } = await event.request.json();

    // Get scene and board
    const sceneWithBoard = await db
      .select()
      .from(scenes)
      .innerJoin(boards, eq(scenes.boardId, boards.id))
      .where(eq(scenes.id, sceneId));

    if (!sceneWithBoard || sceneWithBoard.length === 0) {
      return json({ success: false, error: 'Scene not found' }, { status: 404 });
    }

    const scene = sceneWithBoard[0].scenes;
    const board = sceneWithBoard[0].boards;

    // Check if user is admin or facilitator
    const [membership] = await db
      .select()
      .from(seriesMembers)
      .where(
        and(
          eq(seriesMembers.userId, user.userId),
          eq(seriesMembers.seriesId, board.seriesId)
        )
      );

    if (!membership || !['admin', 'facilitator'].includes(membership.role)) {
      return json({ success: false, error: 'Only facilitators can select presentation cards' }, { status: 403 });
    }

    // Validate card exists if provided
    if (card_id) {
      const [card] = await db
        .select()
        .from(cards)
        .where(eq(cards.id, card_id));

      if (!card) {
        return json({ success: false, error: 'Card not found' }, { status: 404 });
      }
    }

    // Update scene with selected card
    await db
      .update(scenes)
      .set({ selectedCardId: card_id || null })
      .where(eq(scenes.id, sceneId));

    // Broadcast the change to all users
    await broadcastUpdatePresentation(board.id, { card_id });

    return json({
      success: true,
      selected_card_id: card_id
    });
  } catch (error) {
    console.error('Error selecting presentation card:', error);
    return json(
      {
        success: false,
        error: 'Failed to select presentation card',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
};
