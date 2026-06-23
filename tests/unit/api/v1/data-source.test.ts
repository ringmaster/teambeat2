import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/lib/server/auth/index", () => ({
	requireApiV1Auth: vi.fn(),
}));

vi.mock("../../../../src/lib/server/repositories/board-series", () => ({
	getUserRoleInSeries: vi.fn(),
}));

vi.mock("../../../../src/lib/server/db/index", () => ({
	db: { select: vi.fn() },
}));

vi.mock("../../../../src/lib/server/db/schema", () => ({
	boards: {},
}));

vi.mock("../../../../src/lib/server/repositories/board-dataset", () => ({
	fanOutToSeries: vi.fn(),
	getBoardDataset: vi.fn(),
}));

vi.mock("../../../../src/lib/server/sse/broadcast", () => ({
	broadcastDataSourceUpdated: vi.fn(),
}));

import { requireApiV1Auth } from "../../../../src/lib/server/auth/index";
import { getUserRoleInSeries } from "../../../../src/lib/server/repositories/board-series";
import { fanOutToSeries, getBoardDataset } from "../../../../src/lib/server/repositories/board-dataset";
import { db } from "../../../../src/lib/server/db/index";
import {
	GET,
	PUT,
	PATCH,
	DELETE,
} from "../../../../src/routes/api/v1/series/[id]/data-source/+server";
import { createMockRequestEvent } from "../../helpers/mock-request";

const mockUser = { userId: "user-1", email: "test@example.com", expiresAt: 0 };

const mockDataset = {
	sprint: { name: "Sprint 42", velocity: 34, planned: 40, completion: 85 },
	blockers: [{ title: "Auth service down", owner: "Alice", severity: "high" }],
};

function mockDbSelectBoard(boardId: string | null) {
	const rows = boardId ? [{ id: boardId }] : [];
	const limit = vi.fn().mockResolvedValue(rows);
	const orderBy = vi.fn().mockReturnValue({ limit });
	const where = vi.fn().mockReturnValue({ orderBy });
	const from = vi.fn().mockReturnValue({ where });
	vi.mocked(db.select).mockReturnValue({ from } as any);
}

function mockDbSelectBoards(boards: { id: string; status: string }[]) {
	const where = vi.fn().mockResolvedValue(boards);
	const from = vi.fn().mockReturnValue({ where });
	vi.mocked(db.select).mockReturnValue({ from } as any);
}

describe("GET /api/v1/series/:id/data-source", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns 401 when not authenticated (does not throw)", async () => {
		vi.mocked(requireApiV1Auth).mockRejectedValue(
			new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 }),
		);
		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/s-1/data-source",
			params: { id: "s-1" },
		});
		const response = await GET(event);
		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.success).toBe(false);
	});

	it("returns 403 when user is not a series member", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValue(null);
		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/s-1/data-source",
			params: { id: "s-1" },
		});
		const response = await GET(event);
		expect(response.status).toBe(403);
	});

	it("returns null data when series has no boards", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");
		mockDbSelectBoard(null);
		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/s-1/data-source",
			params: { id: "s-1" },
		});
		const response = await GET(event);
		const data = await response.json();
		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.data).toBeNull();
		expect(data.boardId).toBeNull();
	});

	it("returns parsed dataset from the latest board", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("admin");
		mockDbSelectBoard("board-1");
		vi.mocked(getBoardDataset).mockResolvedValue({
			data: JSON.stringify(mockDataset),
			updatedAt: "2026-06-22T00:00:00Z",
		} as any);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/s-1/data-source",
			params: { id: "s-1" },
		});
		const response = await GET(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.boardId).toBe("board-1");
		expect(data.data.sprint.name).toBe("Sprint 42");
		expect(data.data.blockers).toHaveLength(1);
		expect(data.updatedAt).toBe("2026-06-22T00:00:00Z");
	});

	it("returns null data when board has no dataset yet", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");
		mockDbSelectBoard("board-1");
		vi.mocked(getBoardDataset).mockResolvedValue(null);

		const event = createMockRequestEvent({
			url: "http://localhost/api/v1/series/s-1/data-source",
			params: { id: "s-1" },
		});
		const response = await GET(event);
		const data = await response.json();
		expect(response.status).toBe(200);
		expect(data.data).toBeNull();
	});
});

describe("PUT /api/v1/series/:id/data-source", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns 401 when not authenticated (does not throw)", async () => {
		vi.mocked(requireApiV1Auth).mockRejectedValue(
			new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 }),
		);
		const event = createMockRequestEvent({
			method: "PUT",
			url: "http://localhost/api/v1/series/s-1/data-source",
			params: { id: "s-1" },
			body: mockDataset,
		});
		const response = await PUT(event);
		expect(response.status).toBe(401);
	});

	it("returns 403 for member role (facilitator required)", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");
		const event = createMockRequestEvent({
			method: "PUT",
			url: "http://localhost/api/v1/series/s-1/data-source",
			params: { id: "s-1" },
			body: mockDataset,
		});
		const response = await PUT(event);
		expect(response.status).toBe(403);
		const data = await response.json();
		expect(data.error).toBe("Facilitator or admin required");
	});

	it("replaces dataset and broadcasts to draft/active boards", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("admin");
		vi.mocked(fanOutToSeries).mockResolvedValue(3);
		mockDbSelectBoards([
			{ id: "b-1", status: "active" },
			{ id: "b-2", status: "draft" },
			{ id: "b-3", status: "completed" },
		]);

		const { broadcastDataSourceUpdated } = await import(
			"../../../../src/lib/server/sse/broadcast"
		);

		const event = createMockRequestEvent({
			method: "PUT",
			url: "http://localhost/api/v1/series/s-1/data-source",
			params: { id: "s-1" },
			body: mockDataset,
		});
		const response = await PUT(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.boardsUpdated).toBe(3);
		expect(data.updatedAt).toBeDefined();
		// fanOutToSeries called with replace=true
		expect(fanOutToSeries).toHaveBeenCalledWith("s-1", mockDataset, true, "user-1");
		// Only active and draft boards broadcast
		expect(broadcastDataSourceUpdated).toHaveBeenCalledWith("b-1");
		expect(broadcastDataSourceUpdated).toHaveBeenCalledWith("b-2");
		expect(broadcastDataSourceUpdated).not.toHaveBeenCalledWith("b-3");
	});
});

describe("PATCH /api/v1/series/:id/data-source", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns 403 for member role", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");
		const event = createMockRequestEvent({
			method: "PATCH",
			url: "http://localhost/api/v1/series/s-1/data-source",
			params: { id: "s-1" },
			body: { "$set": { "sprint.velocity": 36 } },
		});
		const response = await PATCH(event);
		expect(response.status).toBe(403);
	});

	it("merges dataset with replace=false", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("facilitator");
		vi.mocked(fanOutToSeries).mockResolvedValue(2);
		mockDbSelectBoards([{ id: "b-1", status: "active" }]);

		const patch = { "$set": { "sprint.velocity": 36 } };
		const event = createMockRequestEvent({
			method: "PATCH",
			url: "http://localhost/api/v1/series/s-1/data-source",
			params: { id: "s-1" },
			body: patch,
		});
		const response = await PATCH(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		// fanOutToSeries called with replace=false for PATCH
		expect(fanOutToSeries).toHaveBeenCalledWith("s-1", patch, false, "user-1");
	});
});

describe("DELETE /api/v1/series/:id/data-source", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns 403 for member role", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");
		const event = createMockRequestEvent({
			method: "DELETE",
			url: "http://localhost/api/v1/series/s-1/data-source",
			params: { id: "s-1" },
		});
		const response = await DELETE(event);
		expect(response.status).toBe(403);
	});

	it("clears dataset and returns boardsUpdated count", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("admin");
		vi.mocked(fanOutToSeries).mockResolvedValue(2);

		const event = createMockRequestEvent({
			method: "DELETE",
			url: "http://localhost/api/v1/series/s-1/data-source",
			params: { id: "s-1" },
		});
		const response = await DELETE(event);
		const data = await response.json();

		expect(response.status).toBe(200);
		expect(data.success).toBe(true);
		expect(data.boardsUpdated).toBe(2);
		// null body + replace=true to clear
		expect(fanOutToSeries).toHaveBeenCalledWith("s-1", null, true, "user-1");
	});
});
