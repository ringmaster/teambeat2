import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { groupCards } from '$lib/server/repositories/card.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { broadcastCardUpdated } from '$lib/server/sse/broadcast.js';
import { z } from 'zod';

const groupCardsSchema = z.object({
	cardIds: z.array(z.string().uuid()).min(2),
	groupId: z.string().uuid().optional()
});

export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const boardId = event.params.id;
		const body = await event.request.json();
		const data = groupCardsSchema.parse(body);
		
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
		
		// Check if current scene allows editing cards
		const currentScene = board.scenes.find(s => s.id === board.currentSceneId);
		if (!currentScene || !currentScene.allowEditCards) {
			return json(
				{ success: false, error: 'Editing cards not allowed in current scene' },
				{ status: 403 }
			);
		}
		
		const groupId = await groupCards(data.cardIds, data.groupId);
		
		// Broadcast updates for all affected cards
		// Note: This is a simplified approach. In a more sophisticated implementation,
		// we might want to fetch and broadcast the actual updated cards
		
		return json({
			success: true,
			groupId
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
			{ success: false, error: 'Failed to group cards' },
			{ status: 500 }
		);
	}
};