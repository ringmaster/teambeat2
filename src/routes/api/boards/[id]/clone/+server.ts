import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { handleApiError } from '$lib/server/api-utils.js';
import { db } from '$lib/server/db/index.js';
import { withTransaction } from '$lib/server/db/transaction.js';
import { boards, columns, scenes, scenesColumns, agreements, sceneScorecards, sceneFlags, healthQuestions } from '$lib/server/db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  findIncompleteAgreementsByBoardId,
  findIncompleteCommentAgreementsByBoardId
} from '$lib/server/repositories/agreement.js';

const cloneBoardSchema = z.object({
  sourceId: z.string().uuid()
});

export const POST: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const boardId = event.params.id;
    const body = await event.request.json();
    const data = cloneBoardSchema.parse(body);

    // Get target board (the one we're cloning into)
    const targetBoard = await getBoardWithDetails(boardId);
    if (!targetBoard) {
      return json(
        { success: false, error: 'Target board not found' },
        { status: 404 }
      );
    }

    // Check user has access to target board
    const userRole = await getUserRoleInSeries(user.userId, targetBoard.seriesId);
    if (!userRole || !['admin', 'facilitator'].includes(userRole)) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get source board
    const sourceBoard = await getBoardWithDetails(data.sourceId);
    if (!sourceBoard) {
      return json(
        { success: false, error: 'Source board not found' },
        { status: 404 }
      );
    }

    // Check user has access to source board
    const sourceUserRole = await getUserRoleInSeries(user.userId, sourceBoard.seriesId);
    if (!sourceUserRole) {
      return json(
        { success: false, error: 'Access denied to source board' },
        { status: 403 }
      );
    }

    // Check target board is empty (no existing columns/scenes)
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
        { success: false, error: 'Target board already has configuration' },
        { status: 400 }
      );
    }

    // Clone board configuration in a transaction
    await withTransaction(async (tx) => {
      // Clone board options from source board and set clone_of
      await tx
        .update(boards)
        .set({
          blameFreeMode: sourceBoard.blameFreeMode,
          votingAllocation: sourceBoard.votingAllocation,
          votingEnabled: sourceBoard.votingEnabled,
          cloneOf: data.sourceId
        })
        .where(eq(boards.id, boardId));

      // Clone columns
      const sourceColumns = await tx
        .select()
        .from(columns)
        .where(eq(columns.boardId, data.sourceId));

      // Map old column IDs to new column IDs for scene column settings
      const columnIdMapping: Record<string, string> = {};

      for (const column of sourceColumns) {
        const newColumnId = uuidv4();
        columnIdMapping[column.id] = newColumnId;

        await tx
          .insert(columns)
          .values({
            id: newColumnId,
            boardId: boardId,
            title: column.title,
            description: column.description,
            seq: column.seq,
            defaultAppearance: column.defaultAppearance,
            createdAt: new Date().toISOString()
          });
      }

      // Clone scenes
      const sourceScenes = await tx
        .select()
        .from(scenes)
        .where(eq(scenes.boardId, data.sourceId));

      let firstSceneId: string | null = null;
      // Map old scene IDs to new scene IDs for scene column settings
      const sceneIdMapping: Record<string, string> = {};

      for (const scene of sourceScenes) {
        const newSceneId = uuidv4();
        if (!firstSceneId) firstSceneId = newSceneId;
        sceneIdMapping[scene.id] = newSceneId;

        await tx
          .insert(scenes)
          .values({
            id: newSceneId,
            boardId: boardId,
            title: scene.title,
            description: scene.description,
            mode: scene.mode,
            seq: scene.seq,
            displayRule: scene.displayRule,
            createdAt: new Date().toISOString()
          });
      }

      // Clone scene flags
      if (Object.keys(sceneIdMapping).length > 0) {
        const sourceSceneIds = Object.keys(sceneIdMapping);
        const sourceSceneFlags = await tx
          .select()
          .from(sceneFlags)
          .where(inArray(sceneFlags.sceneId, sourceSceneIds));

        for (const sceneFlag of sourceSceneFlags) {
          const newSceneId = sceneIdMapping[sceneFlag.sceneId];
          if (newSceneId) {
            await tx
              .insert(sceneFlags)
              .values({
                sceneId: newSceneId,
                flag: sceneFlag.flag
              });
          }
        }
      }

      // Clone scene column settings
      const sourceScenesColumns = await tx
        .select()
        .from(scenesColumns)
        .where(eq(scenesColumns.sceneId, data.sourceId));

      // Find scenes_columns entries for any scene in the source board
      const allSourceScenesColumns = await tx
        .select({ sceneId: scenesColumns.sceneId, columnId: scenesColumns.columnId, state: scenesColumns.state })
        .from(scenesColumns)
        .innerJoin(scenes, eq(scenes.id, scenesColumns.sceneId))
        .where(eq(scenes.boardId, data.sourceId));

      for (const sceneColumn of allSourceScenesColumns) {
        const newSceneId = sceneIdMapping[sceneColumn.sceneId];
        const newColumnId = columnIdMapping[sceneColumn.columnId];

        if (newSceneId && newColumnId) {
          await tx
            .insert(scenesColumns)
            .values({
              sceneId: newSceneId,
              columnId: newColumnId,
              state: sceneColumn.state
            });
        }
      }

      // Set current scene to first scene if any scenes were cloned
      if (firstSceneId) {
        await tx
          .update(boards)
          .set({ currentSceneId: firstSceneId })
          .where(eq(boards.id, boardId));
      }

      // Clone scene scorecards
      if (Object.keys(sceneIdMapping).length > 0) {
        const sourceSceneIds = Object.keys(sceneIdMapping);
        const sourceScorecards = await tx
          .select()
          .from(sceneScorecards)
          .where(inArray(sceneScorecards.sceneId, sourceSceneIds));

        for (const scorecard of sourceScorecards) {
          const newSceneId = sceneIdMapping[scorecard.sceneId];
          if (newSceneId) {
            await tx
              .insert(sceneScorecards)
              .values({
                id: uuidv4(),
                sceneId: newSceneId,
                scorecardId: scorecard.scorecardId,
                collectedData: null,
                processedAt: null,
                createdAt: new Date().toISOString()
              });
          }
        }
      }

      // Clone health questions (preserving thread_id for historical comparison)
      if (Object.keys(sceneIdMapping).length > 0) {
        const sourceSceneIds = Object.keys(sceneIdMapping);
        const sourceHealthQuestions = await tx
          .select()
          .from(healthQuestions)
          .where(inArray(healthQuestions.sceneId, sourceSceneIds));

        for (const question of sourceHealthQuestions) {
          const newSceneId = sceneIdMapping[question.sceneId];
          if (newSceneId) {
            await tx
              .insert(healthQuestions)
              .values({
                id: uuidv4(),
                threadId: question.threadId, // Preserve thread_id for historical comparison
                sceneId: newSceneId,
                question: question.question,
                description: question.description,
                questionType: question.questionType,
                seq: question.seq,
                createdAt: new Date().toISOString()
              });
          }
        }
      }

      // Clone incomplete agreements (both free-form and comment-based)
      const incompleteFreeFormAgreements = await findIncompleteAgreementsByBoardId(data.sourceId);
      const incompleteCommentAgreements = await findIncompleteCommentAgreementsByBoardId(data.sourceId);

      const now = new Date().toISOString();

      // Clone free-form agreements
      for (const agreement of incompleteFreeFormAgreements) {
        const newAgreementId = uuidv4();
        await tx
          .insert(agreements)
          .values({
            id: newAgreementId,
            boardId: boardId,
            userId: agreement.userId,
            content: agreement.content,
            completed: false,
            completedByUserId: null,
            completedAt: null,
            sourceAgreementId: agreement.id,
            createdAt: agreement.createdAt,
            updatedAt: now
          });
      }

      // Clone comment-based agreements to agreements table
      for (const commentAgreement of incompleteCommentAgreements) {
        const newAgreementId = uuidv4();
        await tx
          .insert(agreements)
          .values({
            id: newAgreementId,
            boardId: boardId,
            userId: commentAgreement.userId,
            content: commentAgreement.content,
            completed: false,
            completedByUserId: null,
            completedAt: null,
            sourceAgreementId: null,
            createdAt: commentAgreement.createdAt,
            updatedAt: now
          });
      }
    });

    return json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to clone board');
  }
};
