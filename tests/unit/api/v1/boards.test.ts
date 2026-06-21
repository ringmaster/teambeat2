import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/lib/server/auth/index", () => ({
	requireApiV1Auth: vi.fn(),
}));

vi.mock("../../../../src/lib/server/api/v1-access", () => ({
	getBoardSeriesForUser: vi.fn(),
	requireSeriesMember: vi.fn(),
}));

vi.mock("../../../../src/lib/server/db/index", () => ({
	db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../../../src/lib/server/db/schema", () => ({
	boards: {},
	columns: {},
	scenes: {},
	sceneFlags: {},
	cards: {},
	agreements: {},
	users: {},
	scorecardDatasources: {},
	scorecards: {},
	sceneScorecards: {},
	sceneScorecardResults: {},
}));

vi.mock("../../../../src/lib/server/db/transaction", () => ({
	withTransaction: vi.fn((fn: any) => fn({ insert: vi.fn().mockResolvedValue(undefined) })),
}));

vi.mock("uuid", () => ({ v4: vi.fn(() => "mock-uuid") }));

import { requireApiV1Auth } from "../../../../src/lib/server/auth/index";
import { getBoardSeriesForUser } from "../../../../src/lib/server/api/v1-access";
import { db } from "../../../../src/lib/server/db/index";
import { GET as getBoardDetail } from "../../../../src/routes/api/v1/boards/[id]/+server";
import { GET as getBoardCards } from "../../../../src/routes/api/v1/boards/[id]/cards/+server";
import { GET as getBoardAgreements } from "../../../../src/routes/api/v1/boards/[id]/agreements/+server";
import { createMockRequestEvent } from "../../helpers/mock-request";

const mockUser = { userId: "user-1", email: "test@example.com", expiresAt: 0 };

// ─────────────────────────────────────────────────────────────────────
// GET /api/v1/boards/:id
// ─────────────────────────────────────────────────────────────────────

describe("GET /api/v1/boards/:id", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns 401 when not authenticated", async () => {
		vi.mocked(requireApiV1Auth).mockRejectedValue(
			new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 }),
		);
		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/boards/board-1",
			params: { id: "board-1" },
		});
		await expect(getBoardDetail(event)).rejects.toBeInstanceOf(Response);
	});

	it("returns 404 when board does not exist", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardSeriesForUser).mockResolvedValue("not_found");

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/boards/nonexistent",
			params: { id: "nonexistent" },
		});

		const response = await getBoardDetail(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.error).toBe("Board not found");
	});

	it("returns 403 when user is not a series member", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardSeriesForUser).mockResolvedValue("forbidden");

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/boards/board-1",
			params: { id: "board-1" },
		});

		const response = await getBoardDetail(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.error).toBe("Access denied");
	});

	it("returns board detail when authorized", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardSeriesForUser).mockResolvedValue({ seriesId: "series-1" });

		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			name: "Sprint 42",
			status: "completed",
			meetingDate: "2026-06-01",
			blameFreeMode: false,
			votingAllocation: 3,
			votingEnabled: true,
			currentSceneId: null,
			createdAt: "2026-05-30T10:00:00Z",
		};

		// db.select returns different shapes depending on what's being queried.
		// We mock it to return board, columns, scenes, cards in sequence via Promise.all.
		// The component calls Promise.all([[board], columns, scenes, cards]).
		let callCount = 0;
		vi.mocked(db.select).mockImplementation(() => {
			callCount++;
			const limit1 = vi.fn().mockResolvedValue([mockBoard]);
			const orderBy = vi.fn().mockResolvedValue([]);
			const where = vi.fn().mockReturnValue({ limit: limit1, orderBy });
			const innerJoin = vi.fn().mockReturnValue({ where });
			return { from: vi.fn().mockReturnValue({ where, innerJoin, orderBy }) } as any;
		});

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/boards/board-1",
			params: { id: "board-1" },
		});

		const response = await getBoardDetail(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.board).toBeDefined();
	});
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/v1/boards/:id/cards
// ─────────────────────────────────────────────────────────────────────

describe("GET /api/v1/boards/:id/cards", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns 403 when user is not a member", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardSeriesForUser).mockResolvedValue("forbidden");

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/boards/board-1/cards",
			params: { id: "board-1" },
		});

		const response = await getBoardCards(event);
		expect(response.status).toBe(403);
	});

	it("returns card list when authorized", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardSeriesForUser).mockResolvedValue({ seriesId: "series-1" });

		const mockCards = [
			{ id: "card-1", columnId: "col-1", columnTitle: "Went well", content: "Shipped on time", voteCount: 3, commentCount: 1, groupId: null, isGroupLead: false, seq: 1, createdAt: "2026-06-01T00:00:00Z" },
		];

		const mockOrderBy = vi.fn().mockResolvedValue(mockCards);
		const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
		const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
		const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
		vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/boards/board-1/cards",
			params: { id: "board-1" },
		});

		const response = await getBoardCards(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.cards).toEqual(mockCards);
	});
});

// ─────────────────────────────────────────────────────────────────────
// GET /api/v1/boards/:id/agreements
// ─────────────────────────────────────────────────────────────────────

describe("GET /api/v1/boards/:id/agreements", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns 404 when board not found", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardSeriesForUser).mockResolvedValue("not_found");

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/boards/bad/agreements",
			params: { id: "bad" },
		});

		const response = await getBoardAgreements(event);
		expect(response.status).toBe(404);
	});

	it("returns agreements list when authorized", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardSeriesForUser).mockResolvedValue({ seriesId: "series-1" });

		const mockAgreements = [
			{ id: "ag-1", content: "Write more tests", completed: false, createdAt: "2026-06-01T00:00:00Z", completedAt: null, completedByName: null },
		];

		const mockOrderBy = vi.fn().mockResolvedValue(mockAgreements);
		const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
		const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
		const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });
		vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/boards/board-1/agreements",
			params: { id: "board-1" },
		});

		const response = await getBoardAgreements(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.agreements).toEqual(mockAgreements);
	});

	it("filters by completed=true when query param is set", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardSeriesForUser).mockResolvedValue({ seriesId: "series-1" });

		const mockOrderBy = vi.fn().mockResolvedValue([]);
		const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
		const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
		const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });
		vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/boards/board-1/agreements?completed=true",
			params: { id: "board-1" },
		});

		const response = await getBoardAgreements(event);
		expect(response.status).toBe(200);
		// The where clause should have been called with a completed filter
		expect(mockWhere).toHaveBeenCalled();
	});
});
