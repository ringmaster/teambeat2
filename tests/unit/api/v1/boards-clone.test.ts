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
	columns: {},
	healthQuestions: {},
	sceneFlags: {},
	sceneScorecards: {},
	scenes: {},
	scenesColumns: {},
}));

vi.mock("../../../../src/lib/server/db/transaction", () => ({
	withTransaction: vi.fn(),
}));

vi.mock("../../../../src/lib/server/repositories/agreement", () => ({
	findIncompleteAgreementsByBoardId: vi.fn().mockResolvedValue([]),
	findIncompleteCommentAgreementsByBoardId: vi.fn().mockResolvedValue([]),
}));

vi.mock("uuid", () => ({ v4: vi.fn(() => "new-uuid") }));

import { requireApiV1Auth } from "../../../../src/lib/server/auth/index";
import { requireSeriesMember } from "../../../../src/lib/server/api/v1-access";
import { db } from "../../../../src/lib/server/db/index";
import { withTransaction } from "../../../../src/lib/server/db/transaction";
import { POST } from "../../../../src/routes/api/v1/series/[id]/boards/clone/+server";
import { createMockRequestEvent } from "../../helpers/mock-request";

const mockUser = { userId: "user-1", email: "test@example.com", expiresAt: 0 };

const SERIES_ID = "series-1";
const SOURCE_BOARD_ID = "550e8400-e29b-41d4-a716-446655440000";

const mockActiveSourceBoard = {
	id: SOURCE_BOARD_ID,
	name: "Sprint 42 Retro",
	seriesId: SERIES_ID,
	status: "active",
	blameFreeMode: false,
	votingAllocation: 3,
	votingEnabled: true,
};

const mockDraftSourceBoard = { ...mockActiveSourceBoard, status: "draft" };
const mockCompletedSourceBoard = { ...mockActiveSourceBoard, status: "completed" };

let txInsertCalls: any[];
let txUpdateCalls: any[];

function mockTxSuccess() {
	txInsertCalls = [];
	txUpdateCalls = [];
	vi.mocked(withTransaction).mockImplementation(async (fn: any) => {
		const tx = {
			insert: vi.fn((table: any) => {
				const chain = { values: vi.fn().mockResolvedValue(undefined) };
				txInsertCalls.push({ table, chain });
				return chain;
			}),
			update: vi.fn((table: any) => {
				const chain = {
					set: vi.fn().mockReturnValue({
						where: vi.fn().mockResolvedValue(undefined),
					}),
				};
				txUpdateCalls.push({ table, chain });
				return chain;
			}),
			select: vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([]),
					innerJoin: vi.fn().mockReturnValue({
						where: vi.fn().mockResolvedValue([]),
					}),
				}),
			}),
		};
		return fn(tx);
	});
}

function mockDbForClone(sourceBoard: typeof mockActiveSourceBoard | null, seriesExists = true) {
	let call = 0;
	vi.mocked(db.select).mockImplementation(() => {
		call++;
		if (call === 1) {
			// Series lookup
			const limit = vi.fn().mockResolvedValue(seriesExists ? [{ id: SERIES_ID }] : []);
			const where = vi.fn().mockReturnValue({ limit });
			const from = vi.fn().mockReturnValue({ where });
			return { from } as any;
		}
		// Source board lookup
		const limit = vi.fn().mockResolvedValue(sourceBoard ? [sourceBoard] : []);
		const where = vi.fn().mockReturnValue({ limit });
		const from = vi.fn().mockReturnValue({ where });
		return { from } as any;
	});
}

function makeEvent(body: object) {
	return createMockRequestEvent({
		method: "POST",
		url: `http://localhost/api/v1/series/${SERIES_ID}/boards/clone`,
		params: { id: SERIES_ID },
		body,
	});
}

describe("POST /api/v1/series/:id/boards/clone", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns 401 when not authenticated (does not throw)", async () => {
		vi.mocked(requireApiV1Auth).mockRejectedValue(
			new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 }),
		);
		const response = await POST(makeEvent({ sourceId: SOURCE_BOARD_ID }));
		expect(response.status).toBe(401);
		expect((await response.json()).success).toBe(false);
	});

	it("returns 404 when series does not exist", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		mockDbForClone(null, false);
		const response = await POST(makeEvent({ sourceId: SOURCE_BOARD_ID }));
		expect(response.status).toBe(404);
		expect((await response.json()).error).toBe("Series not found");
	});

	it("returns 403 for member role (facilitator required)", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "member" } as any);
		mockDbForClone(mockActiveSourceBoard);
		const response = await POST(makeEvent({ sourceId: SOURCE_BOARD_ID }));
		expect(response.status).toBe(403);
		expect((await response.json()).error).toBe("Facilitator or admin required");
	});

	it("returns 404 when source board does not exist", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		mockDbForClone(null);
		const response = await POST(makeEvent({ sourceId: SOURCE_BOARD_ID }));
		expect(response.status).toBe(404);
		expect((await response.json()).error).toBe("Source board not found");
	});

	it("returns 400 when source board belongs to a different series", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		mockDbForClone({ ...mockActiveSourceBoard, seriesId: "other-series" });
		const response = await POST(makeEvent({ sourceId: SOURCE_BOARD_ID }));
		expect(response.status).toBe(400);
		expect((await response.json()).error).toMatch(/does not belong to this series/);
	});

	it("returns 400 for invalid sourceId (not a UUID)", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		mockDbForClone(mockActiveSourceBoard);
		const response = await POST(makeEvent({ sourceId: "not-a-uuid" }));
		expect(response.status).toBe(400);
	});

	it("clones active board, marks source as completed, returns 201", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		mockDbForClone(mockActiveSourceBoard);
		mockTxSuccess();

		const response = await POST(makeEvent({ sourceId: SOURCE_BOARD_ID, name: "Sprint 43 Retro" }));
		const data = await response.json();

		expect(response.status).toBe(201);
		expect(data.success).toBe(true);
		expect(data.board.name).toBe("Sprint 43 Retro");
		expect(data.board.cloneOf).toBe(SOURCE_BOARD_ID);
		expect(data.board.status).toBe("draft");
		expect(data.sourceBoardCompleted).toBe(true);
	});

	it("clones draft board, marks source as completed", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		mockDbForClone(mockDraftSourceBoard);
		mockTxSuccess();

		const response = await POST(makeEvent({ sourceId: SOURCE_BOARD_ID }));
		const data = await response.json();

		expect(response.status).toBe(201);
		expect(data.sourceBoardCompleted).toBe(true);
	});

	it("does NOT mark completed source as completed again", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		mockDbForClone(mockCompletedSourceBoard);
		mockTxSuccess();

		const response = await POST(makeEvent({ sourceId: SOURCE_BOARD_ID }));
		const data = await response.json();

		expect(response.status).toBe(201);
		expect(data.sourceBoardCompleted).toBe(false);
	});

	it("defaults board name to source board name when name is omitted", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		mockDbForClone(mockActiveSourceBoard);
		mockTxSuccess();

		const response = await POST(makeEvent({ sourceId: SOURCE_BOARD_ID }));
		const data = await response.json();

		expect(data.board.name).toBe("Sprint 42 Retro");
	});

	it("includes meetingDate in response when provided", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		mockDbForClone(mockActiveSourceBoard);
		mockTxSuccess();

		const response = await POST(makeEvent({
			sourceId: SOURCE_BOARD_ID,
			meetingDate: "2026-07-15",
		}));
		const data = await response.json();

		expect(data.board.meetingDate).toBe("2026-07-15");
	});

	it("returns 500 on DB error (does not throw)", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "admin" } as any);
		vi.mocked(db.select).mockImplementation(() => { throw new Error("db gone"); });

		const response = await POST(makeEvent({ sourceId: SOURCE_BOARD_ID }));
		expect(response.status).toBe(500);
		expect((await response.json()).success).toBe(false);
	});
});
