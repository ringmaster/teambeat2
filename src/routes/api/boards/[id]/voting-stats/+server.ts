import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { getBoardVotingStats } from '$lib/server/repositories/vote.js';

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
		
		// Check if user has facilitator access to this board
		const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
		if (!userRole || !['admin', 'facilitator'].includes(userRole)) {
			return json(
				{ success: false, error: 'Access denied' },
				{ status: 403 }
			);
		}
		
		const votingStats = await getBoardVotingStats(boardId, board.seriesId);
		
		// Calculate summary statistics
		const totalUsers = votingStats.length;
		const usersWhoVoted = votingStats.filter(u => u.hasVoted).length;
		const usersWhoHaventVoted = totalUsers - usersWhoVoted;
		const totalVotesCast = votingStats.reduce((sum, u) => sum + u.voteCount, 0);
		const maxPossibleVotes = totalUsers * (board.votingAllocation || 3);
		const remainingVotes = maxPossibleVotes - totalVotesCast;
		
		return json({
			success: true,
			stats: {
				totalUsers,
				usersWhoVoted,
				usersWhoHaventVoted,
				totalVotesCast,
				maxPossibleVotes,
				remainingVotes,
				votingAllocation: board.votingAllocation || 3
			},
			userStats: votingStats
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}
		
		return json(
			{ success: false, error: 'Failed to fetch voting stats' },
			{ status: 500 }
		);
	}
};