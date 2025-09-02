import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { findCardById } from '$lib/server/repositories/card.js';
import { getBoardWithDetails, findBoardByColumnId } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { castVote, checkVotingAllocation, getCardVotes } from '$lib/server/repositories/vote.js';
import { broadcastVoteChanged } from '$lib/server/websockets/broadcast.js';

export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const cardId = event.params.id;
		
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
		
		// Check if current scene allows voting
		const currentScene = board.scenes.find(s => s.id === board.currentSceneId);
		if (!currentScene || !currentScene.allowVoting) {
			return json(
				{ success: false, error: 'Voting not allowed in current scene' },
				{ status: 403 }
			);
		}
		
		// Check voting allocation
		const allocation = await checkVotingAllocation(user.userId, board.id, board.votingAllocation || 3);
		if (!allocation.canVote) {
			return json(
				{ success: false, error: 'No votes remaining', allocation },
				{ status: 400 }
			);
		}
		
		// Cast the vote
		const voteResult = await castVote(cardId, user.userId);
		
		// Get updated vote count
		const votes = await getCardVotes(cardId);
		const voteCount = votes.length;
		
		// Broadcast the vote change to all clients
		broadcastVoteChanged(board.id, cardId, voteCount);
		
		return json({
			success: true,
			voteResult,
			voteCount,
			allocation: await checkVotingAllocation(user.userId, board.id, board.votingAllocation || 3)
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}
		
		return json(
			{ success: false, error: 'Failed to cast vote' },
			{ status: 500 }
		);
	}
};