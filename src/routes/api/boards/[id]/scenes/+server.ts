import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { findBoardById } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { broadcastSceneChanged } from '$lib/server/sse/broadcast.js';
import { db } from '$lib/server/db/index.js';
import { scenes, boards } from '$lib/server/db/schema.js';
import { eq, desc, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const GET: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const boardId = event.params.id;

    const board = await findBoardById(boardId);
    if (!board) {
      return json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      );
    }

    // Check if user has access to the board
    const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!userRole) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get all scenes for the board, ordered by sequence
    const boardScenes = await db
      .select()
      .from(scenes)
      .where(eq(scenes.boardId, boardId))
      .orderBy(asc(scenes.seq));

    return json({
      success: true,
      scenes: boardScenes
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error('Failed to fetch scenes:', error);
    return json(
      { success: false, error: 'Failed to fetch scenes' },
      { status: 500 }
    );
  }
};

export const POST: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const boardId = event.params.id;
    const body = await event.request.json();

    // Validate input
    const { title, description, mode, allowAddCards, allowEditCards, allowComments, allowVoting } = body;

    if (!title?.trim()) {
      return json(
        { success: false, error: 'Scene title is required' },
        { status: 400 }
      );
    }

    if (!mode || !['columns', 'present', 'review'].includes(mode)) {
      return json(
        { success: false, error: 'Valid scene mode is required (columns, present, or review)' },
        { status: 400 }
      );
    }

    const board = await findBoardById(boardId);
    if (!board) {
      return json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      );
    }

    // Check if user has permission to create scenes (admin or facilitator)
    const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!['admin', 'facilitator'].includes(userRole)) {
      return json(
        { success: false, error: 'Only administrators and facilitators can create scenes' },
        { status: 403 }
      );
    }

    // Get the next sequence number
    const existingScenes = await db
      .select({ seq: scenes.seq })
      .from(scenes)
      .where(eq(scenes.boardId, boardId))
      .orderBy(desc(scenes.seq))
      .limit(1);

    const nextSeq = existingScenes.length > 0 ? existingScenes[0].seq + 1 : 1;

    // Create the scene
    const sceneId = uuidv4();
    await db
      .insert(scenes)
      .values({
        id: sceneId,
        boardId: boardId,
        title: title.trim(),
        description: description?.trim() || null,
        mode: mode,
        seq: nextSeq,
        allowAddCards: allowAddCards ?? true,
        allowEditCards: allowEditCards ?? true,
        allowComments: allowComments ?? true,
        allowVoting: allowVoting ?? false
      });

    // Get the created scene with all its details
    const newScene = await db
      .select()
      .from(scenes)
      .where(eq(scenes.id, sceneId))
      .get();

    // If this is the first scene and board doesn't have a current scene, make it current
    const boardWithCurrentScene = await findBoardById(boardId);
    if (!boardWithCurrentScene.currentSceneId) {
      await db
        .update(boards)
        .set({ currentSceneId: sceneId })
        .where(eq(boards.id, boardId));

      // Broadcast the scene change
      await broadcastSceneChanged(boardId, newScene);
    }

    return json({
      success: true,
      scene: newScene
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error('Failed to create scene:', error);
    return json(
      { success: false, error: 'Failed to create scene' },
      { status: 500 }
    );
  }
};
