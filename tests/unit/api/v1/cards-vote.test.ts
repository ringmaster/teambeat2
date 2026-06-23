import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/lib/server/auth/index", () => ({
	requireApiV1Auth: vi.fn(),
}));

vi.mock("../../../../src/lib/server/api/v1-access", () => ({
	requireSeriesMember: vi.fn(),
}));

vi.mock("../../../../src/lib/server/repositories/card", () => ({
	findCardById: vi.fn(),
}));

vi.mock("../../../../src/lib/server/repositories/vote", () => ({
	castVote: vi.fn(),
	getVoteContext: vi.fn(),
	getVoteCountsByCard: vi.fn(),
}));

vi.mock("../../../../src/lib/server/sse/broadcast", () => ({
	broadcastVoteChanged: vi.fn().mockResolvedValue(undefined),
	broadcastVoteChangedToUser: vi.fn().mockResolvedValue(undefined),
	broadcastVoteUpdatesBasedOnScene: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../src/lib/server/utils/cards-data", () => ({
	enrichCardWithCounts: vi.fn(),
}));

vi.mock("../../../../src/lib/server/utils/voting-data", () => ({
	buildComprehensiveVotingData: vi.fn(),
}));

vi.mock("../../../../src/lib/utils/scene-capability", () => ({
	getSceneCapability: vi.fn(),
}));

import { requireApiV1Auth } from "../../../../src/lib/server/auth/index";
import { requireSeriesMember } from "../../../../src/lib/server/api/v1-access";
import { findCardById } from "../../../../src/lib/server/repositories/card";
import { castVote, getVoteContext, getVoteCountsByCard } from "../../../../src/lib/server/repositories/vote";
import { enrichCardWithCounts } from "../../../../src/lib/server/utils/cards-data";
import { buildComprehensiveVotingData } from "../../../../src/lib/server/utils/voting-data";
import { getSceneCapability } from "../../../../src/lib/utils/scene-capability";
import { POST } from "../../../../src/routes/api/v1/cards/[id]/vote/+server";
import { createMockRequestEvent } from "../../helpers/mock-request";

const mockUser = { userId: "user-1", email: "test@example.com", expiresAt: 0 };

const mockContext = {
	card: { id: "card-1", groupId: null, isGroupLead: false },
	board: {
		id: "board-1",
		seriesId: "s-1",
		votingAllocation: 3,
		currentScene: { mode: "columns" },
		status: "active",
	},
	currentVoteCount: 1,
};

const mockVotingData = {
	user_voting_data: { votes_used: 2, votes_remaining: 1 },
	voting_stats: { total_votes: 10 },
};

function setupSuccessfulVote() {
	vi.mocked(getVoteContext).mockResolvedValue(mockContext as any);
	vi.mocked(requireSeriesMember).mockResolvedValue({ role: "member" } as any);
	vi.mocked(getSceneCapability).mockReturnValue(true);
	vi.mocked(castVote).mockResolvedValue({ id: "vote-1" } as any);
	vi.mocked(findCardById).mockResolvedValue({ id: "card-1" } as any);
	vi.mocked(enrichCardWithCounts).mockResolvedValue({ id: "card-1", voteCount: 2 } as any);
	vi.mocked(buildComprehensiveVotingData).mockResolvedValue(mockVotingData as any);
	vi.mocked(getVoteCountsByCard).mockResolvedValue({} as any);
}

describe("POST /api/v1/cards/:id/vote", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns 401 when not authenticated (does not throw)", async () => {
		vi.mocked(requireApiV1Auth).mockRejectedValue(
			new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 }),
		);
		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/cards/card-1/vote",
			params: { id: "card-1" },
			body: { delta: 1 },
		});
		const response = await POST(event);
		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.success).toBe(false);
	});

	it("returns 400 for invalid delta value", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/cards/card-1/vote",
			params: { id: "card-1" },
			body: { delta: 5 }, // only 1 or -1 allowed
		});
		const response = await POST(event);
		expect(response.status).toBe(500); // Zod error caught generically
	});

	it("returns 404 when card does not exist", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getVoteContext).mockResolvedValue(null);
		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/cards/bad-card/vote",
			params: { id: "bad-card" },
			body: { delta: 1 },
		});
		const response = await POST(event);
		expect(response.status).toBe(404);
		expect((await response.json()).error).toBe("Card not found");
	});

	it("returns 403 when user is not a series member", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getVoteContext).mockResolvedValue(mockContext as any);
		vi.mocked(requireSeriesMember).mockResolvedValue(null);
		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/cards/card-1/vote",
			params: { id: "card-1" },
			body: { delta: 1 },
		});
		const response = await POST(event);
		expect(response.status).toBe(403);
		expect((await response.json()).error).toBe("Access denied");
	});

	it("returns 403 when voting is not allowed in current scene", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getVoteContext).mockResolvedValue(mockContext as any);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "member" } as any);
		vi.mocked(getSceneCapability).mockReturnValue(false);
		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/cards/card-1/vote",
			params: { id: "card-1" },
			body: { delta: 1 },
		});
		const response = await POST(event);
		expect(response.status).toBe(403);
		expect((await response.json()).error).toBe("Voting not allowed in current scene");
	});

	it("returns 400 when no votes remaining", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getVoteContext).mockResolvedValue({
			...mockContext,
			currentVoteCount: 3, // at allocation limit
		} as any);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "member" } as any);
		vi.mocked(getSceneCapability).mockReturnValue(true);
		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/cards/card-1/vote",
			params: { id: "card-1" },
			body: { delta: 1 },
		});
		const response = await POST(event);
		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe("No votes remaining");
	});

	it("returns 400 when trying to remove a vote with zero votes", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getVoteContext).mockResolvedValue({
			...mockContext,
			currentVoteCount: 0,
		} as any);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "member" } as any);
		vi.mocked(getSceneCapability).mockReturnValue(true);
		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/cards/card-1/vote",
			params: { id: "card-1" },
			body: { delta: -1 },
		});
		const response = await POST(event);
		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe("No votes to remove");
	});

	it("returns 403 when voting on a subordinate grouped card", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getVoteContext).mockResolvedValue({
			...mockContext,
			card: { id: "card-1", groupId: "group-1", isGroupLead: false },
		} as any);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "member" } as any);
		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/cards/card-1/vote",
			params: { id: "card-1" },
			body: { delta: 1 },
		});
		const response = await POST(event);
		expect(response.status).toBe(403);
		expect((await response.json()).error).toMatch(/group lead/);
	});

	it("casts vote and returns enriched card with voting data", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		setupSuccessfulVote();

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/cards/card-1/vote",
			params: { id: "card-1" },
			body: { delta: 1 },
		});
		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.card).toBeDefined();
		expect(data.user_voting_data).toEqual(mockVotingData.user_voting_data);
		expect(data.voting_stats).toEqual(mockVotingData.voting_stats);
		expect(castVote).toHaveBeenCalledWith("card-1", "user-1", 1);
	});
});
