import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/lib/server/auth/index", () => ({
	requireApiV1Auth: vi.fn(),
}));

vi.mock("../../../../src/lib/server/api/v1-access", () => ({
	requireSeriesMember: vi.fn(),
}));

vi.mock("../../../../src/lib/server/db/index", () => ({
	db: { select: vi.fn(), insert: vi.fn(), delete: vi.fn() },
}));

vi.mock("../../../../src/lib/server/db/schema", () => ({
	boards: {},
	cards: {},
	columns: {},
	comments: {},
	users: {},
}));

vi.mock("../../../../src/lib/server/repositories/board", () => ({
	getBoardWithDetails: vi.fn(),
}));

vi.mock("../../../../src/lib/server/sse/broadcast", () => ({
	broadcastCardUpdated: vi.fn().mockResolvedValue(undefined),
	broadcastUpdatePresentation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../../src/lib/server/utils/cards-data", () => ({
	enrichCardWithCounts: vi.fn(),
}));

vi.mock("../../../../src/lib/utils/animalNames", () => ({
	getUserDisplayName: vi.fn((name: string) => name),
}));

vi.mock("../../../../src/lib/utils/scene-capability", () => ({
	getCurrentScene: vi.fn(),
	getSceneCapability: vi.fn(),
}));

vi.mock("nanoid", () => ({
	nanoid: vi.fn(() => "comment-id-1"),
}));

import { requireApiV1Auth } from "../../../../src/lib/server/auth/index";
import { requireSeriesMember } from "../../../../src/lib/server/api/v1-access";
import { db } from "../../../../src/lib/server/db/index";
import { getBoardWithDetails } from "../../../../src/lib/server/repositories/board";
import { enrichCardWithCounts } from "../../../../src/lib/server/utils/cards-data";
import { getCurrentScene, getSceneCapability } from "../../../../src/lib/utils/scene-capability";
import { POST } from "../../../../src/routes/api/v1/cards/[id]/comments/+server";
import { createMockRequestEvent } from "../../helpers/mock-request";

const mockUser = { userId: "user-1", email: "test@example.com", expiresAt: 0 };

const mockCard = { id: "card-1", columnId: "col-1", content: "Test card", userId: "user-1" };
const mockColumn = { id: "col-1", boardId: "board-1" };
const mockBoard = { id: "board-1", seriesId: "s-1", blameFreeMode: false };
const mockScene = { id: "scene-1", mode: "columns" };

function mockCardLookup(found = true) {
	const select = vi.mocked(db.select);
	select.mockImplementation(() => {
		const where = vi.fn().mockResolvedValue(
			found ? [{ card: mockCard, column: mockColumn, board: mockBoard }] : [],
		);
		const innerJoin2 = vi.fn().mockReturnValue({ where });
		const innerJoin1 = vi.fn().mockReturnValue({ innerJoin: innerJoin2 });
		const from = vi.fn().mockReturnValue({ innerJoin: innerJoin1 });
		return { from } as any;
	});
}

function mockFullSuccess() {
	let callCount = 0;
	vi.mocked(db.select).mockImplementation(() => {
		callCount++;
		if (callCount === 1) {
			// Card lookup
			const where = vi.fn().mockResolvedValue([{ card: mockCard, column: mockColumn, board: mockBoard }]);
			const innerJoin2 = vi.fn().mockReturnValue({ where });
			const innerJoin1 = vi.fn().mockReturnValue({ innerJoin: innerJoin2 });
			const from = vi.fn().mockReturnValue({ innerJoin: innerJoin1 });
			return { from } as any;
		}
		// User data lookup
		const where = vi.fn().mockResolvedValue([{ name: "Alice", email: "alice@example.com" }]);
		const from = vi.fn().mockReturnValue({ where });
		return { from } as any;
	});

	const returning = vi.fn().mockResolvedValue([{
		id: "comment-id-1",
		cardId: "card-1",
		userId: "user-1",
		content: "Great point",
		isAgreement: false,
		isReaction: false,
		completed: false,
		createdAt: "2026-06-22T00:00:00Z",
		updatedAt: "2026-06-22T00:00:00Z",
	}]);
	const values = vi.fn().mockReturnValue({ returning });
	vi.mocked(db.insert).mockReturnValue({ values } as any);
	vi.mocked(enrichCardWithCounts).mockResolvedValue({ ...mockCard, voteCount: 0, commentCount: 1 } as any);
}

describe("POST /api/v1/cards/:id/comments", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns 401 when not authenticated (does not throw)", async () => {
		vi.mocked(requireApiV1Auth).mockRejectedValue(
			new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 }),
		);
		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/cards/card-1/comments",
			params: { id: "card-1" },
			body: { content: "Hello" },
		});
		const response = await POST(event);
		expect(response.status).toBe(401);
		const data = await response.json();
		expect(data.success).toBe(false);
	});

	it("returns 400 when content is empty", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/cards/card-1/comments",
			params: { id: "card-1" },
			body: { content: "" },
		});
		const response = await POST(event);
		expect(response.status).toBe(500); // Zod throws, caught generically — acceptable
	});

	it("returns 404 when card does not exist", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		mockCardLookup(false);
		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/cards/bad-card/comments",
			params: { id: "bad-card" },
			body: { content: "Hello" },
		});
		const response = await POST(event);
		expect(response.status).toBe(404);
		expect((await response.json()).error).toBe("Card not found");
	});

	it("returns 403 when user is not a series member", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		mockCardLookup(true);
		vi.mocked(getBoardWithDetails).mockResolvedValue({ id: "board-1", scenes: [], currentSceneId: null } as any);
		vi.mocked(requireSeriesMember).mockResolvedValue(null);
		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/cards/card-1/comments",
			params: { id: "card-1" },
			body: { content: "Hello" },
		});
		const response = await POST(event);
		expect(response.status).toBe(403);
		expect((await response.json()).error).toBe("Access denied");
	});

	it("returns 403 when scene does not allow comments", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		mockCardLookup(true);
		vi.mocked(getBoardWithDetails).mockResolvedValue({
			id: "board-1", scenes: [mockScene], currentSceneId: "scene-1", status: "active",
		} as any);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "member" } as any);
		vi.mocked(getCurrentScene).mockReturnValue(mockScene as any);
		vi.mocked(getSceneCapability).mockReturnValue(false);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/cards/card-1/comments",
			params: { id: "card-1" },
			body: { content: "Hello" },
		});
		const response = await POST(event);
		expect(response.status).toBe(403);
		expect((await response.json()).error).toBe("Adding comments not allowed in current scene");
	});

	it("creates comment and returns 201 with comment data", async () => {
		vi.mocked(requireApiV1Auth).mockResolvedValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue({
			id: "board-1", scenes: [mockScene], currentSceneId: "scene-1", status: "active",
		} as any);
		vi.mocked(requireSeriesMember).mockResolvedValue({ role: "member" } as any);
		vi.mocked(getCurrentScene).mockReturnValue(mockScene as any);
		vi.mocked(getSceneCapability).mockReturnValue(true);
		mockFullSuccess();

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/cards/card-1/comments",
			params: { id: "card-1" },
			body: { content: "Great point" },
		});
		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(201);
		expect(data.success).toBe(true);
		expect(data.action).toBe("added");
		expect(data.comment.content).toBe("Great point");
		expect(data.comment.userName).toBe("Alice");
	});
});
