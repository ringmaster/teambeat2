import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getBoardWithDetails, updateColumn, deleteColumn } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { broadcastColumnsUpdated } from '$lib/server/sse/broadcast.js';
import { db } from '$lib/server/db/index.js';
import { columns } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateColumnSchema = z.object({
	title: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional().nullable(),
	defaultAppearance: z.string().optional()
});

export const PATCH: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const boardId = event.params.id;
		const columnId = event.params.columnId;
		const body = await event.request.json();
		const data = updateColumnSchema.parse(body);

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

		const updatedColumn = await updateColumn(columnId, data);

		// Get all columns for broadcast
		const allColumns = await db
			.select()
			.from(columns)
			.where(eq(columns.boardId, boardId))
			.orderBy(columns.seq);

		// Broadcast the updated columns
		broadcastColumnsUpdated(boardId, allColumns);

		return json({
			success: true,
			column: updatedColumn
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

		console.error('Error updating column:', error);
		return json(
			{
				success: false,
				error: 'Failed to update column',
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
		const columnId = event.params.columnId;

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

		await deleteColumn(columnId);

		// Get all remaining columns for broadcast
		const allColumns = await db
			.select()
			.from(columns)
			.where(eq(columns.boardId, boardId))
			.orderBy(columns.seq);

		// Broadcast the updated columns
		broadcastColumnsUpdated(boardId, allColumns);

		return json({
			success: true
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}

		console.error('Error deleting column:', error);
		return json(
			{
				success: false,
				error: 'Failed to delete column',
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};
