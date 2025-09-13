import { sseManager } from './manager.js';
import type { SSEMessage } from './manager.js';
import { buildVotingStatsUpdatedMessage } from '../utils/voting-data.js';

export function broadcastCardCreated(boardId: string, card: any) {
  const message: SSEMessage = {
    type: 'card_created',
    board_id: boardId,
    card,
    timestamp: Date.now()
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastCardUpdated(boardId: string, card: any) {
  const message: SSEMessage = {
    type: 'card_updated',
    board_id: boardId,
    card,
    timestamp: Date.now()
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastCardDeleted(boardId: string, cardId: string) {
  const message: SSEMessage = {
    type: 'card_deleted',
    board_id: boardId,
    card_id: cardId,
    timestamp: Date.now()
  };

  sseManager.broadcastToBoard(boardId, message);
}

export async function broadcastVoteChanged(boardId: string, cardId: string, voteCount: number, _userId?: string) {
  try {
    console.log('Broadcasting simple vote changed:', { boardId, cardId, voteCount });
    const message: SSEMessage = {
      type: 'vote_changed',
      board_id: boardId,
      card_id: cardId,
      vote_count: voteCount,
      timestamp: Date.now()
    };
    console.log('Simple vote changed message created');
    sseManager.broadcastToBoard(boardId, message);
  } catch (error) {
    console.error('Failed to broadcast vote changed:', error);
    throw error;
  }
}

export async function broadcastVoteChangedToUser(boardId: string, cardId: string, voteCount: number, userId: string) {
  try {
    console.log('Broadcasting simple vote changed to user:', { boardId, cardId, voteCount, userId });
    const message: SSEMessage = {
      type: 'vote_changed',
      board_id: boardId,
      card_id: cardId,
      vote_count: voteCount,
      user_id: userId,
      timestamp: Date.now()
    };
    console.log('Simple vote changed to user message created');
    sseManager.broadcastToUser(boardId, userId, message);
  } catch (error) {
    console.error('Failed to broadcast vote changed to user:', error);
    throw error;
  }
}

export function broadcastCommentAdded(boardId: string, comment: any) {
  const message: SSEMessage = {
    type: 'comment_added',
    board_id: boardId,
    comment,
    timestamp: Date.now()
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastTimerUpdate(boardId: string, timer: any) {
  const message: SSEMessage = {
    type: 'timer_update',
    board_id: boardId,
    timer,
    timestamp: Date.now()
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastBoardUpdated(boardId: string, board: any) {
  const message: SSEMessage = {
    type: 'board_updated',
    board_id: boardId,
    board,
    timestamp: Date.now()
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastColumnsUpdated(boardId: string, columns: any[]) {
  const message: SSEMessage = {
    type: 'columns_updated',
    board_id: boardId,
    columns,
    timestamp: Date.now()
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastSceneChanged(boardId: string, sceneData: any) {
  const message: SSEMessage = {
    type: 'scene_changed',
    board_id: boardId,
    scene: sceneData,
    timestamp: Date.now()
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastUserJoined(boardId: string, userId: string) {
  const message: SSEMessage = {
    type: 'user_joined',
    board_id: boardId,
    user_id: userId,
    timestamp: Date.now()
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastUserLeft(boardId: string, userId: string) {
  const message: SSEMessage = {
    type: 'user_left',
    board_id: boardId,
    user_id: userId,
    timestamp: Date.now()
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastPresenceUpdate(boardId: string, userId: string, activity: any) {
  const message: SSEMessage = {
    type: 'presence_update',
    board_id: boardId,
    user_id: userId,
    activity,
    timestamp: Date.now()
  };

  sseManager.broadcastToBoard(boardId, message);
}

export async function broadcastVotingStatsUpdate(boardId: string, votingStats?: any) {
  try {
    console.log('Broadcasting voting stats update with full data:', { boardId });
    const message = await buildVotingStatsUpdatedMessage(boardId, votingStats);
    console.log('Full voting stats update message created');
    sseManager.broadcastToBoard(boardId, message);
  } catch (error) {
    console.error('Failed to broadcast voting stats update:', error);
    throw error;
  }
}

export async function broadcastVotingStatsUpdateExcludingUser(boardId: string, excludeUserId: string, votingStats?: any) {
  try {
    console.log('Broadcasting voting stats update with full data excluding user:', { boardId, excludeUserId });
    const message = await buildVotingStatsUpdatedMessage(boardId, votingStats);
    console.log('Full voting stats update message created, broadcasting excluding user');
    sseManager.broadcastToBoard(boardId, message, excludeUserId);
  } catch (error) {
    console.error('Failed to broadcast voting stats update excluding user:', error);
    throw error;
  }
}
