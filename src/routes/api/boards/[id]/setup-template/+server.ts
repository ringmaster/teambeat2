import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { findBoardById } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { getTemplate } from '$lib/server/templates.js';
import { handleApiError } from '$lib/server/api-utils.js';
import { db } from '$lib/server/db/index.js';
import { columns, scenes, boards } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const POST: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const boardId = event.params.id;
    const body = await event.request.json();

    const board = await findBoardById(boardId);
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

    // Check if board already has scenes/columns configured
    const existingColumns = await db
      .select()
      .from(columns)
      .where(eq(columns.boardId, boardId));

    const existingScenes = await db
      .select()
      .from(scenes)
      .where(eq(scenes.boardId, boardId));

    if (existingColumns.length > 0 || existingScenes.length > 0) {
      return json(
        { success: false, error: 'Board already has configuration' },
        { status: 400 }
      );
    }

    // Get template from shared source
    const templateType = body.template || 'basic';
    const selectedTemplate = getTemplate(templateType);

    const templateColumns = selectedTemplate.columns;
    const templateScenes = selectedTemplate.scenes;

    // Create template in a transaction
    db.transaction((tx) => {
      // Create columns from template
      for (const col of templateColumns) {
        tx
          .insert(columns)
          .values({
            id: uuidv4(),
            boardId: board.id,
            title: col.title,
            seq: col.seq
          })
          .run();
      }

      // Create scenes from template
      let currentSceneId: string | null = null;
      for (const scene of templateScenes) {
        const sceneId = uuidv4();
        if (!currentSceneId) currentSceneId = sceneId;

        tx
          .insert(scenes)
          .values({
            id: sceneId,
            boardId: board.id,
            ...scene
          })
          .run();
      }

      // Set current scene to first scene
      if (currentSceneId) {
        tx
          .update(boards)
          .set({ currentSceneId })
          .where(eq(boards.id, board.id))
          .run();
      }
    });

    return json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to setup board template');
  }
};
