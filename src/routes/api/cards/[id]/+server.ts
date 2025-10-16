import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { findCardById, updateCard, deleteCard } from '$lib/server/repositories/card.js';
import { getBoardWithDetails, findBoardByColumnId } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { broadcastCardUpdated, broadcastCardDeleted } from '$lib/server/sse/broadcast.js';
import { enrichCardWithCounts } from '$lib/server/utils/cards-data.js';
import { getSceneCapability, getCurrentScene } from '$lib/utils/scene-capability.js';
import { z } from 'zod';

const updateCardSchema = z.object({
  content: z.string().min(1).max(1000)
});

export const PUT: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const cardId = event.params.id;
    const body = await event.request.json();
    const data = updateCardSchema.parse(body);

    const card = await findCardById(cardId);
    if (!card) {
      return json(
        { success: false, error: 'Card not found' },
        { status: 404 }
      );
    }

    // Get board information through column relationship
    const boardId = await findBoardByColumnId(card.columnId);
    if (!boardId) {
      return json(
        { success: false, error: 'Column not found' },
        { status: 404 }
      );
    }

    const board = await getBoardWithDetails(boardId);
    if (!board) {
      return json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this board
    const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!userRole) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Check if current scene allows editing cards
    const currentScene = getCurrentScene(board.scenes, board.currentSceneId);
    if (!getSceneCapability(currentScene, board.status, 'allow_edit_cards')) {
      return json(
        { success: false, error: 'Editing cards not allowed in current scene' },
        { status: 403 }
      );
    }

    // Only card owner or admin/facilitator can edit
    if (card.userId !== user.userId && !['admin', 'facilitator'].includes(userRole)) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const updatedCard = await updateCard(cardId, { content: data.content });

    // Enrich the card with reaction and comment counts
    const enrichedCard = await enrichCardWithCounts(updatedCard);

    // Broadcast the updated card to all clients
    broadcastCardUpdated(board.id, enrichedCard);

    return json({
      success: true,
      card: enrichedCard
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    if (error instanceof z.ZodError) {
      return json(
        { success: false, error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    return json(
      { success: false, error: 'Failed to update card' },
      { status: 500 }
    );
  }
};

export const DELETE: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const cardId = event.params.id;

    const card = await findCardById(cardId);
    if (!card) {
      return json(
        { success: false, error: 'Card not found' },
        { status: 404 }
      );
    }

    // Get board information through column relationship
    const boardId = await findBoardByColumnId(card.columnId);
    if (!boardId) {
      return json(
        { success: false, error: 'Column not found' },
        { status: 404 }
      );
    }

    const board = await getBoardWithDetails(boardId);
    if (!board) {
      return json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this board
    const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!userRole) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Check if current scene allows editing cards (delete is an edit action)
    const currentScene = getCurrentScene(board.scenes, board.currentSceneId);
    if (!getSceneCapability(currentScene, board.status, 'allow_edit_cards')) {
      return json(
        { success: false, error: 'Deleting cards not allowed in current scene' },
        { status: 403 }
      );
    }

    // Only card owner or admin/facilitator can delete
    if (card.userId !== user.userId && !['admin', 'facilitator'].includes(userRole)) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    await deleteCard(cardId);

    // Broadcast the card deletion to all clients
    broadcastCardDeleted(board.id, cardId);

    return json({
      success: true
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    return json(
      { success: false, error: 'Failed to delete card' },
      { status: 500 }
    );
  }
};
