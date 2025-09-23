import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getBoardWithDetails, updateBoardScene } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { broadcastSceneChanged } from '$lib/server/sse/broadcast.js';
import { refreshPresenceOnBoardAction } from '$lib/server/middleware/presence.js';
import { z } from 'zod';

const updateSceneSchema = z.object({
  sceneId: z.string().uuid()
});

export const PUT: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const boardId = event.params.id;
    const body = await event.request.json();
    const data = updateSceneSchema.parse(body);

    // Update user presence on this board
    await refreshPresenceOnBoardAction(event);

    const board = await getBoardWithDetails(boardId);
    if (!board) {
      return json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to change scenes
    const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!userRole || !['admin', 'facilitator'].includes(userRole)) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Verify the scene exists and belongs to this board
    const scene = board.scenes.find(s => s.id === data.sceneId);
    if (!scene) {
      return json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      );
    }

    // Update the board's current scene
    await updateBoardScene(boardId, data.sceneId);

    // Broadcast the scene change to all clients with full scene data
    await broadcastSceneChanged(boardId, scene);

    return json({
      success: true,
      scene
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
      { success: false, error: 'Failed to change scene' },
      { status: 500 }
    );
  }
};
