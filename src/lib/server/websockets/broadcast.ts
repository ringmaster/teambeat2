import { wsManager } from './manager.js';
import type { WebSocketMessage } from './manager.js';

export function broadcastCardCreated(boardId: string, card: any) {
	const message: WebSocketMessage = {
		type: 'card_created',
		board_id: boardId,
		card,
		timestamp: Date.now()
	};
	
	wsManager.broadcastToBoard(boardId, message);
}

export function broadcastCardUpdated(boardId: string, card: any) {
	const message: WebSocketMessage = {
		type: 'card_updated',
		board_id: boardId,
		card,
		timestamp: Date.now()
	};
	
	wsManager.broadcastToBoard(boardId, message);
}

export function broadcastCardDeleted(boardId: string, cardId: string) {
	const message: WebSocketMessage = {
		type: 'card_deleted',
		board_id: boardId,
		card_id: cardId,
		timestamp: Date.now()
	};
	
	wsManager.broadcastToBoard(boardId, message);
}

export function broadcastVoteChanged(boardId: string, cardId: string, voteCount: number) {
	const message: WebSocketMessage = {
		type: 'vote_changed',
		board_id: boardId,
		card_id: cardId,
		vote_count: voteCount,
		timestamp: Date.now()
	};
	
	wsManager.broadcastToBoard(boardId, message);
}

export function broadcastSceneChanged(boardId: string, sceneId: string) {
	const message: WebSocketMessage = {
		type: 'scene_changed',
		board_id: boardId,
		scene_id: sceneId,
		timestamp: Date.now()
	};
	
	wsManager.broadcastToBoard(boardId, message);
}

export function broadcastCommentAdded(boardId: string, comment: any) {
	const message: WebSocketMessage = {
		type: 'comment_added',
		board_id: boardId,
		comment,
		timestamp: Date.now()
	};
	
	wsManager.broadcastToBoard(boardId, message);
}

export function broadcastTimerUpdate(boardId: string, timer: any) {
	const message: WebSocketMessage = {
		type: 'timer_update',
		board_id: boardId,
		timer,
		timestamp: Date.now()
	};
	
	wsManager.broadcastToBoard(boardId, message);
}