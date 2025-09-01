import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getBoardWithDetails, updateBoardStatus, updateBoardSettings } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { z } from 'zod';

const updateBoardSchema = z.object({
	status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
	name: z.string().min(1).max(100).optional(),
	blameFreeMode: z.boolean().optional(),
	votingAllocation: z.number().int().min(1).max(20).optional(),
	votingEnabled: z.boolean().optional()
});

export const GET: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const boardId = event.params.id;
		
		const board = await getBoardWithDetails(boardId);
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
		
		return json({
			success: true,
			board,
			userRole
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}
		
		return json(
			{ success: false, error: 'Failed to fetch board' },
			{ status: 500 }
		);
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const boardId = event.params.id;
		const body = await event.request.json();
		const data = updateBoardSchema.parse(body);
		
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
		
		if (data.status) {
			await updateBoardStatus(boardId, data.status);
		}
		
		// Update board settings if provided
		const settingsData = {
			name: data.name,
			blameFreeMode: data.blameFreeMode,
			votingAllocation: data.votingAllocation,
			votingEnabled: data.votingEnabled
		};
		
		// Filter out undefined values
		const filteredSettingsData = Object.fromEntries(
			Object.entries(settingsData).filter(([_, v]) => v !== undefined)
		);
		
		if (Object.keys(filteredSettingsData).length > 0) {
			await updateBoardSettings(boardId, filteredSettingsData);
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
		
		return json(
			{ success: false, error: 'Failed to update board' },
			{ status: 500 }
		);
	}
};

export const PATCH: RequestHandler = PUT;