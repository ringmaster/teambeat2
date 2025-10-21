import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { findCardById } from '$lib/server/repositories/card.js';
import { castVote, getVoteContext, getVoteCountsByCard } from '$lib/server/repositories/vote.js';
import { broadcastVoteChanged, broadcastVoteChangedToUser, broadcastVoteUpdatesBasedOnScene } from '$lib/server/sse/broadcast.js';
import { updatePresence } from '$lib/server/repositories/presence.js';
import { buildComprehensiveVotingData } from '$lib/server/utils/voting-data.js';
import { enrichCardWithCounts } from '$lib/server/utils/cards-data.js';
import { getSceneCapability } from '$lib/utils/scene-capability.js';

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
        { success: false, error: 'Invalid JSON in request body', details: parseError instanceof Error ? parseError.message : 'Parse error' },
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

    // Single optimized query to get all validation data
    const context = await getVoteContext(cardId, user.userId);

    if (!context) {
      console.error('Card not found:', cardId);
      return json(
        { success: false, error: 'Card not found', details: `Card ID: ${cardId}` },
        { status: 404 }
      );
    }

    const { card, board, userRole, currentVoteCount } = context;

    // Check if card is a subordinate card (has groupId but is not group lead)
    if (card.groupId && !card.isGroupLead) {
      return json(
        { success: false, error: 'Cannot vote on subordinate cards. Vote on the group lead card instead.' },
        { status: 403 }
      );
    }

    // Update user presence on this board
    await updatePresence(user.userId, board.id);

    // Check if user has access to this board (userRole is null if not a member)
    if (!userRole) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Check if current scene allows voting
    if (!getSceneCapability(board.currentScene, board.status, 'allow_voting')) {
      return json(
        { success: false, error: 'Voting not allowed in current scene' },
        { status: 403 }
      );
    }

    // Check voting allocation using vote count from context
    if (delta > 0) {
      const maxVotes = board.votingAllocation;
      if (currentVoteCount >= maxVotes) {
        return json(
          { success: false, error: 'No votes remaining' },
          { status: 400 }
        );
      }
    }

    if (delta < 0) {
      if (currentVoteCount <= 0) {
        return json(
          { success: false, error: 'No votes to remove' },
          { status: 400 }
        );
      }
    }

    // Cast the vote
    const voteResult = await castVote(cardId, user.userId, delta);

    // Get updated card data - fetch single card instead of all cards for board
    const updatedCard = await findCardById(cardId);

    if (!updatedCard) {
      return json(
        { success: false, error: 'Card not found after vote update' },
        { status: 404 }
      );
    }

    // Enrich card with comment counts and reactions before returning
    const enrichedCard = await enrichCardWithCounts(updatedCard);
    const voteCount = enrichedCard.voteCount;

    // Get comprehensive voting data for the response
    const comprehensiveVotingData = await buildComprehensiveVotingData(board.id, user.userId, board.seriesId, board.votingAllocation);

    // Build the response with user's voting data
    const response: any = {
      success: true,
      card: enrichedCard,
      voteResult,
      user_voting_data: comprehensiveVotingData.user_voting_data,
      voting_stats: comprehensiveVotingData.voting_stats
    };

    // Check capabilities based on scene and board status
    const canShowVotes = getSceneCapability(board.currentScene, board.status, 'show_votes');
    const canAllowVoting = getSceneCapability(board.currentScene, board.status, 'allow_voting');

    // If "show votes" is enabled, include total votes for all cards
    if (canShowVotes) {
      // Use optimized aggregation query instead of fetching all votes
      const voteCountsByCard = await getVoteCountsByCard(board.id);
      response.all_votes_by_card = voteCountsByCard;
    }

    // Prepare data for broadcasting to avoid redundant queries
    const voteCountsByCard = canShowVotes ? (response.all_votes_by_card || await getVoteCountsByCard(board.id)) : undefined;
    const votingStats = comprehensiveVotingData.voting_stats;

    // Broadcast vote changes based on scene settings
    if (canShowVotes) {
      // Broadcast the specific card vote count update first for immediate UI feedback
      await broadcastVoteChanged(board.id, cardId, voteCount, user.userId);
    } else if (canAllowVoting) {
      // Broadcast individual vote to the voting user for immediate feedback
      await broadcastVoteChangedToUser(board.id, cardId, voteCount, user.userId);
    }

    // Then broadcast comprehensive updates based on scene settings - pass pre-fetched data
    await broadcastVoteUpdatesBasedOnScene(
      board.id,
      {
        showVotes: canShowVotes || undefined,
        allowVoting: canAllowVoting || undefined
      },
      user.userId,
      false,
      voteCountsByCard,
      votingStats
    );

    return json(response);
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
        context: { cardId: event.params.id }
      },
      { status: 500 }
    );
  }
};
