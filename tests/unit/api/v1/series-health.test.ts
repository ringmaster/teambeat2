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
	healthQuestions: {},
	healthResponses: {},
	scenes: {},
}));

import { requireApiV1Auth } from "../../../../src/lib/server/auth/index";
import { requireSeriesMember } from "../../../../src/lib/server/api/v1-access";
import { db } from "../../../../src/lib/server/db/index";
import { GET } from "../../../../src/routes/api/v1/series/[id]/health-summary/+server";
import { createMockRequestEvent } from "../../helpers/mock-request";

const mockUser = { userId: "user-1", email: "test@example.com", expiresAt: 0 };
const mockSeries = { id: "s-1", name: "Data Demo Series" };

let selectCallCount = 0;

function mockDbForSuccess(boards: any[], questionRows: any[], seriesExists = true) {
	selectCallCount = 0;
	vi.mocked(db.select).mockImplementation(() => {
		selectCallCount++;

		if (selectCallCount === 1) {
			// Series lookup
			const limit = vi.fn().mockResolvedValue(seriesExists ? [mockSeries] : []);
			const where = vi.fn().mockReturnValue({ limit });
			const from = vi.fn().mockReturnValue({ where });
			return { from } as any;
		}

		if (selectCallCount === 2) {
			// Recent boards query
			const limit = vi.fn().mockResolvedValue(boards);
			const orderBy = vi.fn().mockReturnValue({ limit });
			const where = vi.fn().mockReturnValue({ orderBy });
			const from = vi.fn().mockReturnValue({ where });
			return { from } as any;
		}

		// Question rows query (complex join)
		const orderBy = vi.fn().mockResolvedValue(questionRows);
		const where = vi.fn().mockReturnValue({ orderBy });
		const leftJoin = vi.fn().mockReturnValue({ where });
		const innerJoin2 = vi.fn().mockReturnValue({ leftJoin });
		const innerJoin1 = vi.fn().mockReturnValue({ innerJoin: innerJoin2 });
		const from = vi.fn().mockReturnValue({ innerJoin: innerJoin1 });
		return { from } as any;
	});
}

describe("GET /api/v1/series/:id/health-summary", () => {
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
			url: "http://localhost/api/v1/series/s-1/health-summary",
			params: { id: "s-1" },
		});
		const response = await GET(event);
		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.success).toBe(false);
	});

	it("returns 404 when series does not exist", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		mockDbForSuccess([], [], false);
		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/bad/health-summary",
			params: { id: "bad" },
		});
		const response = await GET(event);
		expect(response.status).toBe(404);
		expect((await response.json()).error).toBe("Series not found");
	});

	it("returns 403 when user is not a series member", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue(null);
		mockDbForSuccess([], []);
		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/s-1/health-summary",
			params: { id: "s-1" },
		});
		const response = await GET(event);
		expect(response.status).toBe(403);
	});

	it("returns empty questions when series has no boards", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "member" } as any);
		mockDbForSuccess([], []);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/s-1/health-summary",
			params: { id: "s-1" },
		});
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.series).toEqual(mockSeries);
		expect(data.questions).toEqual([]);
	});

	it("aggregates health question history across boards", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "member" } as any);

		const boards = [
			{ id: "board-1", name: "Sprint 41", meetingDate: "2026-05-15" },
			{ id: "board-2", name: "Sprint 42", meetingDate: "2026-06-01" },
		];

		const questionRows = [
			{ threadId: "thread-1", question: "Team health?", questionType: "scale", boardId: "board-1", boardName: "Sprint 41", meetingDate: "2026-05-15", rating: 4 },
			{ threadId: "thread-1", question: "Team health?", questionType: "scale", boardId: "board-1", boardName: "Sprint 41", meetingDate: "2026-05-15", rating: 3 },
			{ threadId: "thread-1", question: "Team health?", questionType: "scale", boardId: "board-2", boardName: "Sprint 42", meetingDate: "2026-06-01", rating: 5 },
		];

		mockDbForSuccess(boards, questionRows);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/s-1/health-summary",
			params: { id: "s-1" },
		});
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.questions).toHaveLength(1);

		const q = data.questions[0];
		expect(q.threadId).toBe("thread-1");
		expect(q.question).toBe("Team health?");
		expect(q.history).toHaveLength(2);

		const sprint41 = q.history.find((h: any) => h.boardId === "board-1");
		expect(sprint41.responseCount).toBe(2);
		expect(sprint41.avgRating).toBe(3.5);

		const sprint42 = q.history.find((h: any) => h.boardId === "board-2");
		expect(sprint42.responseCount).toBe(1);
		expect(sprint42.avgRating).toBe(5);
	});

	it("handles boards with no responses (null ratings)", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "member" } as any);

		const boards = [{ id: "board-1", name: "Sprint 41", meetingDate: "2026-05-15" }];
		const questionRows = [
			{ threadId: "thread-1", question: "Team health?", questionType: "scale", boardId: "board-1", boardName: "Sprint 41", meetingDate: "2026-05-15", rating: null },
		];

		mockDbForSuccess(boards, questionRows);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/s-1/health-summary",
			params: { id: "s-1" },
		});
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		const history = data.questions[0].history[0];
		expect(history.responseCount).toBe(0);
		expect(history.avgRating).toBeNull();
	});
});
