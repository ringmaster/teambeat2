import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { buildUserVotingApiResponse } from '$lib/server/utils/voting-data.js';

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

    // Use centralized data construction for consistency with SSE messages
    const response = await buildUserVotingApiResponse(boardId, user.userId, true);
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
