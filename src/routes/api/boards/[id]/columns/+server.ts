import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { findBoardById } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { broadcastColumnsUpdated } from '$lib/server/sse/broadcast.js';
import { db } from '$lib/server/db/index.js';
import { columns, boards } from '$lib/server/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const boardId = event.params.id;
		const body = await event.request.json();
		
		// Validate input
		const { title, description, defaultAppearance } = body;
		
		if (!title?.trim()) {
			return json(
				{ success: false, error: 'Column title is required' },
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
		
		// Check if user has permission to create columns (admin or facilitator)
		const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
		if (!['admin', 'facilitator'].includes(userRole)) {
			return json(
				{ success: false, error: 'Only administrators and facilitators can create columns' },
				{ status: 403 }
			);
		}
		
		// Get the next sequence number
		const existingColumns = await db
			.select({ seq: columns.seq })
			.from(columns)
			.where(eq(columns.boardId, boardId))
			.orderBy(desc(columns.seq))
			.limit(1);
		
		const nextSeq = existingColumns.length > 0 ? existingColumns[0].seq + 1 : 1;
		
		// Create the column
		const columnId = uuidv4();
		await db
			.insert(columns)
			.values({
				id: columnId,
				boardId: boardId,
				title: title.trim(),
				description: description?.trim() || null,
				defaultAppearance: defaultAppearance || 'shown',
				seq: nextSeq
			});
		
		// Get the created column with all its details
		const newColumn = await db
			.select()
			.from(columns)
			.where(eq(columns.id, columnId))
			.get();
		
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
			column: newColumn
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}
		
		console.error('Failed to create column:', error);
		return json(
			{ 
				success: false, 
				error: 'Failed to create column',
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};