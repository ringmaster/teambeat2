import { beforeEach, describe, expect, it, vi } from "vitest";
import { BoardSSEService } from "../../../src/lib/services/board-sse-service";

describe("BoardSSEService - scene_created handler", () => {
	let mockBoardStore: any;
	let sseService: BoardSSEService;
	let mockEventSource: any;

	beforeEach(() => {
		// Create a mock board store
		mockBoardStore = {
			board: {
				id: "board-1",
				scenes: [
					{ id: "scene-1", title: "Existing Scene", mode: "columns" },
				],
			},
			currentScene: null,
			cards: [],
			comments: [],
			agreements: [],
			addScene: vi.fn(),
			setCurrentScene: vi.fn(),
			updateBoard: vi.fn(),
			updateScene: vi.fn(),
			setCards: vi.fn(),
			processVotingData: vi.fn(),
			setConnectedUsers: vi.fn(),
			setAgreements: vi.fn(),
			setPollVotes: vi.fn(),
			setTimerTotalVotes: vi.fn(),
			setNotesLockStatus: vi.fn(),
			setComments: vi.fn(),
			addCard: vi.fn(),
			updateCard: vi.fn(),
			removeCard: vi.fn(),
			clearUserVotes: vi.fn(),
			clearAllVotes: vi.fn(),
		};

		// Mock EventSource
		mockEventSource = {
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			close: vi.fn(),
			readyState: 0,
		};

		global.EventSource = vi.fn(() => mockEventSource) as any;

		// Create SSE service
		sseService = new BoardSSEService({
			boardId: "board-1",
			boardStore: mockBoardStore,
			handlers: {},
		});

		vi.clearAllMocks();
	});

	it("should call addScene when scene_created message is received", () => {
		const newScene = {
			id: "scene-new",
			boardId: "board-1",
			title: "New Scene",
			description: "A newly created scene",
			mode: "quadrant",
			seq: 2,
			flags: ["allow_add_cards"],
			createdAt: new Date().toISOString(),
		};

		const message = {
			type: "scene_created",
			board_id: "board-1",
			scene: newScene,
			timestamp: Date.now(),
		};

		// Simulate receiving the message
		// @ts-ignore - accessing private method for testing
		sseService.handleMessage(message);

		// Verify addScene was called with the scene data
		expect(mockBoardStore.addScene).toHaveBeenCalledWith(newScene);
		expect(mockBoardStore.addScene).toHaveBeenCalledTimes(1);
	});

	it("should not call addScene when scene_created message has no scene data", () => {
		const message = {
			type: "scene_created",
			board_id: "board-1",
			timestamp: Date.now(),
		};

		// Simulate receiving the message
		// @ts-ignore - accessing private method for testing
		sseService.handleMessage(message);

		// Verify addScene was not called
		expect(mockBoardStore.addScene).not.toHaveBeenCalled();
	});

	it("should add scene to scenes array when scene_changed is received for unknown scene", () => {
		const newScene = {
			id: "scene-new",
			boardId: "board-1",
			title: "New Scene",
			description: "A newly created scene",
			mode: "static",
			seq: 2,
			flags: [],
			createdAt: new Date().toISOString(),
			allowVoting: false,
			showVotes: false,
		};

		const message = {
			type: "scene_changed",
			board_id: "board-1",
			scene: newScene,
			timestamp: Date.now(),
		};

		// Simulate receiving the message
		// @ts-ignore - accessing private method for testing
		sseService.handleMessage(message);

		// Verify that since the scene is not in the scenes array, addScene should be called
		expect(mockBoardStore.addScene).toHaveBeenCalledWith(newScene);
		expect(mockBoardStore.setCurrentScene).toHaveBeenCalledWith(newScene);
		expect(mockBoardStore.updateBoard).toHaveBeenCalledWith({
			currentSceneId: "scene-new",
		});
	});

	it("should update existing scene when scene_changed is received for known scene", () => {
		const updatedScene = {
			id: "scene-1",
			boardId: "board-1",
			title: "Updated Scene",
			description: "Updated",
			mode: "columns",
			seq: 1,
			flags: [],
			createdAt: new Date().toISOString(),
			allowVoting: true,
			showVotes: true,
		};

		const message = {
			type: "scene_changed",
			board_id: "board-1",
			scene: updatedScene,
			timestamp: Date.now(),
		};

		// Simulate receiving the message
		// @ts-ignore - accessing private method for testing
		sseService.handleMessage(message);

		// Verify that updateScene was called (not addScene) since scene exists
		expect(mockBoardStore.updateScene).toHaveBeenCalledWith(
			"scene-1",
			updatedScene,
		);
		expect(mockBoardStore.addScene).not.toHaveBeenCalled();
		expect(mockBoardStore.setCurrentScene).toHaveBeenCalledWith(updatedScene);
	});
});
