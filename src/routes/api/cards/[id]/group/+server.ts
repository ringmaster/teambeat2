import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserForApi } from '$lib/server/auth/index.js';
import { findCardById, groupCards, ungroupCard, getCardsForBoard } from '$lib/server/repositories/card.js';
import { getBoardWithDetails, findBoardByColumnId } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { broadcastCardUpdated } from '$lib/server/sse/broadcast.js';
import { enrichCardWithCounts } from '$lib/server/utils/cards-data.js';
import { z } from 'zod';

const groupCardsSchema = z.object({
  cardIds: z.array(z.string().uuid()).min(2).max(20),
  groupId: z.string().uuid().optional()
});

export const POST: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const cardId = event.params.id;
    const body = await event.request.json();
    const data = groupCardsSchema.parse(body);

    // Ensure the main card is in the list
    if (!data.cardIds.includes(cardId)) {
      data.cardIds.push(cardId);
    }

    const card = await findCardById(cardId);
    if (!card) {
      return json(
        { success: false, error: 'Card not found' },
        { status: 404 }
      );
    }

    // Get board information
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

    // Only facilitators and admins can group cards
    if (!['admin', 'facilitator'].includes(userRole)) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const groupId = await groupCards(data.cardIds, data.groupId);

    // Broadcast updates for all grouped cards
    for (const cId of data.cardIds) {
      const updatedCard = await findCardById(cId);
      if (updatedCard) {
        const enrichedCard = await enrichCardWithCounts(updatedCard);
        broadcastCardUpdated(board.id, enrichedCard);
      }
    }

    return json({
      success: true,
      groupId
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    if (error instanceof z.ZodError) {
      return json(
        { success: false, error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return json(
      { success: false, error: 'Failed to group cards' },
      { status: 500 }
    );
  }
};

export const DELETE: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const cardId = event.params.id;

    const card = await findCardById(cardId);
    if (!card) {
      return json(
        { success: false, error: 'Card not found' },
        { status: 404 }
      );
    }

    // Get board information
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

    // Only facilitators and admins can ungroup cards
    if (!['admin', 'facilitator'].includes(userRole)) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const ungroupResult = await ungroupCard(cardId);

    // Broadcast the updated card
    const updatedCard = await findCardById(cardId);
    if (updatedCard) {
      const enrichedCard = await enrichCardWithCounts(updatedCard);
      broadcastCardUpdated(board.id, enrichedCard);
    }

    // Broadcast updates for any cards affected by ungrouping (like last remaining card losing group lead status)
    const allCards = await getCardsForBoard(board.id);
    for (const affectedCardId of ungroupResult.affectedCardIds) {
      const affectedCard = allCards.find(c => c.id === affectedCardId);
      if (affectedCard) {
        const enrichedCard = await enrichCardWithCounts(affectedCard);
        broadcastCardUpdated(board.id, enrichedCard);
      }
    }

    return json({
      success: true
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    return json(
      { success: false, error: 'Failed to ungroup card' },
      { status: 500 }
    );
  }
};
