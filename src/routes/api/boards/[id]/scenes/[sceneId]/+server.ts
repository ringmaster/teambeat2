import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserForApi } from '$lib/server/auth/index.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { updateScene, deleteScene, getSceneFlags, setSceneFlags, findSceneById } from '$lib/server/repositories/scene.js';
import { broadcastSceneChanged } from '$lib/server/sse/broadcast.js';
import { db } from '$lib/server/db/index.js';
import { boards } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { SceneFlag } from '$lib/server/db/scene-flags.js';

const updateSceneSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  mode: z.enum(['columns', 'present', 'review', 'agreements', 'scorecard', 'static', 'survey']).optional(),
  displayRule: z.string().nullish(),
  displayMode: z.enum(['collecting', 'results']).optional(),
  focusedQuestionId: z.string().nullish(),
  flags: z.array(z.string()).optional()
});

export const PATCH: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
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

    // Update flags if provided
    if (data.flags !== undefined) {
      await setSceneFlags(sceneId, data.flags as SceneFlag[]);
    }

    // Remove flags from data before calling updateScene
    const { flags, ...sceneData } = data;

    // Only call updateScene if there are other fields to update
    let updatedScene;
    if (Object.keys(sceneData).length > 0) {
      updatedScene = await updateScene(sceneId, sceneData);
    } else {
      // If only flags were updated, fetch the scene
      updatedScene = await findSceneById(sceneId);
    }

    // Add flags to the response
    const sceneFlags = await getSceneFlags(sceneId);
    const sceneWithFlags = {
      ...updatedScene,
      flags: sceneFlags
    };

    // If this is the current scene for the board, broadcast the change
    if (board.currentSceneId === sceneId) {
      await broadcastSceneChanged(boardId, sceneWithFlags);
    }

    return json({
      success: true,
      scene: sceneWithFlags
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
    const user = requireUserForApi(event);
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
