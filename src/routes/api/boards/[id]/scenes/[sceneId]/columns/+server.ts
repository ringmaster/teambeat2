import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { db } from '$lib/server/db/index.js';
import { scenesColumns, scenes } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { broadcastSceneChanged } from '$lib/server/sse/broadcast.js';

const updateColumnDisplaySchema = z.object({
	columnId: z.string().uuid(),
	state: z.enum(['visible', 'hidden'])
});

export const PUT: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const boardId = event.params.id;
		const sceneId = event.params.sceneId;
		const body = await event.request.json();
		const data = updateColumnDisplaySchema.parse(body);
		
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
		
		// If visible, delete the row; if hidden, create/update it
		if (data.state === 'visible') {
			// Delete the row to indicate visible state (default)
			await db
				.delete(scenesColumns)
				.where(and(
					eq(scenesColumns.sceneId, sceneId),
					eq(scenesColumns.columnId, data.columnId)
				));
		} else {
			// Insert or update to hidden state
			await db
				.insert(scenesColumns)
				.values({
					sceneId,
					columnId: data.columnId,
					state: 'hidden'
				})
				.onConflictDoUpdate({
					target: [scenesColumns.sceneId, scenesColumns.columnId],
					set: {
						state: 'hidden'
					}
				});
		}
		
		// Get the updated board data with column visibility to broadcast
		const updatedBoard = await getBoardWithDetails(boardId);
		
		// Broadcast board update to all connected clients so they get the updated hiddenColumnsByScene
		if (updatedBoard) {
			const { broadcastBoardUpdated } = await import('$lib/server/sse/broadcast.js');
			broadcastBoardUpdated(boardId, updatedBoard);
		}
		
		return json({
			success: true
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
		
		console.error('Error updating scene column settings:', error);
		return json(
			{ 
				success: false, 
				error: 'Failed to update column display settings',
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};