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
	cards: {},
	columns: {},
	scenes: {},
	sceneFlags: {},
	scenesColumns: {},
}));

vi.mock("../../../../src/lib/server/db/transaction", () => ({
	withTransaction: vi.fn(),
}));

vi.mock("../../../../src/lib/server/templates", () => ({
	BOARD_TEMPLATES: {
		startstop: { id: "startstop" },
		kafe: { id: "kafe" },
	},
	getTemplate: vi.fn(),
}));

vi.mock("uuid", () => ({ v4: vi.fn(() => "mock-uuid") }));

import { requireApiV1Auth } from "../../../../src/lib/server/auth/index";
import { requireSeriesMember } from "../../../../src/lib/server/api/v1-access";
import { db } from "../../../../src/lib/server/db/index";
import { withTransaction } from "../../../../src/lib/server/db/transaction";
import { getTemplate } from "../../../../src/lib/server/templates";
import { POST } from "../../../../src/routes/api/v1/series/[id]/boards/+server";
import { createMockRequestEvent } from "../../helpers/mock-request";

const mockUser = { userId: "user-1", email: "test@example.com", expiresAt: 0 };

const mockTemplate = {
	id: "startstop",
	name: "Start Stop Continue",
	columns: [
		{ title: "Start", description: "What to start", seq: 1 },
		{ title: "Stop", description: "What to stop", seq: 2 },
		{ title: "Continue", description: "What to continue", seq: 3 },
	],
	scenes: [
		{ title: "Brainstorm", mode: "columns", seq: 1, flags: [], visibleColumns: undefined },
		{ title: "Present", mode: "present", seq: 2, flags: [], visibleColumns: undefined },
	],
};

function mockDbSeriesLookup(exists = true) {
	const limit = vi.fn().mockResolvedValue(exists ? [{ id: "s-1" }] : []);
	const where = vi.fn().mockReturnValue({ limit });
	const from = vi.fn().mockReturnValue({ where });
	vi.mocked(db.select).mockReturnValue({ from } as any);
}

function mockTxSuccess() {
	vi.mocked(withTransaction).mockImplementation(async (fn: any) => {
		const tx = {
			insert: vi.fn().mockReturnValue({
				values: vi.fn().mockResolvedValue(undefined),
			}),
			update: vi.fn().mockReturnValue({
				set: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue(undefined),
				}),
			}),
		};
		return fn(tx);
	});
}

describe("POST /api/v1/series/:id/boards", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns 401 when not authenticated (does not throw)", async () => {
		vi.mocked(requireApiV1Auth).mockRejectedValue(
			new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 }),
		);
		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/series/s-1/boards",
			params: { id: "s-1" },
			body: { name: "My Board", templateId: "startstop" },
		});
		const response = await POST(event);
		expect(response.status).toBe(401);
	});

	it("returns 404 when series does not exist", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		mockDbSeriesLookup(false);
		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/series/bad/boards",
			params: { id: "bad" },
			body: { name: "My Board" },
		});
		const response = await POST(event);
		expect(response.status).toBe(404);
	});

	it("returns 403 when user is not a series member", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue(null);
		mockDbSeriesLookup(true);
		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/series/s-1/boards",
			params: { id: "s-1" },
			body: { name: "My Board" },
		});
		const response = await POST(event);
		expect(response.status).toBe(403);
	});

	it("returns 400 for unknown templateId", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		mockDbSeriesLookup(true);
		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/series/s-1/boards",
			params: { id: "s-1" },
			body: { name: "My Board", templateId: "nonexistent" },
		});
		const response = await POST(event);
		const data = await response.json();
		expect(response.status).toBe(400);
		expect(data.error).toMatch(/Unknown templateId/);
	});

	it("creates board with template columns and scenes", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		vi.mocked(getTemplate).mockReturnValue(mockTemplate as any);
		mockDbSeriesLookup(true);
		mockTxSuccess();

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/series/s-1/boards",
			params: { id: "s-1" },
			body: { name: "Sprint 42 Retro", templateId: "startstop" },
		});
		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(201);
		expect(data.success).toBe(true);
		expect(data.board.name).toBe("Sprint 42 Retro");
		expect(data.board.templateId).toBe("startstop");
		expect(data.board.columns).toHaveLength(3);
		expect(data.board.scenes).toHaveLength(2);
		expect(data.board.columns[0].title).toBe("Start");
		expect(data.board.scenes[0].title).toBe("Brainstorm");
		expect(getTemplate).toHaveBeenCalledWith("startstop");
	});

	it("creates board without template when no templateId given", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		mockDbSeriesLookup(true);
		mockTxSuccess();

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/series/s-1/boards",
			params: { id: "s-1" },
			body: {
				name: "Custom Board",
				columns: [{ title: "Wins" }, { title: "Issues" }],
				scenes: [{ title: "Brainstorm", mode: "columns" }],
			},
		});
		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(201);
		expect(data.board.templateId).toBeNull();
		expect(data.board.columns).toHaveLength(2);
		expect(data.board.columns[0].title).toBe("Wins");
		expect(getTemplate).not.toHaveBeenCalled();
	});

	it("includes meetingDate in response when provided", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		vi.mocked(getTemplate).mockReturnValue(mockTemplate as any);
		mockDbSeriesLookup(true);
		mockTxSuccess();

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/series/s-1/boards",
			params: { id: "s-1" },
			body: { name: "Sprint 42 Retro", templateId: "startstop", meetingDate: "2026-07-01" },
		});
		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(201);
		expect(data.board.meetingDate).toBe("2026-07-01");
	});

	it("returns 400 when card references a column not in the template", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		vi.mocked(getTemplate).mockReturnValue(mockTemplate as any);
		mockDbSeriesLookup(true);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/series/s-1/boards",
			params: { id: "s-1" },
			body: {
				name: "Sprint 42 Retro",
				templateId: "startstop",
				cards: [{ columnTitle: "Nonexistent Column", content: "A card" }],
			},
		});
		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.error).toMatch(/unknown column/i);
	});

	it("returns 400 when name is missing", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		mockDbSeriesLookup(true);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/series/s-1/boards",
			params: { id: "s-1" },
			body: { templateId: "startstop" },
		});
		const response = await POST(event);
		expect(response.status).toBe(400);
	});
});
