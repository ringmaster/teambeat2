import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { findCardById, getCardsForBoard } from '$lib/server/repositories/card.js';
import { findBoardByColumnId, getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { castVote, checkVotingAllocation, calculateAggregateVotingStats } from '$lib/server/repositories/vote.js';
import { broadcastVoteChanged, broadcastVoteChangedToUser, broadcastVotingStatsUpdate } from '$lib/server/sse/broadcast.js';
import { updatePresence } from '$lib/server/repositories/presence.js';

export const POST: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const cardId = event.params.id;

    let requestBody;
    try {
      requestBody = await event.request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return json(
        { success: false, error: 'Invalid JSON in request body', details: parseError.message },
        { status: 400 }
      );
    }

    const { delta } = requestBody;

    // Validate delta parameter
    if (delta !== 1 && delta !== -1) {
      console.error('Invalid delta value:', delta);
      return json(
        { success: false, error: 'Invalid delta value. Must be 1 or -1', details: `Received: ${delta}` },
        { status: 400 }
      );
    }
    console.log('Vote delta:', delta, 'User:', user.userId);

    const card = await findCardById(cardId);
    if (!card) {
      console.error('Card not found:', cardId);
      return json(
        { success: false, error: 'Card not found', details: `Card ID: ${cardId}` },
        { status: 404 }
      );
    }

    // Check if card is a subordinate card (has groupId but is not group lead)
    if (card.groupId && !card.isGroupLead) {
      return json(
        { success: false, error: 'Cannot vote on subordinate cards. Vote on the group lead card instead.' },
        { status: 403 }
      );
    }

    // Get board information
    const boardId = await findBoardByColumnId(card.columnId);
    if (!boardId) {
      console.error('Column not found for card:', card.columnId);
      return json(
        { success: false, error: 'Column not found', details: `Column ID: ${card.columnId}` },
        { status: 404 }
      );
    }

    // Find the board this card belongs to
    const board = await getBoardWithDetails(boardId);
    if (!board) {
      console.error('Board not found:', boardId);
      return json(
        { success: false, error: 'Board not found for card', details: `Board ID: ${boardId}` },
        { status: 404 }
      );
    }

    // Update user presence on this board
    await updatePresence(user.userId, board.id);

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
    const allocation = await checkVotingAllocation(user.userId, board.id, board.votingAllocation);
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
    console.log('Casting vote:', { cardId, userId: user.userId, delta });
    const voteResult = await castVote(cardId, user.userId, delta);
    console.log('Vote result:', voteResult);

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
      // If "show votes" is enabled, broadcast individual card vote totals to all users
      broadcastVoteChanged(board.id, cardId, voteCount);
    } else if (currentScene.allowVoting) {
      // If only "allow voting" is enabled, broadcast individual vote to the voting user
      broadcastVoteChangedToUser(board.id, cardId, voteCount, user.userId);

      // For all users (including the voter), broadcast aggregate voting statistics
      // This updates the voting toolbar without revealing individual card votes
      try {
        const aggregateStats = await calculateAggregateVotingStats(board.id, board.seriesId, board.votingAllocation);
        broadcastVotingStatsUpdate(board.id, aggregateStats);
      } catch (error) {
        console.error('Failed to broadcast voting stats update:', error);
      }
    }

    return json({
      success: true,
      card: updatedCard,
      voteResult,
      allocation: await checkVotingAllocation(user.userId, board.id, board.votingAllocation)
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error('Vote casting error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : null;

    return json(
      {
        success: false,
        error: 'Failed to cast vote',
        details: errorMessage,
        stack: errorStack,
        timestamp: new Date().toISOString(),
        context: { cardId, userId: user.userId, delta: requestBody?.delta }
      },
      { status: 500 }
    );
  }
};
