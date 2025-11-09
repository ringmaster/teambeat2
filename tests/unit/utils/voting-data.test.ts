import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildUserVotingData,
	buildComprehensiveVotingData,
} from "../../../src/lib/server/utils/voting-data";

// Mock the vote repository
vi.mock("../../../src/lib/server/repositories/vote", () => ({
	getUserVotesForBoard: vi.fn(),
	getBoardVotingStats: vi.fn(),
	calculateAggregateVotingStats: vi.fn(),
}));

// Mock the board repository
vi.mock("../../../src/lib/server/repositories/board", () => ({
	getBoardWithDetails: vi.fn(),
}));

// Mock the presence repository
vi.mock("../../../src/lib/server/repositories/presence", () => ({
	getBoardPresence: vi.fn(),
}));

import {
	getUserVotesForBoard,
	calculateAggregateVotingStats,
} from "../../../src/lib/server/repositories/vote";
import { getBoardWithDetails } from "../../../src/lib/server/repositories/board";
import { getBoardPresence } from "../../../src/lib/server/repositories/presence";

describe("buildUserVotingData", () => {
	it("should correctly map user votes to votes_by_card structure", () => {
		const userVotes = [
			{ cardId: "card-1" },
			{ cardId: "card-2" },
			{ cardId: "card-1" }, // User voted twice on card-1
			{ cardId: "card-3" },
		];

		const result = buildUserVotingData(userVotes);

		expect(result).toEqual({
			votes_by_card: {
				"card-1": 2,
				"card-2": 1,
				"card-3": 1,
			},
		});
	});

	it("should return empty votes_by_card when user has no votes", () => {
		const userVotes: Array<{ cardId: string }> = [];

		const result = buildUserVotingData(userVotes);

		expect(result).toEqual({
			votes_by_card: {},
		});
	});

	it("should handle multiple votes on the same card", () => {
		const userVotes = [
			{ cardId: "card-1" },
			{ cardId: "card-1" },
			{ cardId: "card-1" },
		];

		const result = buildUserVotingData(userVotes);

		expect(result).toEqual({
			votes_by_card: {
				"card-1": 3,
			},
		});
	});
});

describe("buildComprehensiveVotingData", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should fetch and include user voting data when userId is provided", async () => {
		const mockUserVotes = [
			{ cardId: "card-1", voteId: "v1", createdAt: new Date() },
			{ cardId: "card-2", voteId: "v2", createdAt: new Date() },
		];

		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			votingAllocation: 5,
		};

		const mockPresence = [{ userId: "user-1", boardId: "board-1" }];

		const mockVotingStats = {
			totalUsers: 1,
			activeUsers: 1,
			usersWhoVoted: 1,
			usersWhoHaventVoted: 0,
			totalVotesCast: 2,
			maxPossibleVotes: 5,
			remainingVotes: 3,
			maxVotesPerUser: 5,
		};

		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard as any);
		vi.mocked(getUserVotesForBoard).mockResolvedValue(mockUserVotes as any);
		vi.mocked(getBoardPresence).mockResolvedValue(mockPresence as any);
		vi.mocked(calculateAggregateVotingStats).mockResolvedValue(
			mockVotingStats as any,
		);

		const result = await buildComprehensiveVotingData("board-1", "user-1");

		// This test demonstrates the expected behavior
		// The function SHOULD fetch user votes and include them in user_voting_data
		expect(getUserVotesForBoard).toHaveBeenCalledWith("user-1", "board-1");
		expect(result.user_voting_data).toBeDefined();
		expect(result.user_voting_data?.votes_by_card).toEqual({
			"card-1": 1,
			"card-2": 1,
		});
	});

	it("should NOT include user voting data when userId is not provided", async () => {
		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			votingAllocation: 5,
		};

		const mockPresence: any[] = [];
		const mockVotingStats = {
			totalUsers: 0,
			activeUsers: 0,
			usersWhoVoted: 0,
			usersWhoHaventVoted: 0,
			totalVotesCast: 0,
			maxPossibleVotes: 0,
			remainingVotes: 0,
			maxVotesPerUser: 5,
		};

		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard as any);
		vi.mocked(getBoardPresence).mockResolvedValue(mockPresence);
		vi.mocked(calculateAggregateVotingStats).mockResolvedValue(
			mockVotingStats as any,
		);

		const result = await buildComprehensiveVotingData("board-1");

		expect(getUserVotesForBoard).not.toHaveBeenCalled();
		expect(result.user_voting_data).toBeUndefined();
	});

	it("FAILING TEST: demonstrates the bug - user votes are not loaded on page reload", async () => {
		// This test simulates what happens when a user reloads a scene with voting enabled
		// Expected behavior: User's votes should be loaded and available
		// Actual behavior: Votes are never fetched because fetchUserVotingData is never called

		const mockUserVotes = [
			{ cardId: "card-1", voteId: "v1", createdAt: new Date() },
			{ cardId: "card-2", voteId: "v2", createdAt: new Date() },
			{ cardId: "card-1", voteId: "v3", createdAt: new Date() }, // 2 votes on card-1
		];

		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			votingAllocation: 5,
			currentSceneId: "scene-1",
			scenes: [
				{
					id: "scene-1",
					allowVoting: true, // Scene allows voting
					showVotes: false,
				},
			],
		};

		const mockPresence = [{ userId: "user-1", boardId: "board-1" }];
		const mockVotingStats = {
			totalUsers: 1,
			activeUsers: 1,
			usersWhoVoted: 1,
			usersWhoHaventVoted: 0,
			totalVotesCast: 3,
			maxPossibleVotes: 5,
			remainingVotes: 2,
			maxVotesPerUser: 5,
		};

		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard as any);
		vi.mocked(getUserVotesForBoard).mockResolvedValue(mockUserVotes as any);
		vi.mocked(getBoardPresence).mockResolvedValue(mockPresence as any);
		vi.mocked(calculateAggregateVotingStats).mockResolvedValue(
			mockVotingStats as any,
		);

		// Simulate the data that SHOULD be available after page load
		const votingData = await buildComprehensiveVotingData("board-1", "user-1");

		// These assertions should pass IF the client code properly fetches voting data
		// Currently they pass here because we're testing the utility function directly
		// But in the actual app, this data is never fetched on initial page load!
		expect(votingData.user_voting_data).toBeDefined();
		expect(votingData.user_voting_data?.votes_by_card).toEqual({
			"card-1": 2,
			"card-2": 1,
		});

		// This is what the client-side code should do but doesn't:
		// 1. Check if current scene allows voting or shows votes
		// 2. If yes, fetch user voting data via /api/boards/[id]/user-votes
		// 3. Process the data with store.processVotingData()

		// The bug: steps 2 and 3 are never executed on initial page load
		// The fetchUserVotingData function exists but is never called
		// The onLoadUserVotingData handler only fires on scene changes, not initial load
	});
});
