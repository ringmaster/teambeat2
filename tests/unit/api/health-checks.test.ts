import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as CreateHealthResponse } from "../../../src/routes/api/health-responses/+server";
import { createMockRequestEvent } from "../helpers/mock-request";

// Mock auth modules
vi.mock("../../../src/lib/server/auth/index", () => ({
	requireUserForApi: vi.fn(),
}));

// Mock database
vi.mock("../../../src/lib/server/db/index", () => ({
	db: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() => Promise.resolve([])),
					})),
				})),
			})),
		})),
	},
}));

// Mock repositories
vi.mock("../../../src/lib/server/repositories/scene", () => ({
	findSceneById: vi.fn(),
}));

vi.mock("../../../src/lib/server/repositories/board", () => ({
	getBoardWithDetails: vi.fn(),
}));

vi.mock("../../../src/lib/server/repositories/board-series", () => ({
	getUserRoleInSeries: vi.fn(),
}));

vi.mock("../../../src/lib/server/repositories/health", () => ({
	createOrUpdateHealthResponse: vi.fn(),
}));

// Import mocked modules
import { requireUserForApi } from "../../../src/lib/server/auth/index";
import { db } from "../../../src/lib/server/db/index";
import { getBoardWithDetails } from "../../../src/lib/server/repositories/board";
import { getUserRoleInSeries } from "../../../src/lib/server/repositories/board-series";
import { createOrUpdateHealthResponse } from "../../../src/lib/server/repositories/health";
import { findSceneById } from "../../../src/lib/server/repositories/scene";

describe("POST /api/health-responses", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should create health response successfully", async () => {
		const mockUser = {
			userId: "user-1",
			email: "member@example.com",
			name: "Member",
		};
		const mockQuestion = {
			id: "question-1",
			sceneId: "scene-1",
			questionType: "range1to5",
			text: "How satisfied are you?",
		};
		const mockScene = {
			id: "scene-1",
			boardId: "board-1",
			seriesId: "series-1",
		};
		const mockBoard = {
			id: "board-1",
			status: "active",
		};
		const mockResponse = {
			id: "response-1",
			questionId: "question-1",
			userId: "user-1",
			rating: 4,
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() =>
							Promise.resolve([
								{
									question: mockQuestion,
									sceneDisplayMode: "questions",
								},
							]),
						),
					})),
				})),
			})),
		} as any);
		vi.mocked(findSceneById).mockResolvedValue(mockScene);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(createOrUpdateHealthResponse).mockResolvedValue(mockResponse);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/health-responses",
			body: {
				questionId: "question-1",
				rating: 4,
			},
		});

		const response = await CreateHealthResponse(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.response.rating).toBe(4);
		expect(createOrUpdateHealthResponse).toHaveBeenCalledWith({
			questionId: "question-1",
			userId: "user-1",
			rating: 4,
		});
	});

	it("should fail when scene is in results mode", async () => {
		const mockUser = {
			userId: "user-1",
			email: "member@example.com",
			name: "Member",
		};
		const mockQuestion = {
			id: "question-1",
			sceneId: "scene-1",
			questionType: "range1to5",
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() =>
							Promise.resolve([
								{
									question: mockQuestion,
									sceneDisplayMode: "results",
								},
							]),
						),
					})),
				})),
			})),
		} as any);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/health-responses",
			body: {
				questionId: "question-1",
				rating: 4,
			},
		});

		const response = await CreateHealthResponse(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Survey is in results mode, responses are locked");
	});

	it("should validate boolean question ratings", async () => {
		const mockUser = {
			userId: "user-1",
			email: "member@example.com",
			name: "Member",
		};
		const mockQuestion = {
			id: "question-1",
			sceneId: "scene-1",
			questionType: "boolean",
		};
		const mockScene = {
			id: "scene-1",
			boardId: "board-1",
			seriesId: "series-1",
		};
		const mockBoard = {
			id: "board-1",
			status: "active",
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() =>
							Promise.resolve([
								{
									question: mockQuestion,
									sceneDisplayMode: "questions",
								},
							]),
						),
					})),
				})),
			})),
		} as any);
		vi.mocked(findSceneById).mockResolvedValue(mockScene);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/health-responses",
			body: {
				questionId: "question-1",
				rating: 3, // Invalid for boolean
			},
		});

		const response = await CreateHealthResponse(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Boolean questions require rating of 0 or 1");
	});

	it("should validate range question ratings", async () => {
		const mockUser = {
			userId: "user-1",
			email: "member@example.com",
			name: "Member",
		};
		const mockQuestion = {
			id: "question-1",
			sceneId: "scene-1",
			questionType: "range1to5",
		};
		const mockScene = {
			id: "scene-1",
			boardId: "board-1",
			seriesId: "series-1",
		};
		const mockBoard = {
			id: "board-1",
			status: "active",
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() =>
							Promise.resolve([
								{
									question: mockQuestion,
									sceneDisplayMode: "questions",
								},
							]),
						),
					})),
				})),
			})),
		} as any);
		vi.mocked(findSceneById).mockResolvedValue(mockScene);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/health-responses",
			body: {
				questionId: "question-1",
				rating: 0, // Invalid for range1to5 (requires 1-5)
			},
		});

		const response = await CreateHealthResponse(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Range questions require rating between 1 and 5");
	});

	it("should validate red/yellow/green question ratings", async () => {
		const mockUser = {
			userId: "user-1",
			email: "member@example.com",
			name: "Member",
		};
		const mockQuestion = {
			id: "question-1",
			sceneId: "scene-1",
			questionType: "redyellowgreen",
		};
		const mockScene = {
			id: "scene-1",
			boardId: "board-1",
			seriesId: "series-1",
		};
		const mockBoard = {
			id: "board-1",
			status: "active",
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() =>
							Promise.resolve([
								{
									question: mockQuestion,
									sceneDisplayMode: "questions",
								},
							]),
						),
					})),
				})),
			})),
		} as any);
		vi.mocked(findSceneById).mockResolvedValue(mockScene);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/health-responses",
			body: {
				questionId: "question-1",
				rating: 2, // Invalid for redyellowgreen (requires 1, 3, or 5)
			},
		});

		const response = await CreateHealthResponse(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe(
			"Red/Yellow/Green questions require rating of 1, 3, or 5",
		);
	});

	it("should fail when user has no access to series", async () => {
		const mockUser = {
			userId: "user-1",
			email: "member@example.com",
			name: "Member",
		};
		const mockQuestion = {
			id: "question-1",
			sceneId: "scene-1",
			questionType: "range1to5",
		};
		const mockScene = {
			id: "scene-1",
			boardId: "board-1",
			seriesId: "series-1",
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() =>
							Promise.resolve([
								{
									question: mockQuestion,
									sceneDisplayMode: "questions",
								},
							]),
						),
					})),
				})),
			})),
		} as any);
		vi.mocked(findSceneById).mockResolvedValue(mockScene);
		vi.mocked(getUserRoleInSeries).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/health-responses",
			body: {
				questionId: "question-1",
				rating: 4,
			},
		});

		const response = await CreateHealthResponse(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Access denied");
	});

	it("should fail when board is not in draft or active state", async () => {
		const mockUser = {
			userId: "user-1",
			email: "member@example.com",
			name: "Member",
		};
		const mockQuestion = {
			id: "question-1",
			sceneId: "scene-1",
			questionType: "range1to5",
		};
		const mockScene = {
			id: "scene-1",
			boardId: "board-1",
			seriesId: "series-1",
		};
		const mockBoard = {
			id: "board-1",
			status: "archived",
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() =>
							Promise.resolve([
								{
									question: mockQuestion,
									sceneDisplayMode: "questions",
								},
							]),
						),
					})),
				})),
			})),
		} as any);
		vi.mocked(findSceneById).mockResolvedValue(mockScene);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/health-responses",
			body: {
				questionId: "question-1",
				rating: 4,
			},
		});

		const response = await CreateHealthResponse(event);
		const data = await response.json();

		expect(response.status).toBe(400);
		expect(data.success).toBe(false);
		expect(data.error).toBe(
			"Responses can only be submitted when board is draft or active",
		);
	});
});
