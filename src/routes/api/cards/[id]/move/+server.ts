import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { findCardById, moveCardToColumn } from '$lib/server/repositories/card.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { broadcastCardUpdated } from '$lib/server/websockets/broadcast.js';
import { z } from 'zod';

const moveCardSchema = z.object({
	columnId: z.string().uuid()
});

export const PUT: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const cardId = event.params.id;
		const body = await event.request.json();
		const data = moveCardSchema.parse(body);
		
		const card = await findCardById(cardId);
		if (!card) {
			return json(
				{ success: false, error: 'Card not found' },
				{ status: 404 }
			);
		}
		
		// Get board information through column relationship
		const board = await getBoardWithDetails(card.columnId);
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
				{ success: false, error: 'Moving cards not allowed in current scene' },
				{ status: 403 }
			);
		}
		
		// Verify the target column exists in this board
		const targetColumn = board.columns.find(col => col.id === data.columnId);
		if (!targetColumn) {
			return json(
				{ success: false, error: 'Target column not found' },
				{ status: 404 }
			);
		}
		
		const updatedCard = await moveCardToColumn(cardId, data.columnId);
		
		// Broadcast the updated card to all clients
		broadcastCardUpdated(board.id, updatedCard);
		
		return json({
			success: true,
			card: updatedCard
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
			{ success: false, error: 'Failed to move card' },
			{ status: 500 }
		);
	}
};