import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getBoardWithDetails, updateBoardSettings } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { broadcastBoardUpdated, broadcastVoteUpdatesBasedOnScene } from '$lib/server/sse/broadcast.js';
import { getSceneCapability, getCurrentScene } from '$lib/utils/scene-capability.js';

export const POST: RequestHandler = async (event) => {
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

    // Check if user has facilitator access to this board
    const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!userRole || !['admin', 'facilitator'].includes(userRole)) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Increase voting allocation by 1 (with a reasonable maximum)
    const currentAllocation = board.votingAllocation;
    const newAllocation = Math.min(currentAllocation + 1, 50); // Cap at 50 votes

    if (newAllocation === currentAllocation) {
      return json(
        { success: false, error: 'Maximum voting allocation reached' },
        { status: 400 }
      );
    }

    // Update the board's voting allocation
    await updateBoardSettings(boardId, { votingAllocation: newAllocation });

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

      // Broadcast vote updates based on scene settings (no triggering user since this is admin action)
      await broadcastVoteUpdatesBasedOnScene(boardId, {
        showVotes: canShowVotes || undefined,
        allowVoting: canAllowVoting || undefined
      });
    }

    return json({
      success: true,
      message: `Voting allocation increased to ${newAllocation}`,
      newAllocation,
      previousAllocation: currentAllocation
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    return json(
      { success: false, error: 'Failed to increase voting allocation' },
      { status: 500 }
    );
  }
};
