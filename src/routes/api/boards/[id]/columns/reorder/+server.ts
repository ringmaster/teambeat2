import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getBoardWithDetails, reorderColumns } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { z } from 'zod';

const reorderColumnsSchema = z.object({
	columnOrders: z.array(z.object({
		id: z.string().uuid(),
		seq: z.number().int().min(0)
	}))
});

export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const boardId = event.params.id;
		const body = await event.request.json();
		const data = reorderColumnsSchema.parse(body);
		
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
		
		await reorderColumns(boardId, data.columnOrders);
		
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
		
		console.error('Error reordering columns:', error);
		return json(
			{ 
				success: false, 
				error: 'Failed to reorder columns',
				details: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined
			},
			{ status: 500 }
		);
	}
};