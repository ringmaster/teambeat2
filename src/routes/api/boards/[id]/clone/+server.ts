import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { handleApiError } from '$lib/server/api-utils.js';
import { db } from '$lib/server/db/index.js';
import { boards, columns, scenes, scenesColumns } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

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
        
        // Clone in a transaction - MUST be synchronous with better-sqlite3
        db.transaction((tx) => {
            // Clone board options from source board
            tx
                .update(boards)
                .set({
                    blameFreeMode: sourceBoard.blameFreeMode,
                    votingAllocation: sourceBoard.votingAllocation,
                    votingEnabled: sourceBoard.votingEnabled
                })
                .where(eq(boards.id, boardId))
                .run();
            
            // Clone columns
            const sourceColumns = tx
                .select()
                .from(columns)
                .where(eq(columns.boardId, data.sourceId))
                .all();
            
            // Map old column IDs to new column IDs for scene column settings
            const columnIdMapping: Record<string, string> = {};
            
            for (const column of sourceColumns) {
                const newColumnId = uuidv4();
                columnIdMapping[column.id] = newColumnId;
                
                tx
                    .insert(columns)
                    .values({
                        id: newColumnId,
                        boardId: boardId,
                        title: column.title,
                        description: column.description,
                        seq: column.seq,
                        defaultAppearance: column.defaultAppearance,
                        createdAt: new Date().toISOString()
                    })
                    .run();
            }
            
            // Clone scenes
            const sourceScenes = tx
                .select()
                .from(scenes)
                .where(eq(scenes.boardId, data.sourceId))
                .all();
            
            let firstSceneId: string | null = null;
            // Map old scene IDs to new scene IDs for scene column settings
            const sceneIdMapping: Record<string, string> = {};
            
            for (const scene of sourceScenes) {
                const newSceneId = uuidv4();
                if (!firstSceneId) firstSceneId = newSceneId;
                sceneIdMapping[scene.id] = newSceneId;
                
                tx
                    .insert(scenes)
                    .values({
                        id: newSceneId,
                        boardId: boardId,
                        title: scene.title,
                        description: scene.description,
                        mode: scene.mode,
                        seq: scene.seq,
                        allowAddCards: scene.allowAddCards,
                        allowEditCards: scene.allowEditCards,
                        allowObscureCards: scene.allowObscureCards,
                        allowMoveCards: scene.allowMoveCards,
                        allowGroupCards: scene.allowGroupCards,
                        showVotes: scene.showVotes,
                        allowVoting: scene.allowVoting,
                        showComments: scene.showComments,
                        allowComments: scene.allowComments,
                        multipleVotesPerCard: scene.multipleVotesPerCard,
                        createdAt: new Date().toISOString()
                    })
                    .run();
            }
            
            // Clone scene column settings
            const sourceScenesColumns = tx
                .select()
                .from(scenesColumns)
                .where(eq(scenesColumns.sceneId, data.sourceId))
                .all();
            
            // Find scenes_columns entries for any scene in the source board
            const allSourceScenesColumns = tx
                .select({ sceneId: scenesColumns.sceneId, columnId: scenesColumns.columnId, state: scenesColumns.state })
                .from(scenesColumns)
                .innerJoin(scenes, eq(scenes.id, scenesColumns.sceneId))
                .where(eq(scenes.boardId, data.sourceId))
                .all();
            
            for (const sceneColumn of allSourceScenesColumns) {
                const newSceneId = sceneIdMapping[sceneColumn.sceneId];
                const newColumnId = columnIdMapping[sceneColumn.columnId];
                
                if (newSceneId && newColumnId) {
                    tx
                        .insert(scenesColumns)
                        .values({
                            sceneId: newSceneId,
                            columnId: newColumnId,
                            state: sceneColumn.state
                        })
                        .run();
                }
            }
            
            // Set current scene to first scene if any scenes were cloned
            if (firstSceneId) {
                tx
                    .update(boards)
                    .set({ currentSceneId: firstSceneId })
                    .where(eq(boards.id, boardId))
                    .run();
            }
        });
        
        return json({ success: true });
    } catch (error) {
        return handleApiError(error, 'Failed to clone board');
    }
};