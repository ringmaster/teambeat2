import { beforeEach, describe, expect, it, vi } from "vitest";
import { SCENE_FLAGS } from "../../../src/lib/scene-flags";
import { PUT as ChangeScene } from "../../../src/routes/api/boards/[id]/scene/+server";
import { POST as CreateScene } from "../../../src/routes/api/boards/[id]/scenes/+server";
import { createMockRequestEvent } from "../helpers/mock-request";

// Mock auth modules
vi.mock("../../../src/lib/server/auth/index", () => ({
	requireUserForApi: vi.fn(),
}));

// Mock repositories
vi.mock("../../../src/lib/server/repositories/board", () => ({
	getBoardWithDetails: vi.fn(),
	updateBoardScene: vi.fn(),
	findBoardById: vi.fn(),
}));

vi.mock("../../../src/lib/server/repositories/board-series", () => ({
	getUserRoleInSeries: vi.fn(),
}));

vi.mock("../../../src/lib/server/repositories/scene", () => ({
	getSceneFlags: vi.fn(),
	setSceneFlags: vi.fn(),
}));

// Mock presence middleware
vi.mock("../../../src/lib/server/middleware/presence", () => ({
	refreshPresenceOnBoardAction: vi.fn().mockResolvedValue(undefined),
}));

// Mock SSE broadcast
vi.mock("../../../src/lib/server/sse/broadcast", () => ({
	broadcastSceneChanged: vi.fn(),
	broadcastSceneCreated: vi.fn(),
}));

// Mock data builders
vi.mock("../../../src/lib/server/utils/present-mode-data", () => ({
	buildPresentModeData: vi.fn(),
}));

vi.mock("../../../src/lib/server/utils/cards-data", () => ({
	buildAllCardsData: vi.fn(),
}));

// Mock database
vi.mock("../../../src/lib/server/db/index", () => ({
	db: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn(() => ({
						limit: vi.fn(() => Promise.resolve([])),
					})),
					limit: vi.fn(() => Promise.resolve([])),
				})),
			})),
		})),
		insert: vi.fn(() => ({
			values: vi.fn(() => Promise.resolve()),
		})),
		update: vi.fn(() => ({
			set: vi.fn(() => ({
				where: vi.fn(() => Promise.resolve()),
			})),
		})),
	},
}));

// Import mocked modules
import { requireUserForApi } from "../../../src/lib/server/auth/index";
import { db } from "../../../src/lib/server/db/index";
import { refreshPresenceOnBoardAction } from "../../../src/lib/server/middleware/presence";
import {
	findBoardById,
	getBoardWithDetails,
	updateBoardScene,
} from "../../../src/lib/server/repositories/board";
import { getUserRoleInSeries } from "../../../src/lib/server/repositories/board-series";
import {
	getSceneFlags,
	setSceneFlags,
} from "../../../src/lib/server/repositories/scene";
import {
	broadcastSceneChanged,
	broadcastSceneCreated,
} from "../../../src/lib/server/sse/broadcast";
import { buildAllCardsData } from "../../../src/lib/server/utils/cards-data";
import { buildPresentModeData } from "../../../src/lib/server/utils/present-mode-data";

describe("PUT /api/boards/[id]/scene", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should change scene successfully as facilitator", async () => {
		const mockUser = {
			userId: "user-1",
			email: "facilitator@example.com",
			name: "Facilitator",
		};
		const sceneId1 = "00000000-0000-4000-8000-000000000001";
		const sceneId2 = "00000000-0000-4000-8000-000000000002";
		const mockScene = {
			id: sceneId2,
			title: "Voting",
			mode: "columns" as const,
			flags: [SCENE_FLAGS.ALLOW_VOTING],
		};
		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			currentSceneId: sceneId1,
			scenes: [
				{ id: sceneId1, title: "Brainstorm", mode: "columns" as const },
				mockScene,
			],
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("facilitator");
		vi.mocked(buildAllCardsData).mockResolvedValue([]);

		const event = createMockRequestEvent({
			method: "PUT",
			url: "http://localhost:5173/api/boards/board-1/scene",
			params: { id: "board-1" },
			body: { sceneId: sceneId2 },
		});

		const response = await ChangeScene(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.scene.id).toBe(sceneId2);
		expect(updateBoardScene).toHaveBeenCalledWith("board-1", sceneId2);
		expect(broadcastSceneChanged).toHaveBeenCalledWith("board-1", mockScene);
		expect(refreshPresenceOnBoardAction).toHaveBeenCalled();
	});

	it("should include present mode data when switching to present scene", async () => {
		const mockUser = {
			userId: "user-1",
			email: "facilitator@example.com",
			name: "Facilitator",
		};
		const sceneId1 = "00000000-0000-4000-8000-000000000001";
		const sceneId2 = "00000000-0000-4000-8000-000000000002";
		const mockScene = {
			id: sceneId2,
			title: "Present",
			mode: "present" as const,
			flags: [SCENE_FLAGS.SHOW_VOTES],
		};
		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			currentSceneId: sceneId1,
			scenes: [
				{ id: sceneId1, title: "Brainstorm", mode: "columns" as const },
				mockScene,
			],
		};

		const mockPresentData = {
			cards: [{ id: "card-1", content: "Test" }],
			visible_column_ids: ["col-1"],
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("facilitator");
		vi.mocked(buildPresentModeData).mockResolvedValue(mockPresentData);

		const event = createMockRequestEvent({
			method: "PUT",
			url: "http://localhost:5173/api/boards/board-1/scene",
			params: { id: "board-1" },
			body: { sceneId: sceneId2 },
		});

		const response = await ChangeScene(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.present_mode_data).toEqual(mockPresentData);
		expect(buildPresentModeData).toHaveBeenCalledWith("board-1", "user-1");
	});

	it("should fail when user is not facilitator", async () => {
		const mockUser = {
			userId: "user-1",
			email: "member@example.com",
			name: "Member",
		};
		const sceneId1 = "00000000-0000-4000-8000-000000000001";
		const sceneId2 = "00000000-0000-4000-8000-000000000002";
		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			currentSceneId: sceneId1,
			scenes: [
				{ id: sceneId1, title: "Brainstorm", mode: "columns" as const },
				{ id: sceneId2, title: "Voting", mode: "columns" as const },
			],
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");

		const event = createMockRequestEvent({
			method: "PUT",
			url: "http://localhost:5173/api/boards/board-1/scene",
			params: { id: "board-1" },
			body: { sceneId: sceneId2 },
		});

		const response = await ChangeScene(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Access denied");
	});

	it("should fail when scene not found", async () => {
		const mockUser = {
			userId: "user-1",
			email: "facilitator@example.com",
			name: "Facilitator",
		};
		const sceneId1 = "00000000-0000-4000-8000-000000000001";
		const invalidSceneId = "99999999-9999-4999-8999-999999999999";
		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			currentSceneId: sceneId1,
			scenes: [{ id: sceneId1, title: "Brainstorm", mode: "columns" as const }],
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("facilitator");

		const event = createMockRequestEvent({
			method: "PUT",
			url: "http://localhost:5173/api/boards/board-1/scene",
			params: { id: "board-1" },
			body: { sceneId: invalidSceneId },
		});

		const response = await ChangeScene(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Scene not found");
	});

	it("should fail when board not found", async () => {
		const mockUser = {
			userId: "user-1",
			email: "facilitator@example.com",
			name: "Facilitator",
		};
		const validSceneId = "00000000-0000-4000-8000-000000000001";

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: "PUT",
			url: "http://localhost:5173/api/boards/board-1/scene",
			params: { id: "board-1" },
			body: { sceneId: validSceneId },
		});

		const response = await ChangeScene(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Board not found");
	});
});

describe("POST /api/boards/[id]/scenes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should create new scene successfully", async () => {
		const mockUser = {
			userId: "user-1",
			email: "facilitator@example.com",
			name: "Facilitator",
		};
		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			currentSceneId: "scene-1",
		};

		const newSceneData = {
			id: "scene-new",
			boardId: "board-1",
			title: "New Scene",
			description: "A new scene",
			mode: "columns",
			seq: 2,
			createdAt: new Date().toISOString(),
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(findBoardById).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("facilitator");
		vi.mocked(getSceneFlags).mockResolvedValue([SCENE_FLAGS.ALLOW_ADD_CARDS]);

		// Mock select for seq calculation
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn(() => ({
						limit: vi.fn(() => Promise.resolve([{ seq: 1 }])),
					})),
				})),
			})),
		} as any);

		// Mock insert returning the new scene
		const mockSelectAfterInsert = vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(() => Promise.resolve([newSceneData])),
				})),
			})),
		}));

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/boards/board-1/scenes",
			params: { id: "board-1" },
			body: {
				title: "New Scene",
				description: "A new scene",
				mode: "columns",
				flags: [SCENE_FLAGS.ALLOW_ADD_CARDS],
			},
		});

		// Need to mock the second db.select call for fetching the created scene
		let selectCallCount = 0;
		vi.mocked(db.select).mockImplementation(() => {
			selectCallCount++;
			if (selectCallCount === 1) {
				// First call: getting max seq
				return {
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							orderBy: vi.fn(() => ({
								limit: vi.fn(() => Promise.resolve([{ seq: 1 }])),
							})),
						})),
					})),
				} as any;
			} else {
				// Second call: getting created scene
				return {
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(() => Promise.resolve([newSceneData])),
						})),
					})),
				} as any;
			}
		});

		const response = await CreateScene(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.scene.title).toBe("New Scene");
		expect(data.scene.flags).toContain(SCENE_FLAGS.ALLOW_ADD_CARDS);
		expect(setSceneFlags).toHaveBeenCalled();
		expect(broadcastSceneCreated).toHaveBeenCalledWith("board-1", {
			...newSceneData,
			flags: [SCENE_FLAGS.ALLOW_ADD_CARDS],
		});
	});

	it("should fail without valid title", async () => {
		const mockUser = {
			userId: "user-1",
			email: "facilitator@example.com",
			name: "Facilitator",
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/boards/board-1/scenes",
			params: { id: "board-1" },
			body: {
				title: "   ", // Empty after trim
				mode: "columns",
			},
		});

		const response = await CreateScene(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Scene title is required");
	});

	it("should fail with invalid mode", async () => {
		const mockUser = {
			userId: "user-1",
			email: "facilitator@example.com",
			name: "Facilitator",
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/boards/board-1/scenes",
			params: { id: "board-1" },
			body: {
				title: "New Scene",
				mode: "invalid-mode",
			},
		});

		const response = await CreateScene(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toContain("Valid scene mode is required");
	});

	it("should fail when user is not facilitator", async () => {
		const mockUser = {
			userId: "user-1",
			email: "member@example.com",
			name: "Member",
		};
		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(findBoardById).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/boards/board-1/scenes",
			params: { id: "board-1" },
			body: {
				title: "New Scene",
				mode: "columns",
			},
		});

		const response = await CreateScene(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe(
			"Only administrators and facilitators can create scenes",
		);
	});

	it("should set first scene as current if board has no current scene", async () => {
		const mockUser = {
			userId: "user-1",
			email: "facilitator@example.com",
			name: "Facilitator",
		};
		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			currentSceneId: null, // No current scene
		};

		const newSceneData = {
			id: "scene-first",
			boardId: "board-1",
			title: "First Scene",
			mode: "columns",
			seq: 1,
			createdAt: new Date().toISOString(),
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(findBoardById)
			.mockResolvedValueOnce(mockBoard) // First call in permission check
			.mockResolvedValueOnce(mockBoard); // Second call after scene creation
		vi.mocked(getUserRoleInSeries).mockResolvedValue("facilitator");
		vi.mocked(getSceneFlags).mockResolvedValue([]);

		// Mock empty scenes (first scene being created)
		let selectCallCount = 0;
		vi.mocked(db.select).mockImplementation(() => {
			selectCallCount++;
			if (selectCallCount === 1) {
				// First call: getting max seq (no scenes yet)
				return {
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							orderBy: vi.fn(() => ({
								limit: vi.fn(() => Promise.resolve([])),
							})),
						})),
					})),
				} as any;
			} else {
				// Second call: getting created scene
				return {
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(() => Promise.resolve([newSceneData])),
						})),
					})),
				} as any;
			}
		});

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/boards/board-1/scenes",
			params: { id: "board-1" },
			body: {
				title: "First Scene",
				mode: "columns",
			},
		});

		const response = await CreateScene(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(db.update).toHaveBeenCalled();
		expect(broadcastSceneChanged).toHaveBeenCalled();
	});
});
