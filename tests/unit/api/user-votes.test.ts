import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../../src/routes/api/boards/[id]/user-votes/+server";
import { createMockRequestEvent } from "../helpers/mock-request";

// Mock auth modules
vi.mock("../../../src/lib/server/auth/index", () => ({
	requireUserForApi: vi.fn(),
}));

// Mock repositories
vi.mock("../../../src/lib/server/repositories/board", () => ({
	getBoardWithDetails: vi.fn(),
}));

vi.mock("../../../src/lib/server/repositories/board-series", () => ({
	getUserRoleInSeries: vi.fn(),
}));

vi.mock("../../../src/lib/server/utils/voting-data", () => ({
	buildCompleteVotingResponse: vi.fn(),
}));

// Import mocked modules
import { requireUserForApi } from "../../../src/lib/server/auth/index";
import { getBoardWithDetails } from "../../../src/lib/server/repositories/board";
import { getUserRoleInSeries } from "../../../src/lib/server/repositories/board-series";
import { buildCompleteVotingResponse } from "../../../src/lib/server/utils/voting-data";

describe("GET /api/boards/[id]/user-votes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return user voting data when user has access and votes are hidden", async () => {
		const mockUser = {
			userId: "user-1",
			email: "user@example.com",
			name: "Test User",
		};
		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			currentSceneId: "scene-1",
			scenes: [{ id: "scene-1", showVotes: false }],
		};
		const mockVotingResponse = {
			success: true,
			user_voting_data: {
				votes_by_card: { "card-1": 1, "card-2": 1 },
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

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard as any);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");
		vi.mocked(buildCompleteVotingResponse).mockResolvedValue(
			mockVotingResponse,
		);

		const event = createMockRequestEvent({ params: { id: "board-1" } });
		const response = await GET(event);
		const data = await response.json();

		expect(requireUserForApi).toHaveBeenCalledWith(event);
		expect(getBoardWithDetails).toHaveBeenCalledWith("board-1");
		expect(getUserRoleInSeries).toHaveBeenCalledWith("user-1", "series-1");
		expect(buildCompleteVotingResponse).toHaveBeenCalledWith(
			"board-1",
			"user-1",
			false, // shouldShowAllVotes = false
		);
		expect(data).toEqual(mockVotingResponse);
		expect(data.all_votes_by_card).toBeUndefined();
	});

	it("should return all votes by card when showVotes is true", async () => {
		const mockUser = {
			userId: "user-1",
			email: "user@example.com",
			name: "Test User",
		};
		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			currentSceneId: "scene-1",
			scenes: [{ id: "scene-1", showVotes: true }],
		};
		const mockVotingResponse = {
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
				"card-1": 2,
				"card-2": 2,
			},
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard as any);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("facilitator");
		vi.mocked(buildCompleteVotingResponse).mockResolvedValue(
			mockVotingResponse,
		);

		const event = createMockRequestEvent({ params: { id: "board-1" } });
		const response = await GET(event);
		const data = await response.json();

		expect(buildCompleteVotingResponse).toHaveBeenCalledWith(
			"board-1",
			"user-1",
			true, // shouldShowAllVotes = true
		);
		expect(data.all_votes_by_card).toEqual({
			"card-1": 2,
			"card-2": 2,
		});
	});

	it("should return 404 when board is not found", async () => {
		const mockUser = {
			userId: "user-1",
			email: "user@example.com",
			name: "Test User",
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(null);

		const event = createMockRequestEvent({ params: { id: "board-1" } });
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data).toEqual({
			success: false,
			error: "Board not found",
		});
		expect(getUserRoleInSeries).not.toHaveBeenCalled();
		expect(buildCompleteVotingResponse).not.toHaveBeenCalled();
	});

	it("should return 403 when user does not have access to series", async () => {
		const mockUser = {
			userId: "user-1",
			email: "user@example.com",
			name: "Test User",
		};
		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			currentSceneId: "scene-1",
			scenes: [],
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard as any);
		vi.mocked(getUserRoleInSeries).mockResolvedValue(null);

		const event = createMockRequestEvent({ params: { id: "board-1" } });
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data).toEqual({
			success: false,
			error: "Access denied",
		});
		expect(buildCompleteVotingResponse).not.toHaveBeenCalled();
	});

	it("should return 500 on general failure", async () => {
		const mockUser = {
			userId: "user-1",
			email: "user@example.com",
			name: "Test User",
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockRejectedValue(
			new Error("Database error"),
		);

		const event = createMockRequestEvent({ params: { id: "board-1" } });
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data).toEqual({
			success: false,
			error: "Failed to fetch user voting data",
		});
	});

	it("should handle authentication errors by rethrowing Response", async () => {
		const authError = new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
		});
		vi.mocked(requireUserForApi).mockImplementation(() => {
			throw authError;
		});

		const event = createMockRequestEvent({ params: { id: "board-1" } });

		await expect(GET(event)).rejects.toThrow(Response);
	});

	it("should handle missing currentSceneId gracefully", async () => {
		const mockUser = {
			userId: "user-1",
			email: "user@example.com",
			name: "Test User",
		};
		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			currentSceneId: null,
			scenes: [{ id: "scene-1", showVotes: true }],
		};
		const mockVotingResponse = {
			success: true,
			user_voting_data: {
				votes_by_card: {},
			},
			voting_stats: {
				totalUsers: 0,
				activeUsers: 0,
				usersWhoVoted: 0,
				usersWhoHaventVoted: 0,
				totalVotesCast: 0,
				maxPossibleVotes: 0,
				remainingVotes: 0,
				maxVotesPerUser: 5,
			},
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard as any);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");
		vi.mocked(buildCompleteVotingResponse).mockResolvedValue(
			mockVotingResponse,
		);

		const event = createMockRequestEvent({ params: { id: "board-1" } });
		const response = await GET(event);
		const data = await response.json();

		expect(buildCompleteVotingResponse).toHaveBeenCalledWith(
			"board-1",
			"user-1",
			false, // shouldShowAllVotes = false (no current scene)
		);
		expect(data.all_votes_by_card).toBeUndefined();
	});
});
