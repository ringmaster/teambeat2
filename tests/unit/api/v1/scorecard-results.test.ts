import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/lib/server/auth/index", () => ({
	requireApiV1Auth: vi.fn(),
}));

vi.mock("../../../../src/lib/server/api/v1-access", () => ({
	getBoardSeriesForUser: vi.fn(),
}));

vi.mock("../../../../src/lib/server/db/index", () => ({
	db: { select: vi.fn() },
}));

vi.mock("../../../../src/lib/server/db/schema", () => ({
	sceneScorecardResults: {},
	sceneScorecards: {},
	scorecardDatasources: {},
	scorecards: {},
	scenes: {},
}));

import { requireApiV1Auth } from "../../../../src/lib/server/auth/index";
import { getBoardSeriesForUser } from "../../../../src/lib/server/api/v1-access";
import { db } from "../../../../src/lib/server/db/index";
import { GET } from "../../../../src/routes/api/v1/boards/[id]/scorecard-results/+server";
import { createMockRequestEvent } from "../../helpers/mock-request";

const mockUser = { userId: "user-1", email: "test@example.com", expiresAt: 0 };

const mockResults = [
	{
		sceneScorecardId: "ssc-1",
		sceneId: "scene-1",
		sceneTitle: "Sprint Health",
		scorecardName: "Velocity",
		datasourceName: "Jira",
		section: "Performance",
		title: "Story Points",
		primaryValue: "34",
		secondaryValues: JSON.stringify({ planned: 40, completion: 85 }),
		severity: "info",
		seq: 1,
	},
];

function mockDbForResults(rows: typeof mockResults) {
	const orderBy = vi.fn().mockResolvedValue(rows);
	const where = vi.fn().mockReturnValue({ orderBy });
	const innerJoin4 = vi.fn().mockReturnValue({ where });
	const innerJoin3 = vi.fn().mockReturnValue({ innerJoin: innerJoin4 });
	const innerJoin2 = vi.fn().mockReturnValue({ innerJoin: innerJoin3 });
	const innerJoin1 = vi.fn().mockReturnValue({ innerJoin: innerJoin2 });
	const from = vi.fn().mockReturnValue({ innerJoin: innerJoin1 });
	vi.mocked(db.select).mockReturnValue({ from } as any);
}

describe("GET /api/v1/boards/:id/scorecard-results", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns 401 when not authenticated (does not throw)", async () => {
		vi.mocked(requireApiV1Auth).mockRejectedValue(
			new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 }),
		);
		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/boards/board-1/scorecard-results",
			params: { id: "board-1" },
		});
		const response = await GET(event);
		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.success).toBe(false);
	});

	it("returns 404 when board does not exist", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardSeriesForUser).mockResolvedValue("not_found");
		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/boards/bad/scorecard-results",
			params: { id: "bad" },
		});
		const response = await GET(event);
		expect(response.status).toBe(404);
		expect((await response.json()).error).toBe("Board not found");
	});

	it("returns 403 when user is not a series member", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardSeriesForUser).mockResolvedValue("forbidden");
		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/boards/board-1/scorecard-results",
			params: { id: "board-1" },
		});
		const response = await GET(event);
		expect(response.status).toBe(403);
		expect((await response.json()).error).toBe("Access denied");
	});

	it("returns scorecard results with parsed secondaryValues", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardSeriesForUser).mockResolvedValue({ seriesId: "s-1" });
		mockDbForResults(mockResults);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/boards/board-1/scorecard-results",
			params: { id: "board-1" },
		});
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.results).toHaveLength(1);

		const r = data.results[0];
		expect(r.sceneTitle).toBe("Sprint Health");
		expect(r.scorecardName).toBe("Velocity");
		expect(r.title).toBe("Story Points");
		expect(r.primaryValue).toBe("34");
		expect(r.severity).toBe("info");
		// secondaryValues should be parsed from JSON string to object
		expect(r.secondaryValues).toEqual({ planned: 40, completion: 85 });
	});

	it("returns empty results for board with no scorecard data", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardSeriesForUser).mockResolvedValue({ seriesId: "s-1" });
		mockDbForResults([]);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/boards/board-1/scorecard-results",
			params: { id: "board-1" },
		});
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.results).toEqual([]);
	});

	it("handles null secondaryValues gracefully", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardSeriesForUser).mockResolvedValue({ seriesId: "s-1" });
		mockDbForResults([{ ...mockResults[0], secondaryValues: null }]);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/boards/board-1/scorecard-results",
			params: { id: "board-1" },
		});
		const response = await GET(event);
		const data = await response.json();

		expect(data.results[0].secondaryValues).toBeNull();
	});
});
