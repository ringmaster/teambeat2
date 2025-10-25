import { json } from "@sveltejs/kit";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { refreshPresenceOnBoardAction } from "$lib/server/middleware/presence.js";
import { getBoardWithDetails } from "$lib/server/repositories/board.js";
import {
	getSeriesMembers,
	getUserRoleInSeries,
} from "$lib/server/repositories/board-series.js";
import { getBoardPresence } from "$lib/server/repositories/presence.js";
import { checkVotingAllocation } from "$lib/server/repositories/vote.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const boardId = event.params.id;

		// Update user presence on this board
		await refreshPresenceOnBoardAction(event);

		const board = await getBoardWithDetails(boardId);
		if (!board) {
			return json(
				{ success: false, error: "Board not found" },
				{ status: 404 },
			);
		}

		// Check if user has access to this board and is admin/facilitator
		const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
		if (!userRole || !["admin", "facilitator"].includes(userRole)) {
			return json(
				{
					success: false,
					error: "Access denied. Admin or facilitator role required.",
				},
				{ status: 403 },
			);
		}

		// Get all series members
		const seriesMembers = await getSeriesMembers(board.seriesId);

		// Get presence data for this board
		const presenceData = await getBoardPresence(boardId);
		const activeUserIds = new Set(presenceData.map((p) => p.userId));

		// Build user status list
		const userStatusList = await Promise.all(
			seriesMembers.map(async (member) => {
				// Get voting allocation for this user
				const votingAllocation = await checkVotingAllocation(
					member.userId,
					boardId,
					board.votingAllocation,
				);

				const isActive = activeUserIds.has(member.userId);
				const presenceInfo = presenceData.find(
					(p) => p.userId === member.userId,
				);

				return {
					userId: member.userId,
					userName: member.userName,
					userRole: member.role,
					isActive,
					lastSeen: presenceInfo?.lastSeen || null,
					currentActivity: presenceInfo?.currentActivity || null,
					votesRemaining: votingAllocation.remainingVotes,
					totalVotes: votingAllocation.maxVotes,
					votesUsed: votingAllocation.currentVotes,
				};
			}),
		);

		// Sort users: active users first (by votes remaining desc), then inactive users (by votes remaining desc)
		const sortedUsers = userStatusList.sort((a, b) => {
			// Active users first
			if (a.isActive && !b.isActive) return -1;
			if (!a.isActive && b.isActive) return 1;

			// Within same activity status, sort by votes remaining (descending)
			return b.votesRemaining - a.votesRemaining;
		});

		return json({
			success: true,
			board: {
				id: board.id,
				name: board.name,
				blameFreeMode: board.blameFreeMode,
				votingAllocation: board.votingAllocation,
			},
			users: sortedUsers,
			summary: {
				totalUsers: seriesMembers.length,
				activeUsers: userStatusList.filter((u) => u.isActive).length,
				totalVotesRemaining: userStatusList
					.filter((u) => u.isActive)
					.reduce((sum, u) => sum + u.votesRemaining, 0),
				totalVotesUsed: userStatusList
					.filter((u) => u.isActive)
					.reduce((sum, u) => sum + u.votesUsed, 0),
			},
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}

		console.error("Failed to get user status:", error);
		return json(
			{
				success: false,
				error: "Failed to get user status",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
};
