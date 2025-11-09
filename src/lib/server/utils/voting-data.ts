// Types for voting data structures

export interface VotingAllocation {
	currentVotes: number;
	maxVotes: number;
	remainingVotes: number;
	canVote: boolean;
}

export interface VotingStats {
	totalUsers: number;
	activeUsers: number;
	usersWhoVoted: number;
	usersWhoHaventVoted: number;
	totalVotesCast: number;
	maxPossibleVotes: number;
	remainingVotes: number;
	maxVotesPerUser: number;
}

export interface UserVotingData {
	votes_by_card: Record<string, number>;
}

export interface ComprehensiveVotingData {
	user_voting_data?: UserVotingData;
	voting_stats: VotingStats;
}

export interface VoteChangedMessageData extends ComprehensiveVotingData {
	type: "vote_changed";
	board_id: string;
	card_id: string;
	vote_count: number;
	timestamp: number;
}

export interface VotingStatsUpdatedMessageData {
	type: "voting_stats_updated";
	board_id: string;
	voting_stats: VotingStats;
	timestamp: number;
}

/**
 * Constructs user voting data from raw votes
 */
export function buildUserVotingData(
	userVotes: Array<{ cardId: string }>,
): UserVotingData {
	// Process user votes into votes by card map
	const votesByCard: Record<string, number> = {};
	userVotes.forEach((vote) => {
		votesByCard[vote.cardId] = (votesByCard[vote.cardId] || 0) + 1;
	});

	return {
		votes_by_card: votesByCard,
	};
}

/**
 * Constructs comprehensive voting data for a board and optional user
 */
export async function buildComprehensiveVotingData(
	boardId: string,
	userId?: string,
	seriesId?: string,
	votingAllocation?: number,
): Promise<ComprehensiveVotingData> {
	try {
		const { getUserVotesForBoard } = await import("../repositories/vote.js");

		// If seriesId and votingAllocation not provided, fetch board details
		let actualSeriesId = seriesId;
		let actualVotingAllocation = votingAllocation;

		if (!actualSeriesId || !actualVotingAllocation) {
			const { getBoardWithDetails } = await import("../repositories/board.js");
			const board = await getBoardWithDetails(boardId);
			if (!board) {
				throw new Error(`Board not found: ${boardId}`);
			}
			actualSeriesId = board.seriesId;
			actualVotingAllocation = board.votingAllocation;
		}

		const votingStats = await buildVotingStats(
			boardId,
			actualSeriesId,
			actualVotingAllocation,
		);

		let userVotingData: UserVotingData | undefined;

		if (userId) {
			const userVotes = await getUserVotesForBoard(userId, boardId);
			userVotingData = buildUserVotingData(userVotes);
		}

		return {
			user_voting_data: userVotingData,
			voting_stats: votingStats,
		};
	} catch (error) {
		console.error("Failed to build comprehensive voting data:", error);
		throw error;
	}
}

/**
 * Constructs comprehensive voting statistics including presence data
 */
export async function buildVotingStats(
	boardId: string,
	seriesId?: string,
	votingAllocation?: number,
): Promise<any> {
	try {
		const { getBoardPresence } = await import("../repositories/presence.js");
		const { calculateAggregateVotingStats } = await import(
			"../repositories/vote.js"
		);

		// If seriesId and votingAllocation not provided, fetch board details
		let actualSeriesId = seriesId;
		let actualVotingAllocation = votingAllocation;

		if (!actualSeriesId || !actualVotingAllocation) {
			const { getBoardWithDetails } = await import("../repositories/board.js");
			const board = await getBoardWithDetails(boardId);
			if (!board) {
				throw new Error(`Board not found: ${boardId}`);
			}
			actualSeriesId = board.seriesId;
			actualVotingAllocation = board.votingAllocation;
		}

		const presenceData = await getBoardPresence(boardId);

		const activeUserIds = new Set(presenceData.map((p) => p.userId));

		// Pass activeUserIds to avoid duplicate presence queries
		const comprehensiveStats = await calculateAggregateVotingStats(
			boardId,
			actualSeriesId,
			actualVotingAllocation,
			activeUserIds,
		);

		return comprehensiveStats;
	} catch (error) {
		console.error("Failed to build comprehensive voting stats:", error);
		throw error;
	}
}

/**
 * Constructs a vote_changed SSE message
 */
export async function buildVoteChangedMessage(
	boardId: string,
	cardId: string,
	voteCount: number,
	userId?: string,
): Promise<VoteChangedMessageData> {
	const comprehensiveData = await buildComprehensiveVotingData(boardId, userId);

	return {
		type: "vote_changed",
		board_id: boardId,
		card_id: cardId,
		vote_count: voteCount,
		timestamp: Date.now(),
		...comprehensiveData,
	};
}

/**
 * Constructs a voting_stats_updated SSE message
 */
export async function buildVotingStatsUpdatedMessage(
	boardId: string,
	votingStats?: VotingStats,
): Promise<VotingStatsUpdatedMessageData> {
	// If voting stats not provided, build comprehensive stats
	let stats = votingStats;

	if (!stats) {
		const comprehensiveData = await buildComprehensiveVotingData(boardId);
		stats = comprehensiveData.voting_stats;
	}

	return {
		type: "voting_stats_updated",
		board_id: boardId,
		voting_stats: stats,
		timestamp: Date.now(),
	};
}

/**
 * Constructs API response data in same format as SSE messages
 */
export async function buildUserVotingApiResponse(
	boardId: string,
	userId: string,
): Promise<{
	success: boolean;
	user_voting_data?: UserVotingData;
	voting_stats: VotingStats;
}> {
	const comprehensiveData = await buildComprehensiveVotingData(boardId, userId);

	return {
		success: true,
		user_voting_data: comprehensiveData.user_voting_data,
		voting_stats: comprehensiveData.voting_stats,
	};
}

/**
 * Builds complete voting response including all users' votes when appropriate
 * Used by both SSR and API endpoints to ensure consistent data structure
 */
export async function buildCompleteVotingResponse(
	boardId: string,
	userId: string,
	includeAllVotes: boolean,
): Promise<{
	success: boolean;
	user_voting_data?: UserVotingData;
	voting_stats: VotingStats;
	all_votes_by_card?: Record<string, number>;
}> {
	const baseResponse = await buildUserVotingApiResponse(boardId, userId);

	// If votes should be visible to all, add all users' vote counts by card
	if (includeAllVotes) {
		const { getAllUsersVotesForBoard } = await import(
			"../repositories/vote.js"
		);
		const allVotes = await getAllUsersVotesForBoard(boardId);

		// Build vote counts by card (card_id -> total_votes)
		const voteCountsByCard: Record<string, number> = {};
		allVotes.forEach((vote) => {
			voteCountsByCard[vote.cardId] =
				(voteCountsByCard[vote.cardId] || 0) + 1;
		});

		return {
			...baseResponse,
			all_votes_by_card: voteCountsByCard,
		};
	}

	return baseResponse;
}
