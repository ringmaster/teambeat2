import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/lib/server/auth/index", () => ({
	requireApiV1Auth: vi.fn(),
}));

vi.mock("../../../../src/lib/server/api/v1-access", () => ({
	requireSeriesMember: vi.fn(),
}));

vi.mock("../../../../src/lib/server/db/index", () => ({
	db: { select: vi.fn() },
}));

vi.mock("../../../../src/lib/server/db/schema", () => ({
	boardSeries: {},
	boards: {},
	scenes: {},
	cards: {},
	columns: {},
	agreements: {},
}));

vi.mock("../../../../src/lib/server/db/transaction", () => ({
	withTransaction: vi.fn(),
}));

import { requireApiV1Auth } from "../../../../src/lib/server/auth/index";
import { requireSeriesMember } from "../../../../src/lib/server/api/v1-access";
import { db } from "../../../../src/lib/server/db/index";
import { GET } from "../../../../src/routes/api/v1/series/[id]/boards/+server";
import { createMockRequestEvent } from "../../helpers/mock-request";

const mockUser = { userId: "user-1", email: "test@example.com", expiresAt: 0 };

// Three mocked board rows with all fields the endpoint selects
const mockBoardRows = [
	{
		id: "board-1",
		name: "Q2 Retrospective",
		status: "completed",
		meetingDate: "2026-06-01",
		createdAt: "2026-05-28T09:00:00Z",
		sceneCount: 4,
		cardCount: 22,
		agreementCount: 3,
	},
	{
		id: "board-2",
		name: "Sprint 41 Review",
		status: "completed",
		meetingDate: "2026-05-15",
		createdAt: "2026-05-12T09:00:00Z",
		sceneCount: 3,
		cardCount: 14,
		agreementCount: 1,
	},
	{
		id: "board-3",
		name: "Sprint 42 Planning",
		status: "active",
		meetingDate: null,
		createdAt: "2026-06-20T09:00:00Z",
		sceneCount: 2,
		cardCount: 0,
		agreementCount: 0,
	},
];

/**
 * Build a mock db.select chain that supports:
 *   db.select(...).from(...).where(...).orderBy(...).limit(...).offset(...)  → boardRows
 *   db.select(...).from(...).where(...)                                      → [{ total }]
 *   db.select(...).from(...).where(...).limit(1)                             → [{ id }] (series lookup)
 *
 * The endpoint makes calls in this order:
 *   1. series lookup  (returns [{ id }] or [])
 *   2. Promise.all([boardRows query, countQuery])
 *
 * We use mockImplementation with a call counter so each select() invocation
 * can return a different shape.
 */
function mockDbForSuccess(
	seriesExists: boolean,
	boardRows: typeof mockBoardRows,
	total: number,
) {
	let call = 0;

	vi.mocked(db.select).mockImplementation((_fields?: any) => {
		call++;

		if (call === 1) {
			// Series existence lookup: .from().where().limit(1)
			const limit = vi.fn().mockResolvedValue(seriesExists ? [{ id: "series-1" }] : []);
			const where = vi.fn().mockReturnValue({ limit });
			const from = vi.fn().mockReturnValue({ where });
			return { from } as any;
		}

		if (call === 2) {
			// Board rows query: .from().where().orderBy().limit().offset()
			const offset = vi.fn().mockResolvedValue(boardRows);
			const limit = vi.fn().mockReturnValue({ offset });
			const orderBy = vi.fn().mockReturnValue({ limit });
			const where = vi.fn().mockReturnValue({ orderBy });
			const from = vi.fn().mockReturnValue({ where });
			return { from } as any;
		}

		// call === 3: count query: .from().where()  → [{ total }]
		const where = vi.fn().mockResolvedValue([{ total }]);
		const from = vi.fn().mockReturnValue({ where });
		return { from } as any;
	});
}

describe("GET /api/v1/series/:id/boards", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	// ── Happy path ──────────────────────────────────────────────────────

	it("returns boards with all expected fields when authenticated", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		mockDbForSuccess(true, mockBoardRows, 3);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/series-1/boards",
			params: { id: "series-1" },
		});

		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.boards).toHaveLength(3);

		const first = data.boards[0];
		expect(first.id).toBe("board-1");
		expect(first.name).toBe("Q2 Retrospective");
		expect(first.status).toBe("completed");
		expect(first.meetingDate).toBe("2026-06-01");
		expect(first.createdAt).toBe("2026-05-28T09:00:00Z");
		expect(first.sceneCount).toBe(4);
		expect(first.cardCount).toBe(22);
		expect(first.agreementCount).toBe(3);
	});

	it("includes meta with total, limit, and offset", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "member" } as any);
		mockDbForSuccess(true, mockBoardRows, 17);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/series-1/boards",
			params: { id: "series-1" },
		});

		const response = await GET(event);
		const data = await response.json();

		expect(data.meta.total).toBe(17);
		expect(data.meta.limit).toBe(20); // default
		expect(data.meta.offset).toBe(0); // default
	});

	it("respects ?limit and ?offset query params", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		mockDbForSuccess(true, [mockBoardRows[0]], 10);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/series-1/boards?limit=1&offset=5",
			params: { id: "series-1" },
		});

		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.meta.limit).toBe(1);
		expect(data.meta.offset).toBe(5);
		expect(data.meta.total).toBe(10);
		expect(data.boards).toHaveLength(1);
	});

	it("returns empty boards array when series has no boards", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		mockDbForSuccess(true, [], 0);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/series-1/boards",
			params: { id: "series-1" },
		});

		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.boards).toEqual([]);
		expect(data.meta.total).toBe(0);
	});

	it("returns boards with null meetingDate when not set", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		mockDbForSuccess(true, [mockBoardRows[2]], 1); // board-3 has null meetingDate

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/series-1/boards",
			params: { id: "series-1" },
		});

		const response = await GET(event);
		const data = await response.json();

		expect(data.boards[0].meetingDate).toBeNull();
	});

	it("count fields are numbers not strings", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		mockDbForSuccess(true, [mockBoardRows[0]], 1);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/series-1/boards",
			params: { id: "series-1" },
		});

		const response = await GET(event);
		const data = await response.json();
		const board = data.boards[0];

		expect(typeof board.sceneCount).toBe("number");
		expect(typeof board.cardCount).toBe("number");
		expect(typeof board.agreementCount).toBe("number");
	});

	// ── Auth failures ────────────────────────────────────────────────────

	it("returns 401 response when not authenticated (does not throw)", async () => {
		vi.mocked(requireApiV1Auth).mockRejectedValue(
			new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 }),
		);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/series-1/boards",
			params: { id: "series-1" },
		});

		const response = await GET(event);
		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.success).toBe(false);
		expect(data.error).toBe("Unauthorized");
	});

	// ── Not found / forbidden ────────────────────────────────────────────

	it("returns 404 when series does not exist", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		mockDbForSuccess(false, [], 0); // series lookup returns []

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/nonexistent/boards",
			params: { id: "nonexistent" },
		});

		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Series not found");
	});

	it("returns 403 when user is not a series member", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue(null);
		mockDbForSuccess(true, [], 0);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/series-1/boards",
			params: { id: "series-1" },
		});

		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Access denied");
	});

	// ── Error handling ───────────────────────────────────────────────────

	it("returns 500 on unexpected DB error", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);

		// Make the series lookup throw
		vi.mocked(db.select).mockImplementation(() => {
			throw new Error("connection lost");
		});

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/series-1/boards",
			params: { id: "series-1" },
		});

		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Failed to fetch boards");
	});
});
