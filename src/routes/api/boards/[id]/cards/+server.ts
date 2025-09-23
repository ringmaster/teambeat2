import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { createCard } from '$lib/server/repositories/card.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { broadcastCardCreated } from '$lib/server/sse/broadcast.js';
import { handleApiError } from '$lib/server/api-utils.js';
import { refreshPresenceOnBoardAction } from '$lib/server/middleware/presence.js';
import { buildAllCardsData } from '$lib/server/utils/cards-data.js';
import { z } from 'zod';

const createCardSchema = z.object({
  columnId: z.string().uuid(),
  content: z.string().min(1).max(1000),
  groupId: z.string().uuid().optional()
});

export const GET: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const boardId = event.params.id;

    // Update user presence on this board
    await refreshPresenceOnBoardAction(event);

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

    const cards = await buildAllCardsData(boardId);

    return json({
      success: true,
      cards
    });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch cards');
  }
};

export const POST: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const boardId = event.params.id;
    const body = await event.request.json();
    const data = createCardSchema.parse(body);

    // Update user presence on this board
    await refreshPresenceOnBoardAction(event);

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

    // Check if current scene allows adding cards
    const currentScene = board.scenes.find(s => s.id === board.currentSceneId);
    if (!currentScene || !currentScene.allowAddCards) {
      return json(
        { success: false, error: 'Adding cards not allowed in current scene' },
        { status: 403 }
      );
    }

    const card = await createCard({
      ...data,
      userId: user.userId
    });

    // Broadcast the new card to all clients
    broadcastCardCreated(boardId, card);

    return json({
      success: true,
      card
    });
  } catch (error) {
    return handleApiError(error, 'Failed to create card');
  }
};
