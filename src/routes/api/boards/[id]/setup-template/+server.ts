import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserForApi } from '$lib/server/auth/index.js';
import { findBoardById } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { getTemplate } from '$lib/server/templates.js';
import { handleApiError } from '$lib/server/api-utils.js';
import { db } from '$lib/server/db/index.js';
import { withTransaction } from '$lib/server/db/transaction.js';
import { columns, scenes, boards, scenesColumns, sceneFlags } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const POST: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
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
    await withTransaction(async (tx) => {
      // Create columns from template and track their IDs
      const columnIdMap = new Map<string, string>(); // Map column title to column ID

      for (const col of templateColumns) {
        // Get description from function if available, otherwise use static description
        const description = col.getDescription ? col.getDescription() : col.description;
        const columnId = uuidv4();

        await tx
          .insert(columns)
          .values({
            id: columnId,
            boardId: board.id,
            title: col.title,
            description: description || null,
            seq: col.seq,
            defaultAppearance: col.default_appearance || 'shown'
          });

        columnIdMap.set(col.title, columnId);
      }

      // Create scenes from template
      let currentSceneId: string | null = null;
      for (const scene of templateScenes) {
        const sceneId = uuidv4();
        if (!currentSceneId) currentSceneId = sceneId;

        // Remove visibleColumns and flags from the scene data as they're not database fields
        const { visibleColumns, flags, ...sceneData } = scene;

        await tx
          .insert(scenes)
          .values({
            id: sceneId,
            boardId: board.id,
            ...sceneData
          });

        // Create scene flags
        if (flags && flags.length > 0) {
          for (const flag of flags) {
            await tx
              .insert(sceneFlags)
              .values({
                sceneId,
                flag
              });
          }
        }

        // Create scene-column relationships based on visibleColumns
        if (visibleColumns && visibleColumns.length > 0) {
          // If visibleColumns is specified, set those as visible and others as hidden
          for (const [columnTitle, columnId] of columnIdMap) {
            await tx
              .insert(scenesColumns)
              .values({
                sceneId,
                columnId,
                state: visibleColumns.includes(columnTitle) ? 'visible' : 'hidden'
              });
          }
        } else {
          // If no visibleColumns specified, all columns are visible by default
          for (const columnId of columnIdMap.values()) {
            await tx
              .insert(scenesColumns)
              .values({
                sceneId,
                columnId,
                state: 'visible'
              });
          }
        }
      }

      // Set current scene to first scene
      if (currentSceneId) {
        await tx
          .update(boards)
          .set({ currentSceneId })
          .where(eq(boards.id, board.id));
      }
    });

    return json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to setup board template');
  }
};
