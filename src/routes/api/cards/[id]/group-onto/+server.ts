import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { 
	findCardById, 
	groupCardOntoTarget, 
	ungroupCard,
	moveGroupToColumn,
	moveCardToColumn,
	getCardsForBoard 
} from '$lib/server/repositories/card.js';
import { getBoardWithDetails, findBoardByColumnId } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { broadcastCardUpdated } from '$lib/server/websockets/broadcast.js';
import { z } from 'zod';

const groupOntoSchema = z.object({
	targetCardId: z.string().uuid()
});

const moveToColumnSchema = z.object({
	columnId: z.string().uuid()
});

export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const cardId = event.params.id;
		const body = await event.request.json();
		const data = groupOntoSchema.parse(body);
		
		const card = await findCardById(cardId);
		if (!card) {
			return json(
				{ success: false, error: 'Card not found' },
				{ status: 404 }
			);
		}
		
		const targetCard = await findCardById(data.targetCardId);
		if (!targetCard) {
			return json(
				{ success: false, error: 'Target card not found' },
				{ status: 404 }
			);
		}
		
		// Get board information
		const boardId = await findBoardByColumnId(card.columnId);
		if (!boardId) {
			return json(
				{ success: false, error: 'Column not found' },
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
		
		// Check if current scene allows grouping cards
		const currentScene = board.scenes.find(s => s.id === board.currentSceneId);
		if (!currentScene || !currentScene.allowGroupCards) {
			return json(
				{ success: false, error: 'Grouping cards not allowed in current scene' },
				{ status: 403 }
			);
		}
		
		const result = await groupCardOntoTarget(cardId, data.targetCardId);
		
		// Get all affected cards and broadcast updates
		const updatedCards = await getCardsForBoard(board.id);
		const affectedCards = updatedCards.filter(c => c.groupId === result.targetGroupId);
		
		for (const affectedCard of affectedCards) {
			broadcastCardUpdated(board.id, affectedCard);
		}
		
		// Broadcast updates for any cards affected by ungrouping (like lead card losing status)
		for (const affectedCardId of result.affectedCardIds) {
			const affectedCard = updatedCards.find(c => c.id === affectedCardId);
			if (affectedCard) {
				broadcastCardUpdated(board.id, affectedCard);
			}
		}
		
		return json({
			success: true,
			groupId: result.targetGroupId
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

export const DELETE: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const cardId = event.params.id;
		const body = await event.request.json();
		const data = moveToColumnSchema.parse(body);
		
		const card = await findCardById(cardId);
		if (!card) {
			return json(
				{ success: false, error: 'Card not found' },
				{ status: 404 }
			);
		}
		
		// Get board information
		const boardId = await findBoardByColumnId(card.columnId);
		if (!boardId) {
			return json(
				{ success: false, error: 'Column not found' },
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
		
		// Check if current scene allows grouping cards
		const currentScene = board.scenes.find(s => s.id === board.currentSceneId);
		if (!currentScene || !currentScene.allowGroupCards) {
			return json(
				{ success: false, error: 'Grouping cards not allowed in current scene' },
				{ status: 403 }
			);
		}
		
		// Store the original group ID before ungrouping
		const originalGroupId = card.groupId;
		
		const ungroupResult = await ungroupCard(cardId);
		
		// Move the ungrouped card to the target column
		await moveCardToColumn(cardId, data.columnId);
		
		// Get all cards and broadcast updates
		const updatedCards = await getCardsForBoard(board.id);
		
		// Broadcast update for the ungrouped card
		const ungroupedCard = updatedCards.find(c => c.id === cardId);
		if (ungroupedCard) {
			broadcastCardUpdated(board.id, ungroupedCard);
		}
		
		// Broadcast updates for any cards affected by ungrouping (like last remaining card losing group lead status)
		for (const affectedCardId of ungroupResult.affectedCardIds) {
			const affectedCard = updatedCards.find(c => c.id === affectedCardId);
			if (affectedCard) {
				broadcastCardUpdated(board.id, affectedCard);
			}
		}
		
		// Broadcast updates for remaining cards in the original group
		if (originalGroupId) {
			const remainingGroupCards = updatedCards.filter(c => c.groupId === originalGroupId);
			for (const groupCard of remainingGroupCards) {
				broadcastCardUpdated(board.id, groupCard);
			}
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
			{ success: false, error: 'Failed to ungroup card' },
			{ status: 500 }
		);
	}
};