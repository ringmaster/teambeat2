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
	agreements: {},
	boardSeries: {},
	boards: {},
	users: {},
}));

import { requireApiV1Auth } from "../../../../src/lib/server/auth/index";
import { requireSeriesMember } from "../../../../src/lib/server/api/v1-access";
import { db } from "../../../../src/lib/server/db/index";
import { GET } from "../../../../src/routes/api/v1/series/[id]/agreements/+server";
import { createMockRequestEvent } from "../../helpers/mock-request";

const mockUser = { userId: "user-1", email: "test@example.com", expiresAt: 0 };

const mockAgreements = [
	{
		id: "ag-1",
		content: "Write more tests",
		completed: false,
		boardId: "board-1",
		boardName: "Sprint 42",
		meetingDate: "2026-06-01",
		createdAt: "2026-06-01T10:00:00Z",
		completedAt: null,
		completedByName: null,
	},
	{
		id: "ag-2",
		content: "Deploy on Fridays only",
		completed: true,
		boardId: "board-2",
		boardName: "Sprint 41",
		meetingDate: "2026-05-15",
		createdAt: "2026-05-15T10:00:00Z",
		completedAt: "2026-05-20T09:00:00Z",
		completedByName: "Alice",
	},
];

let selectCallCount = 0;

function mockDbForSuccess(rows: typeof mockAgreements, total: number, seriesExists = true) {
	selectCallCount = 0;
	vi.mocked(db.select).mockImplementation(() => {
		selectCallCount++;

		if (selectCallCount === 1) {
			// Series lookup
			const limit = vi.fn().mockResolvedValue(seriesExists ? [{ id: "s-1" }] : []);
			const where = vi.fn().mockReturnValue({ limit });
			const from = vi.fn().mockReturnValue({ where });
			return { from } as any;
		}

		if (selectCallCount === 2) {
			// Agreement rows query
			const offset = vi.fn().mockResolvedValue(rows);
			const limit = vi.fn().mockReturnValue({ offset });
			const orderBy = vi.fn().mockReturnValue({ limit });
			const where = vi.fn().mockReturnValue({ orderBy });
			const leftJoin = vi.fn().mockReturnValue({ where });
			const innerJoin = vi.fn().mockReturnValue({ leftJoin });
			const from = vi.fn().mockReturnValue({ innerJoin });
			return { from } as any;
		}

		// Count query
		const where = vi.fn().mockResolvedValue([{ total }]);
		const innerJoin = vi.fn().mockReturnValue({ where });
		const from = vi.fn().mockReturnValue({ innerJoin });
		return { from } as any;
	});
}

describe("GET /api/v1/series/:id/agreements", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	it("returns 401 when not authenticated (does not throw)", async () => {
		vi.mocked(requireApiV1Auth).mockRejectedValue(
			new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 }),
		);
		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/s-1/agreements",
			params: { id: "s-1" },
		});
		const response = await GET(event);
		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.success).toBe(false);
	});

	it("returns 404 when series does not exist", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		mockDbForSuccess([], 0, false);
		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/bad/agreements",
			params: { id: "bad" },
		});
		const response = await GET(event);
		expect(response.status).toBe(404);
		const data = await response.json();
		expect(data.error).toBe("Series not found");
	});

	it("returns 403 when user is not a series member", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue(null);
		mockDbForSuccess([], 0);
		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/s-1/agreements",
			params: { id: "s-1" },
		});
		const response = await GET(event);
		expect(response.status).toBe(403);
		expect((await response.json()).error).toBe("Access denied");
	});

	it("returns agreements with all fields", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "member" } as any);
		mockDbForSuccess(mockAgreements, 2);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/s-1/agreements",
			params: { id: "s-1" },
		});
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.agreements).toHaveLength(2);

		const first = data.agreements[0];
		expect(first.id).toBe("ag-1");
		expect(first.content).toBe("Write more tests");
		expect(first.completed).toBe(false);
		expect(first.boardName).toBe("Sprint 42");
		expect(first.meetingDate).toBe("2026-06-01");
		expect(first.completedByName).toBeNull();

		const second = data.agreements[1];
		expect(second.completed).toBe(true);
		expect(second.completedByName).toBe("Alice");
	});

	it("returns meta with total, limit, and offset", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "member" } as any);
		mockDbForSuccess(mockAgreements, 42);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/s-1/agreements",
			params: { id: "s-1" },
		});
		const response = await GET(event);
		const data = await response.json();

		expect(data.meta.total).toBe(42);
		expect(data.meta.limit).toBe(50); // default
		expect(data.meta.offset).toBe(0); // default
	});

	it("returns empty list when series has no agreements", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "member" } as any);
		mockDbForSuccess([], 0);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/s-1/agreements",
			params: { id: "s-1" },
		});
		const response = await GET(event);
		const data = await response.json();
		expect(response.status).toBe(200);
		expect(data.agreements).toEqual([]);
		expect(data.meta.total).toBe(0);
	});

	it("returns 500 on DB error (does not throw)", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(db.select).mockImplementation(() => { throw new Error("db gone"); });

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/s-1/agreements",
			params: { id: "s-1" },
		});
		const response = await GET(event);
		expect(response.status).toBe(500);
		expect((await response.json()).success).toBe(false);
	});
});
