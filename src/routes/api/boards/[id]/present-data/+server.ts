import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserForApi } from '$lib/server/auth/index.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { buildPresentModeData } from '$lib/server/utils/present-mode-data.js';

export const GET: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const { id: boardId } = event.params;

    // Get board and verify access
    const board = await getBoardWithDetails(boardId);
    if (!board) {
      return json({ success: false, error: 'Board not found' }, { status: 404 });
    }

    // Check if user has access to this board
    const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!userRole) {
      return json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Use shared function to build present mode data
    const presentModeData = await buildPresentModeData(boardId, user.userId);

    return json({
      success: true,
      ...presentModeData,
      current_user_role: userRole
    });
  } catch (error) {
    console.error('Error fetching present mode data:', error);
    return json(
      {
        success: false,
        error: 'Failed to fetch present mode data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
};
