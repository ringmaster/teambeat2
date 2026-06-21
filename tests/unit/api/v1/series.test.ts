import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/lib/server/auth/index", () => ({
	requireApiV1Auth: vi.fn(),
}));

vi.mock("../../../../src/lib/server/repositories/board-series", () => ({
	findSeriesByUser: vi.fn(),
}));

vi.mock("../../../../src/lib/server/api/v1-access", () => ({
	requireSeriesMember: vi.fn(),
}));

vi.mock("../../../../src/lib/server/db/index", () => ({
	db: { select: vi.fn(), insert: vi.fn() },
}));

vi.mock("../../../../src/lib/server/db/schema", () => ({
	boardSeries: {},
	boards: {},
	columns: {},
	scenes: {},
	sceneFlags: {},
	cards: {},
	agreements: {},
}));

vi.mock("../../../../src/lib/server/db/transaction", () => ({
	withTransaction: vi.fn((fn: any) => fn({ insert: vi.fn().mockResolvedValue(undefined) })),
}));

import { requireApiV1Auth } from "../../../../src/lib/server/auth/index";
import { findSeriesByUser } from "../../../../src/lib/server/repositories/board-series";
import { GET } from "../../../../src/routes/api/v1/series/+server";
import { createMockRequestEvent } from "../../helpers/mock-request";

const mockUser = { userId: "user-1", email: "test@example.com", expiresAt: 0 };

describe("GET /api/v1/series", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns 401 when not authenticated", async () => {
		vi.mocked(requireApiV1Auth).mockRejectedValue(
			new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 }),
		);
		const event = createMockRequestEvent({ url: "http://localhost/api/v1/series" });
		await expect(GET(event)).rejects.toBeInstanceOf(Response);
	});

	it("returns series for authenticated user", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		const mockSeries = [
			{
				id: "series-1",
				name: "Eng Retros",
				slug: "eng-retros",
				description: null,
				role: "admin",
				createdAt: "2026-01-01T00:00:00Z",
			},
		];
		vi.mocked(findSeriesByUser).mockResolvedValue(mockSeries as any);

		const event = createMockRequestEvent({ url: "http://localhost/api/v1/series" });
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.series).toEqual(mockSeries);
		expect(findSeriesByUser).toHaveBeenCalledWith("user-1");
	});

	it("accepts Bearer token in Authorization header", async () => {
		// requireApiV1Auth already handles this; just verify it's called with the event
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(findSeriesByUser).mockResolvedValue([]);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series",
			headers: { Authorization: "Bearer tb_abc123" },
		});

		const response = await GET(event);
		expect(response.status).toBe(200);
		expect(requireApiV1Auth).toHaveBeenCalledWith(event);
	});
});
