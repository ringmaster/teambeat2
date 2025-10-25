import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserForApi } from '$lib/server/auth/index.js';
import { getBoardWithDetails, updateBoardSettings } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { clearBoardVotes } from '$lib/server/repositories/vote.js';
import { broadcastBoardUpdated, broadcastVoteUpdatesBasedOnScene } from '$lib/server/sse/broadcast.js';
import { getSceneCapability, getCurrentScene } from '$lib/utils/scene-capability.js';

export const DELETE: RequestHandler = async (event) => {
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

    // Check if user has facilitator access to this board
    const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!userRole || !['admin', 'facilitator'].includes(userRole)) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Clear all votes on this board
    const clearResult = await clearBoardVotes(boardId);

    // Reset voting allocation to 0
    await updateBoardSettings(boardId, { votingAllocation: 0 });

    // Get updated board data
    const updatedBoard = await getBoardWithDetails(boardId);

    // Broadcast changes to all connected clients
    if (updatedBoard) {
      broadcastBoardUpdated(boardId, updatedBoard);

      // Get current scene to determine what voting data to broadcast
      const currentScene = getCurrentScene(updatedBoard.scenes, updatedBoard.currentSceneId);

      // Check capabilities based on scene and board status
      const canShowVotes = getSceneCapability(currentScene, updatedBoard.status, 'show_votes');
      const canAllowVoting = getSceneCapability(currentScene, updatedBoard.status, 'allow_voting');

      // Broadcast vote updates based on scene settings with votes_cleared flag
      await broadcastVoteUpdatesBasedOnScene(boardId, {
        showVotes: canShowVotes || undefined,
        allowVoting: canAllowVoting || undefined
      }, undefined, true);
    }

    return json({
      success: true,
      message: 'All votes cleared and voting allocation reset to 0',
      deletedVotes: clearResult.deletedCount
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    return json(
      { success: false, error: 'Failed to clear votes' },
      { status: 500 }
    );
  }
};
