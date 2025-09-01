import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { updateCard, getCardById } from '$lib/server/repositories/card.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { broadcastCardUpdated } from '$lib/server/websockets/broadcast.js';
import { z } from 'zod';

const updateCardSchema = z.object({
	content: z.string().min(1).max(1000).optional(),
	groupId: z.string().uuid().nullable().optional()
});

export const PATCH: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const boardId = event.params.id;
		const cardId = event.params.cardId;
		const body = await event.request.json();
		const data = updateCardSchema.parse(body);
		
		// Get the card to verify it exists and get its column
		const existingCard = await getCardById(cardId);
		if (!existingCard) {
			return json(
				{ success: false, error: 'Card not found' },
				{ status: 404 }
			);
		}
		
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
		
		const updatedCard = await updateCard(cardId, data);
		
		// Broadcast the updated card to all clients
		broadcastCardUpdated(boardId, updatedCard);
		
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
			{ success: false, error: 'Failed to update card' },
			{ status: 500 }
		);
	}
};