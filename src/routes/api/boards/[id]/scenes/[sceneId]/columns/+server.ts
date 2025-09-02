import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { db } from '$lib/server/db/index.js';
import { sceneColumnSettings } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const updateColumnDisplaySchema = z.object({
	columnId: z.string().uuid(),
	display: z.enum(['show', 'hide', 'solo'])
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
		
		// Upsert the scene column setting
		await db
			.insert(sceneColumnSettings)
			.values({
				sceneId,
				columnId: data.columnId,
				display: data.display
			})
			.onConflictDoUpdate({
				target: [sceneColumnSettings.sceneId, sceneColumnSettings.columnId],
				set: {
					display: data.display
				}
			});
		
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