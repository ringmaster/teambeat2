import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserForApi } from '$lib/server/auth/index.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { buildUserVotingApiResponse } from '$lib/server/utils/voting-data.js';
import { getAllUsersVotesForBoard } from '$lib/server/repositories/vote.js';

export const GET: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const boardId = event.params.id;

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

    // Check if current scene shows votes to determine what data to return
    const currentScene = board.scenes?.find(s => s.id === board.currentSceneId);
    const shouldShowAllVotes = currentScene?.showVotes || false;

    // Use centralized data construction for consistency with SSE messages
    const response = await buildUserVotingApiResponse(boardId, user.userId);

    // If votes are visible, add all users' vote counts by card
    if (shouldShowAllVotes) {
      const allVotes = await getAllUsersVotesForBoard(boardId);

      // Build vote counts by card (card_id -> total_votes)
      const voteCountsByCard: Record<string, number> = {};
      allVotes.forEach(vote => {
        voteCountsByCard[vote.cardId] = (voteCountsByCard[vote.cardId] || 0) + 1;
      });

      response.all_votes_by_card = voteCountsByCard;
    }

    return json(response);
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    return json(
      { success: false, error: 'Failed to fetch user voting data' },
      { status: 500 }
    );
  }
};
