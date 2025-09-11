import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { findCardById, getCardsForBoard } from '$lib/server/repositories/card.js';
import { getBoardWithDetails, findBoardByColumnId } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { castVote, checkVotingAllocation } from '$lib/server/repositories/vote.js';
import { broadcastVoteChanged, broadcastVoteChangedToUser } from '$lib/server/sse/broadcast.js';

export const POST: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const cardId = event.params.id;
    const { delta } = await event.request.json();

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
    if (!allocation.canVote && delta > 0) {
      return json(
        { success: false, error: 'No votes remaining', allocation },
        { status: 400 }
      );
    }
    if (delta < 0 && allocation.currentVotes <= 0) {
      return json(
        { success: false, error: 'No votes cast', allocation },
        { status: 400 }
      );
    }

    // Cast the vote
    const voteResult = await castVote(cardId, user.userId, delta);

    // Get updated card data with vote count
    const updatedCards = await getCardsForBoard(board.id);
    const updatedCard = updatedCards.find(c => c.id === cardId);

    if (!updatedCard) {
      return json(
        { success: false, error: 'Card not found after vote update' },
        { status: 404 }
      );
    }

    const voteCount = updatedCard.voteCount;

    // Broadcast vote changes based on scene settings
    if (currentScene.showVotes) {
      // If "show votes" is enabled, broadcast totals to all users
      broadcastVoteChanged(board.id, cardId, voteCount);
    } else if (currentScene.allowVoting) {
      // If only "allow voting" is enabled, broadcast only to the voting user
      broadcastVoteChangedToUser(board.id, cardId, voteCount, user.userId);
    }

    return json({
      success: true,
      card: updatedCard,
      voteResult,
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
