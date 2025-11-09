import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for board page SSR data loading (+page.server.ts)
 *
 * Critical for preventing regressions where data that should be loaded
 * during SSR is instead loaded client-side, causing visible flash/delay
 */

// Mock all dependencies
vi.mock("../../../src/lib/server/auth/index", () => ({
	requireUser: vi.fn(),
}));

vi.mock("../../../src/lib/server/middleware/presence", () => ({
	refreshPresenceOnBoardAction: vi.fn(),
}));

vi.mock("../../../src/lib/server/repositories/agreement", () => ({
	findAgreementsByBoardId: vi.fn(),
}));

vi.mock("../../../src/lib/server/repositories/board", () => ({
	getBoardWithDetails: vi.fn(),
}));

vi.mock("../../../src/lib/server/repositories/card", () => ({
	getCardsForBoard: vi.fn(),
}));

vi.mock("../../../src/lib/server/repositories/board-series", () => ({
	getUserRoleInSeries: vi.fn(),
	addUserToSeries: vi.fn(),
}));

vi.mock("../../../src/lib/server/repositories/health", () => ({
	getLastHealthCheckDate: vi.fn(),
}));

vi.mock("../../../src/lib/server/repositories/scene-scorecard", () => ({
	getScorecardCountsByBoard: vi.fn(),
}));

vi.mock("../../../src/lib/server/templates", () => ({
	getTemplateList: vi.fn(),
}));

vi.mock("../../../src/lib/server/utils/cards-data", () => ({
	enrichCardsWithCounts: vi.fn(),
}));

vi.mock("../../../src/lib/server/utils/voting-data", () => ({
	buildCompleteVotingResponse: vi.fn(),
}));

vi.mock("../../../src/lib/utils/scene-capability", () => ({
	getSceneCapability: vi.fn(),
}));

// Import mocked modules
import { requireUser } from "../../../src/lib/server/auth/index";
import { refreshPresenceOnBoardAction } from "../../../src/lib/server/middleware/presence";
import { findAgreementsByBoardId } from "../../../src/lib/server/repositories/agreement";
import {
	getBoardWithDetails,
} from "../../../src/lib/server/repositories/board";
import { getCardsForBoard } from "../../../src/lib/server/repositories/card";
import {
	addUserToSeries,
	getUserRoleInSeries,
} from "../../../src/lib/server/repositories/board-series";
import { getLastHealthCheckDate } from "../../../src/lib/server/repositories/health";
import { getScorecardCountsByBoard } from "../../../src/lib/server/repositories/scene-scorecard";
import { getTemplateList } from "../../../src/lib/server/templates";
import { enrichCardsWithCounts } from "../../../src/lib/server/utils/cards-data";
import { buildCompleteVotingResponse } from "../../../src/lib/server/utils/voting-data";
import { getSceneCapability } from "../../../src/lib/utils/scene-capability";

// Import the actual load function
import { load } from "../../../src/routes/board/[id]/+page.server";

describe("Board Page SSR (+page.server.ts)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should load enriched cards with voteCount, userName, reactions, and commentCount", async () => {
		const mockUser = { userId: "user-1", email: "test@example.com" };
		const mockBoard = {
			id: "board-1",
			name: "Test Board",
			status: "active",
			seriesId: "series-1",
			currentSceneId: "scene-1",
			scenes: [
				{
					id: "scene-1",
					title: "Scene 1",
					flags: ["allow_add_cards"],
				},
			],
		};
		const mockCards = [
			{
				id: "card-1",
				content: "Test card",
				columnId: "col-1",
				userId: "user-1",
			},
		];
		const mockEnrichedCards = [
			{
				id: "card-1",
				content: "Test card",
				columnId: "col-1",
				userId: "user-1",
				userName: "Test User", // Added by getCardsForBoard
				voteCount: 3, // Added by getCardsForBoard
				reactions: [{ emoji: "👍", count: 2 }], // Added by enrichCardsWithCounts
				commentCount: 5, // Added by enrichCardsWithCounts
			},
		];

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard as any);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");
		vi.mocked(getCardsForBoard).mockResolvedValue(mockCards as any);
		vi.mocked(enrichCardsWithCounts).mockResolvedValue(
			mockEnrichedCards as any,
		);
		vi.mocked(findAgreementsByBoardId).mockResolvedValue([]);
		vi.mocked(getTemplateList).mockReturnValue([]);
		vi.mocked(getLastHealthCheckDate).mockResolvedValue(null);
		vi.mocked(getScorecardCountsByBoard).mockResolvedValue({});
		vi.mocked(getSceneCapability).mockReturnValue(false);

		const mockEvent = {
			params: { id: "board-1" },
			setHeaders: vi.fn(),
		} as any;

		const result = await load(mockEvent);

		// Verify enriched cards are returned (not basic cards from board)
		expect(getCardsForBoard).toHaveBeenCalledWith("board-1");
		expect(enrichCardsWithCounts).toHaveBeenCalledWith(mockCards);
		expect(result.cards).toEqual(mockEnrichedCards);
		expect(result.cards[0]).toHaveProperty("userName");
		expect(result.cards[0]).toHaveProperty("voteCount");
		expect(result.cards[0]).toHaveProperty("reactions");
		expect(result.cards[0]).toHaveProperty("commentCount");
	});

	it("should load voting data during SSR when scene has allow_voting capability", async () => {
		const mockUser = { userId: "user-1", email: "test@example.com" };
		const mockBoard = {
			id: "board-1",
			name: "Test Board",
			status: "active",
			seriesId: "series-1",
			currentSceneId: "scene-1",
			scenes: [
				{
					id: "scene-1",
					title: "Voting Scene",
					flags: ["allow_voting"],
				},
			],
		};
		const mockVotingData = {
			success: true,
			user_voting_data: {
				votes_by_card: { "card-1": 2 },
			},
			voting_stats: {
				totalUsers: 5,
				activeUsers: 3,
				usersWhoVoted: 2,
				usersWhoHaventVoted: 3,
				totalVotesCast: 8,
				maxPossibleVotes: 25,
				remainingVotes: 17,
				maxVotesPerUser: 5,
			},
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard as any);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");
		vi.mocked(getCardsForBoard).mockResolvedValue([]);
		vi.mocked(enrichCardsWithCounts).mockResolvedValue([]);
		vi.mocked(findAgreementsByBoardId).mockResolvedValue([]);
		vi.mocked(getTemplateList).mockReturnValue([]);
		vi.mocked(getLastHealthCheckDate).mockResolvedValue(null);
		vi.mocked(getScorecardCountsByBoard).mockResolvedValue({});
		vi.mocked(getSceneCapability).mockImplementation(
			(scene: any, status: any, capability: string) => {
				if (capability === "allow_voting") return true;
				return false;
			},
		);
		vi.mocked(buildCompleteVotingResponse).mockResolvedValue(
			mockVotingData as any,
		);

		const mockEvent = {
			params: { id: "board-1" },
			setHeaders: vi.fn(),
		} as any;

		const result = await load(mockEvent);

		// Verify voting data is loaded during SSR
		expect(getSceneCapability).toHaveBeenCalledWith(
			mockBoard.scenes[0],
			"active",
			"allow_voting",
		);
		expect(buildCompleteVotingResponse).toHaveBeenCalledWith(
			"board-1",
			"user-1",
			false, // shouldShowAllVotes = false (allow_voting but not show_votes)
		);
		expect(result.votingData).toEqual(mockVotingData);
	});

	it("should load voting data during SSR when scene has show_votes capability", async () => {
		const mockUser = { userId: "user-1", email: "test@example.com" };
		const mockBoard = {
			id: "board-1",
			name: "Test Board",
			status: "active",
			seriesId: "series-1",
			currentSceneId: "scene-1",
			scenes: [
				{
					id: "scene-1",
					title: "Show Votes Scene",
					flags: ["show_votes"],
				},
			],
		};
		const mockVotingData = {
			success: true,
			user_voting_data: {
				votes_by_card: { "card-1": 1 },
			},
			voting_stats: {
				totalUsers: 3,
				activeUsers: 3,
				usersWhoVoted: 3,
				usersWhoHaventVoted: 0,
				totalVotesCast: 10,
				maxPossibleVotes: 15,
				remainingVotes: 5,
				maxVotesPerUser: 5,
			},
			all_votes_by_card: {
				"card-1": 5,
				"card-2": 5,
			},
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard as any);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("facilitator");
		vi.mocked(getCardsForBoard).mockResolvedValue([]);
		vi.mocked(enrichCardsWithCounts).mockResolvedValue([]);
		vi.mocked(findAgreementsByBoardId).mockResolvedValue([]);
		vi.mocked(getTemplateList).mockReturnValue([]);
		vi.mocked(getLastHealthCheckDate).mockResolvedValue(null);
		vi.mocked(getScorecardCountsByBoard).mockResolvedValue({});
		vi.mocked(getSceneCapability).mockImplementation(
			(scene: any, status: any, capability: string) => {
				if (capability === "show_votes") return true;
				return false;
			},
		);
		vi.mocked(buildCompleteVotingResponse).mockResolvedValue(
			mockVotingData as any,
		);

		const mockEvent = {
			params: { id: "board-1" },
			setHeaders: vi.fn(),
		} as any;

		const result = await load(mockEvent);

		// Verify voting data is loaded with all votes visible
		expect(buildCompleteVotingResponse).toHaveBeenCalledWith(
			"board-1",
			"user-1",
			true, // shouldShowAllVotes = true
		);
		expect(result.votingData).toEqual(mockVotingData);
		expect(result.votingData.all_votes_by_card).toBeDefined();
	});

	it("should NOT load voting data when scene has no voting capabilities", async () => {
		const mockUser = { userId: "user-1", email: "test@example.com" };
		const mockBoard = {
			id: "board-1",
			name: "Test Board",
			status: "active",
			seriesId: "series-1",
			currentSceneId: "scene-1",
			scenes: [
				{
					id: "scene-1",
					title: "Regular Scene",
					flags: ["allow_add_cards", "allow_edit_cards"],
				},
			],
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard as any);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");
		vi.mocked(getCardsForBoard).mockResolvedValue([]);
		vi.mocked(enrichCardsWithCounts).mockResolvedValue([]);
		vi.mocked(findAgreementsByBoardId).mockResolvedValue([]);
		vi.mocked(getTemplateList).mockReturnValue([]);
		vi.mocked(getLastHealthCheckDate).mockResolvedValue(null);
		vi.mocked(getScorecardCountsByBoard).mockResolvedValue({});
		vi.mocked(getSceneCapability).mockReturnValue(false);

		const mockEvent = {
			params: { id: "board-1" },
			setHeaders: vi.fn(),
		} as any;

		const result = await load(mockEvent);

		// Verify voting data is NOT loaded when scene doesn't support voting
		expect(buildCompleteVotingResponse).not.toHaveBeenCalled();
		expect(result.votingData).toBeNull();
	});

	it("should handle voting data load errors gracefully without failing page", async () => {
		const mockUser = { userId: "user-1", email: "test@example.com" };
		const mockBoard = {
			id: "board-1",
			name: "Test Board",
			status: "active",
			seriesId: "series-1",
			currentSceneId: "scene-1",
			scenes: [
				{
					id: "scene-1",
					title: "Voting Scene",
					flags: ["allow_voting"],
				},
			],
		};

		vi.mocked(requireUser).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard as any);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");
		vi.mocked(getCardsForBoard).mockResolvedValue([]);
		vi.mocked(enrichCardsWithCounts).mockResolvedValue([]);
		vi.mocked(findAgreementsByBoardId).mockResolvedValue([]);
		vi.mocked(getTemplateList).mockReturnValue([]);
		vi.mocked(getLastHealthCheckDate).mockResolvedValue(null);
		vi.mocked(getScorecardCountsByBoard).mockResolvedValue({});
		vi.mocked(getSceneCapability).mockImplementation(
			(scene: any, status: any, capability: string) => {
				if (capability === "allow_voting") return true;
				return false;
			},
		);
		vi.mocked(buildCompleteVotingResponse).mockRejectedValue(
			new Error("Voting data load failed"),
		);

		const mockEvent = {
			params: { id: "board-1" },
			setHeaders: vi.fn(),
		} as any;

		// Should not throw - page should still load
		const result = await load(mockEvent);

		// Voting data should be null, but page should still load
		expect(result.votingData).toBeNull();
		expect(result.board).toEqual(mockBoard);
		expect(result.cards).toBeDefined();
	});
});
