import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { checkVotingAllocation, getUserVotesForBoard } from '$lib/server/repositories/vote.js';

export const GET: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
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

    // Get user's voting allocation
    const allocation = await checkVotingAllocation(user.userId, boardId, board.votingAllocation);

    // Get user's current votes on this board
    const userVotes = await getUserVotesForBoard(user.userId, boardId);

    return json({
      success: true,
      allocation,
      userVotes,
      votingAllocation: board.votingAllocation
    });
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
