import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { updateScene, deleteScene } from '$lib/server/repositories/scene.js';
import { broadcastSceneChanged } from '$lib/server/sse/broadcast.js';
import { db } from '$lib/server/db/index.js';
import { boards } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateSceneSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  mode: z.enum(['columns', 'present', 'review', 'agreements', 'scorecard', 'static']).optional(),
  displayRule: z.string().nullish(),
  allowAddCards: z.boolean().optional(),
  allowEditCards: z.boolean().optional(),
  allowObscureCards: z.boolean().optional(),
  allowMoveCards: z.boolean().optional(),
  allowGroupCards: z.boolean().optional(),
  showVotes: z.boolean().optional(),
  allowVoting: z.boolean().optional(),
  showComments: z.boolean().optional(),
  allowComments: z.boolean().optional(),
  multipleVotesPerCard: z.boolean().optional()
});

export const PATCH: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const boardId = event.params.id;
    const sceneId = event.params.sceneId;
    const body = await event.request.json();
    const data = updateSceneSchema.parse(body);

    const board = await getBoardWithDetails(boardId);
    if (!board) {
      return json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to update this board
    const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!userRole || !['admin', 'facilitator'].includes(userRole)) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const updatedScene = await updateScene(sceneId, data);

    // If this is the current scene for the board, broadcast the change
    if (board.currentSceneId === sceneId) {
      await broadcastSceneChanged(boardId, updatedScene);
    }

    return json({
      success: true,
      scene: updatedScene
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

    console.error('Error updating scene:', error);
    return json(
      {
        success: false,
        error: 'Failed to update scene',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
};

export const DELETE: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const boardId = event.params.id;
    const sceneId = event.params.sceneId;

    const board = await getBoardWithDetails(boardId);
    if (!board) {
      return json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to delete from this board
    const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!userRole || !['admin', 'facilitator'].includes(userRole)) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // If this is the current scene, we need to switch to another one first
    const wasCurrentScene = board.currentSceneId === sceneId;
    let newCurrentScene = null;

    if (wasCurrentScene) {
      // Find another scene to switch to
      const remainingScenes = board.scenes.filter(s => s.id !== sceneId);
      if (remainingScenes.length > 0) {
        newCurrentScene = remainingScenes[0];
        // Update the board's current scene
        await db
          .update(boards)
          .set({ currentSceneId: newCurrentScene.id })
          .where(eq(boards.id, boardId));
      } else {
        // No scenes left, clear current scene
        await db
          .update(boards)
          .set({ currentSceneId: null })
          .where(eq(boards.id, boardId));
      }
    }

    await deleteScene(sceneId);

    // If we switched to a new scene, broadcast the change
    if (newCurrentScene) {
      await broadcastSceneChanged(boardId, newCurrentScene);
    }

    return json({
      success: true
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error('Error deleting scene:', error);
    return json(
      {
        success: false,
        error: 'Failed to delete scene',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
};
