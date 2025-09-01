import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { updateScene, deleteScene } from '$lib/server/repositories/scene.js';
import { z } from 'zod';

const updateSceneSchema = z.object({
	title: z.string().min(1).max(100).optional(),
	mode: z.enum(['columns', 'present', 'review']).optional(),
	allowAddCards: z.boolean().optional(),
	allowEditCards: z.boolean().optional(),
	allowComments: z.boolean().optional(),
	allowVoting: z.boolean().optional()
});

export const PATCH: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const boardId = event.params.id;
		const sceneId = event.params.sceneId;
		const body = await event.request.json();
		const data = updateSceneSchema.parse(body);
		
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
		
		const updatedScene = await updateScene(sceneId, data);
		
		return json({
			success: true,
			scene: updatedScene
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
		
		console.error('Error updating scene:', error);
		return json(
			{ 
				success: false, 
				error: 'Failed to update scene',
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
		const sceneId = event.params.sceneId;
		
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
		
		await deleteScene(sceneId);
		
		return json({
			success: true
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}
		
		console.error('Error deleting scene:', error);
		return json(
			{ 
				success: false, 
				error: 'Failed to delete scene',
				details: error instanceof Error ? error.message : String(error)
			},
			{ status: 500 }
		);
	}
};