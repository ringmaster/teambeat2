import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getBoardWithDetails, updateBoardSettings } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { clearBoardVotes } from '$lib/server/repositories/vote.js';
import { broadcastBoardUpdated, broadcastVoteChanged, broadcastVotingStatsUpdate } from '$lib/server/sse/broadcast.js';

export const DELETE: RequestHandler = async (event) => {
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

		// Clear all votes on this board
		const clearResult = await clearBoardVotes(boardId);

		// Reset voting allocation to 0
		await updateBoardSettings(boardId, { votingAllocation: 0 });

		// Get updated board data
		const updatedBoard = await getBoardWithDetails(boardId);

		// Broadcast changes to all connected clients
		if (updatedBoard) {
			broadcastBoardUpdated(boardId, updatedBoard);

			// Broadcast aggregate voting statistics update
			// Broadcast updated voting stats to all users
			await broadcastVotingStatsUpdate(boardId);
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
