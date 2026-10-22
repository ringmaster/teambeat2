import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/lib/server/auth/index", () => ({
	requireApiV1Auth: vi.fn(),
}));

vi.mock("../../../../src/lib/server/api/v1-access", () => ({
	getBoardSeriesForUser: vi.fn(),
}));

// Contract: buildReviewScenesData(boardId, viewMode) resolves to
// [{ id, name, markdown, data }] for the board's review scenes, or null when the board is missing.
vi.mock("../../../../src/lib/server/utils/review-data", () => ({
	buildReviewScenesData: vi.fn(),
}));

vi.mock("../../../../src/lib/server/api/report-error", () => ({
	reportApiError: vi.fn(),
}));

import { requireApiV1Auth } from "../../../../src/lib/server/auth/index";
import { getBoardSeriesForUser } from "../../../../src/lib/server/api/v1-access";
import { reportApiError } from "../../../../src/lib/server/api/report-error";
import { buildReviewScenesData } from "../../../../src/lib/server/utils/review-data";
import { GET } from "../../../../src/routes/api/v1/boards/[id]/review/+server";
import { createMockRequestEvent } from "../../helpers/mock-request";

const mockUser = { userId: "user-1", email: "test@example.com", expiresAt: 0 };

function reviewEvent(query = "") {
	return createMockRequestEvent({
		url: `http://localhost/api/v1/boards/board-1/review${query}`,
		params: { id: "board-1" },
	});
}

describe("GET /api/v1/boards/:id/review", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns 401 response when not authenticated (does not throw)", async () => {
		vi.mocked(requireApiV1Auth).mockRejectedValue(
			new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 }),
		);

		const response = await GET(reviewEvent());

		expect(response.status).toBe(401);
		expect(buildReviewScenesData).not.toHaveBeenCalled();
	});

	it("returns 404 when the board does not exist", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardSeriesForUser).mockResolvedValue("not_found");

		const response = await GET(reviewEvent());

		expect(response.status).toBe(404);
		expect(buildReviewScenesData).not.toHaveBeenCalled();
	});

	it("returns 403 when the user is not a series member", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardSeriesForUser).mockResolvedValue("forbidden");

		const response = await GET(reviewEvent());

		expect(response.status).toBe(403);
		expect(buildReviewScenesData).not.toHaveBeenCalled();
	});

	it("returns 400 for an unknown view", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);

		const response = await GET(reviewEvent("?view=sideways"));
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toBe("view must be one of: by-column, by-votes");
		expect(buildReviewScenesData).not.toHaveBeenCalled();
	});

	it("returns the review scenes, by column by default", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardSeriesForUser).mockResolvedValue({ seriesId: "series-1" });
		const scenes = [
			{ id: "scene-1", name: "Review", markdown: "## Went well\n\n", data: { viewMode: "by-column" } },
		];
		vi.mocked(buildReviewScenesData).mockResolvedValue(scenes as any);

		const response = await GET(reviewEvent());
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual({ success: true, scenes });
		expect(getBoardSeriesForUser).toHaveBeenCalledWith("user-1", "board-1");
		expect(buildReviewScenesData).toHaveBeenCalledWith("board-1", "by-column");
	});

	it("passes view=by-votes to the builder", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardSeriesForUser).mockResolvedValue({ seriesId: "series-1" });
		vi.mocked(buildReviewScenesData).mockResolvedValue([]);

		const response = await GET(reviewEvent("?view=by-votes"));
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data).toEqual({ success: true, scenes: [] });
		expect(buildReviewScenesData).toHaveBeenCalledWith("board-1", "by-votes");
	});

	it("returns 404 when the board disappears before the builder loads it", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardSeriesForUser).mockResolvedValue({ seriesId: "series-1" });
		vi.mocked(buildReviewScenesData).mockResolvedValue(null);

		const response = await GET(reviewEvent());

		expect(response.status).toBe(404);
	});

	it("returns 500 and reports the error when the builder fails", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardSeriesForUser).mockResolvedValue({ seriesId: "series-1" });
		const error = new Error("query failed");
		vi.mocked(buildReviewScenesData).mockRejectedValue(error);

		const response = await GET(reviewEvent());
		const data = await response.json();

		expect(response.status).toBe(500);
		expect(data).toEqual({ success: false, error: "Failed to fetch review scenes" });
		expect(reportApiError).toHaveBeenCalledWith("[v1 GET /boards/:id/review]", error);
	});
});
