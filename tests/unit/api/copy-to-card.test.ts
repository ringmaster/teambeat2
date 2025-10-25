import { beforeEach, describe, expect, it, vi } from "vitest";
import { SCENE_FLAGS } from "../../../src/lib/scene-flags";
import { POST as AgreementsCopyToCard } from "../../../src/routes/api/agreements/[id]/copy-to-card/+server";
import { POST as CommentsCopyToCard } from "../../../src/routes/api/comments/[id]/copy-to-card/+server";
import { POST as HealthQuestionsCopyToCard } from "../../../src/routes/api/health-questions/[questionId]/copy-to-card/+server";
import { createMockRequestEvent } from "../helpers/mock-request";

// Mock the auth module
vi.mock("../../../src/lib/server/auth/index", () => ({
	requireUserForApi: vi.fn(),
}));

// Mock repositories
vi.mock("../../../src/lib/server/repositories/agreement", () => ({
	findAgreementById: vi.fn(),
}));

vi.mock("../../../src/lib/server/repositories/comment", () => ({
	findCommentById: vi.fn(),
}));

vi.mock("../../../src/lib/server/repositories/card", () => ({
	createCard: vi.fn(),
}));

vi.mock("../../../src/lib/server/repositories/board", () => ({
	getBoardWithDetails: vi.fn(),
}));

vi.mock("../../../src/lib/server/repositories/board-series", () => ({
	getUserRoleInSeries: vi.fn(),
}));

vi.mock("../../../src/lib/server/repositories/scene", () => ({
	getSceneFlags: vi.fn(),
}));

vi.mock("../../../src/lib/server/sse/broadcast", () => ({
	broadcastCardCreated: vi.fn(),
}));

vi.mock("../../../src/lib/server/middleware/presence", () => ({
	refreshPresenceOnBoardAction: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../../src/lib/server/utils/cards-data", () => ({
	enrichCardWithCounts: vi.fn(),
}));

// Mock database
vi.mock("../../../src/lib/server/db/index", () => ({
	db: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					innerJoin: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(() => Promise.resolve([])),
						})),
					})),
					where: vi.fn(() => ({
						limit: vi.fn(() => Promise.resolve([])),
					})),
				})),
				where: vi.fn(() => ({
					limit: vi.fn(() => Promise.resolve([])),
				})),
			})),
		})),
	},
}));

// Import mocked modules
import { requireUserForApi } from "../../../src/lib/server/auth/index";
import { db } from "../../../src/lib/server/db/index";
import { findAgreementById } from "../../../src/lib/server/repositories/agreement";
import { getBoardWithDetails } from "../../../src/lib/server/repositories/board";
import { getUserRoleInSeries } from "../../../src/lib/server/repositories/board-series";
import { createCard } from "../../../src/lib/server/repositories/card";
import { findCommentById } from "../../../src/lib/server/repositories/comment";
import { getSceneFlags } from "../../../src/lib/server/repositories/scene";
import { broadcastCardCreated } from "../../../src/lib/server/sse/broadcast";
import { enrichCardWithCounts } from "../../../src/lib/server/utils/cards-data";

describe("POST /api/agreements/[id]/copy-to-card", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates card when scene allows adding cards", async () => {
		const mockUser = {
			userId: "user-1",
			email: "facilitator@example.com",
			name: "Facilitator",
		};
		const columnId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
		const mockAgreement = {
			id: "agreement-1",
			boardId: "board-1",
			content: "Agreement content",
		};

		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			status: "active",
			currentSceneId: "scene-1",
			scenes: [
				{
					id: "scene-1",
					mode: "agreements",
					flags: [SCENE_FLAGS.ALLOW_ADD_CARDS],
				},
			],
			columns: [{ id: columnId, title: "Column 1" }],
			hiddenColumnsByScene: {},
		};

		const mockCard = {
			id: "card-1",
			columnId,
			userId: "user-1",
			content: "Agreement content",
		};

		const enrichedCard = { ...mockCard, reactionCount: 0, commentCount: 0 };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(findAgreementById).mockResolvedValue(mockAgreement);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("facilitator");
		vi.mocked(createCard).mockResolvedValue(mockCard);
		vi.mocked(enrichCardWithCounts).mockResolvedValue(enrichedCard);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/agreements/agreement-1/copy-to-card",
			params: { id: "agreement-1" },
			body: { column_id: columnId },
		});

		const response = await AgreementsCopyToCard(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.card).toEqual(enrichedCard);
		expect(createCard).toHaveBeenCalled();
		expect(broadcastCardCreated).toHaveBeenCalledWith("board-1", enrichedCard);
	});

	it("returns 403 when scene does not allow adding cards", async () => {
		const mockUser = {
			userId: "user-1",
			email: "facilitator@example.com",
			name: "Facilitator",
		};
		const columnId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
		const mockAgreement = {
			id: "agreement-1",
			boardId: "board-1",
			content: "Agreement content",
		};

		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			status: "active",
			currentSceneId: "scene-1",
			scenes: [
				{
					id: "scene-1",
					mode: "agreements",
					flags: [], // No ALLOW_ADD_CARDS flag
				},
			],
			columns: [{ id: columnId, title: "Column 1" }],
			hiddenColumnsByScene: {},
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(findAgreementById).mockResolvedValue(mockAgreement);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("facilitator");

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/agreements/agreement-1/copy-to-card",
			params: { id: "agreement-1" },
			body: { column_id: columnId },
		});

		const response = await AgreementsCopyToCard(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Adding cards is not allowed for this scene");
		expect(createCard).not.toHaveBeenCalled();
	});

	it("returns 403 when board is completed", async () => {
		const mockUser = {
			userId: "user-1",
			email: "facilitator@example.com",
			name: "Facilitator",
		};
		const mockAgreement = {
			id: "agreement-1",
			boardId: "board-1",
			content: "Agreement content",
		};

		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			status: "completed", // Board is completed
			currentSceneId: "scene-1",
			scenes: [
				{
					id: "scene-1",
					mode: "agreements",
					flags: [SCENE_FLAGS.ALLOW_ADD_CARDS],
				},
			],
			columns: [
				{ id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", title: "Column 1" },
			],
			hiddenColumnsByScene: {},
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(findAgreementById).mockResolvedValue(mockAgreement);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("facilitator");

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/agreements/agreement-1/copy-to-card",
			params: { id: "agreement-1" },
			body: { column_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
		});

		const response = await AgreementsCopyToCard(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Adding cards is not allowed for this scene");
		expect(createCard).not.toHaveBeenCalled();
	});

	it("returns 403 when user is not facilitator or admin", async () => {
		const mockUser = {
			userId: "user-1",
			email: "member@example.com",
			name: "Member",
		};
		const mockAgreement = {
			id: "agreement-1",
			boardId: "board-1",
			content: "Agreement content",
		};

		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			status: "active",
			currentSceneId: "scene-1",
			scenes: [
				{
					id: "scene-1",
					mode: "agreements",
					flags: [SCENE_FLAGS.ALLOW_ADD_CARDS],
				},
			],
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(findAgreementById).mockResolvedValue(mockAgreement);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("member");

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/agreements/agreement-1/copy-to-card",
			params: { id: "agreement-1" },
			body: { column_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
		});

		const response = await AgreementsCopyToCard(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe(
			"Only facilitators and admins can copy agreements to cards",
		);
	});

	it("returns 404 when agreement not found", async () => {
		const mockUser = {
			userId: "user-1",
			email: "facilitator@example.com",
			name: "Facilitator",
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(findAgreementById).mockResolvedValue(null);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/agreements/agreement-1/copy-to-card",
			params: { id: "agreement-1" },
			body: { column_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
		});

		const response = await AgreementsCopyToCard(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Agreement not found");
	});
});

describe("POST /api/comments/[id]/copy-to-card", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates card when scene allows adding cards", async () => {
		const mockUser = {
			userId: "user-1",
			email: "facilitator@example.com",
			name: "Facilitator",
		};
		const columnId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

		const mockCommentData = [
			{
				commentId: "comment-1",
				commentContent: "Comment content",
				cardId: "card-123",
				boardId: "board-1",
				isAgreement: true,
			},
		];

		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			status: "active",
			currentSceneId: "scene-1",
			scenes: [
				{
					id: "scene-1",
					mode: "review",
					flags: [SCENE_FLAGS.ALLOW_ADD_CARDS],
				},
			],
			columns: [{ id: columnId, title: "Column 1" }],
			hiddenColumnsByScene: {},
		};

		const mockCard = {
			id: "card-1",
			columnId,
			userId: "user-1",
			content: "Comment content",
		};

		const enrichedCard = { ...mockCard, reactionCount: 0, commentCount: 0 };

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("facilitator");
		vi.mocked(createCard).mockResolvedValue(mockCard);
		vi.mocked(enrichCardWithCounts).mockResolvedValue(enrichedCard);

		// Mock the database queries for comment data
		const selectMock = vi
			.fn()
			.mockReturnValueOnce({
				// First call for comment data
				from: vi.fn(() => ({
					innerJoin: vi.fn(() => ({
						innerJoin: vi.fn(() => ({
							where: vi.fn(() => ({
								limit: vi.fn(() => Promise.resolve(mockCommentData)),
							})),
						})),
					})),
				})),
			})
			.mockReturnValueOnce({
				// Second call for reactions
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						groupBy: vi.fn(() => Promise.resolve([])),
					})),
				})),
			});

		vi.mocked(db.select).mockImplementation(selectMock);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/comments/comment-1/copy-to-card",
			params: { id: "comment-1" },
			body: { column_id: columnId },
		});

		const response = await CommentsCopyToCard(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.card).toEqual(enrichedCard);
		expect(createCard).toHaveBeenCalled();
	});

	it("returns 403 when scene does not allow adding cards", async () => {
		const mockUser = {
			userId: "user-1",
			email: "facilitator@example.com",
			name: "Facilitator",
		};
		const columnId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

		const mockCommentData = [
			{
				commentId: "comment-1",
				commentContent: "Comment content",
				cardId: "card-123",
				boardId: "board-1",
				isAgreement: true,
			},
		];

		const mockBoard = {
			id: "board-1",
			seriesId: "series-1",
			status: "active",
			currentSceneId: "scene-1",
			scenes: [
				{
					id: "scene-1",
					mode: "review",
					flags: [], // No ALLOW_ADD_CARDS flag
				},
			],
			columns: [{ id: columnId, title: "Column 1" }],
			hiddenColumnsByScene: {},
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getBoardWithDetails).mockResolvedValue(mockBoard);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("facilitator");

		// Mock the database queries for comment data
		const selectMock = vi
			.fn()
			.mockReturnValueOnce({
				// First call for comment data
				from: vi.fn(() => ({
					innerJoin: vi.fn(() => ({
						innerJoin: vi.fn(() => ({
							where: vi.fn(() => ({
								limit: vi.fn(() => Promise.resolve(mockCommentData)),
							})),
						})),
					})),
				})),
			})
			.mockReturnValueOnce({
				// Second call for reactions
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						groupBy: vi.fn(() => Promise.resolve([])),
					})),
				})),
			});

		vi.mocked(db.select).mockImplementation(selectMock);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/comments/comment-1/copy-to-card",
			params: { id: "comment-1" },
			body: { column_id: columnId },
		});

		const response = await CommentsCopyToCard(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Adding cards is not allowed for this scene");
	});
});

describe("POST /api/health-questions/[questionId]/copy-to-card", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates card when scene allows adding cards", async () => {
		const mockUser = {
			userId: "user-1",
			email: "facilitator@example.com",
			name: "Facilitator",
		};

		const mockQuestionData = [
			{
				question: {
					id: "question-1",
					sceneId: "scene-1",
					question: "How is the team doing?",
					description: "Rate team health",
					questionType: "redyellowgreen",
				},
				scene: {
					id: "scene-1",
					boardId: "board-1",
					mode: "survey",
				},
				boardId: "board-1",
				boardStatus: "active",
				seriesId: "series-1",
			},
		];

		const mockColumn = {
			id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
			boardId: "board-1",
			title: "Column 1",
		};

		const mockCard = {
			id: "card-1",
			columnId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
			userId: "user-1",
			content:
				"**How is the team doing?**\n\n_Rate team health_\n\n**Average:** 3.00 (0 responses)\n\n**Distribution:** 🔴 Red: 0 | 🟡 Yellow: 0 | 🟢 Green: 0",
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getSceneFlags).mockResolvedValue([SCENE_FLAGS.ALLOW_ADD_CARDS]);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("facilitator");
		vi.mocked(createCard).mockResolvedValue(mockCard);

		// Mock the database query chain
		const mockDbResponse = mockQuestionData;
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					innerJoin: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(() => Promise.resolve(mockDbResponse)),
						})),
					})),
				})),
			})),
		} as any);

		// Mock column query
		const selectMock = vi
			.fn()
			.mockReturnValueOnce({
				// First call for question data
				from: vi.fn(() => ({
					innerJoin: vi.fn(() => ({
						innerJoin: vi.fn(() => ({
							where: vi.fn(() => ({
								limit: vi.fn(() => Promise.resolve(mockQuestionData)),
							})),
						})),
					})),
				})),
			})
			.mockReturnValueOnce({
				// Second call for column
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() => Promise.resolve([mockColumn])),
					})),
				})),
			})
			.mockReturnValueOnce({
				// Third call for responses
				from: vi.fn(() => ({
					where: vi.fn(() => Promise.resolve([])),
				})),
			});

		vi.mocked(db.select).mockImplementation(selectMock);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/health-questions/question-1/copy-to-card",
			params: { questionId: "question-1" },
			body: { column_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
		});

		const response = await HealthQuestionsCopyToCard(event);
		const data = await response.json();

		expect(data.success).toBe(true);
		expect(data.card).toBeDefined();
		expect(createCard).toHaveBeenCalled();
	});

	it("returns 403 when scene does not allow adding cards", async () => {
		const mockUser = {
			userId: "user-1",
			email: "facilitator@example.com",
			name: "Facilitator",
		};

		const mockQuestionData = [
			{
				question: {
					id: "question-1",
					sceneId: "scene-1",
					question: "How is the team doing?",
					questionType: "redyellowgreen",
				},
				scene: {
					id: "scene-1",
					boardId: "board-1",
					mode: "survey",
				},
				boardId: "board-1",
				boardStatus: "active",
				seriesId: "series-1",
			},
		];

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getSceneFlags).mockResolvedValue([]); // No ALLOW_ADD_CARDS flag
		vi.mocked(getUserRoleInSeries).mockResolvedValue("facilitator");

		vi.mocked(db.select).mockReturnValue({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					innerJoin: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(() => Promise.resolve(mockQuestionData)),
						})),
					})),
				})),
			})),
		} as any);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/health-questions/question-1/copy-to-card",
			params: { questionId: "question-1" },
			body: { column_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
		});

		const response = await HealthQuestionsCopyToCard(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Adding cards is not allowed for this scene");
		expect(createCard).not.toHaveBeenCalled();
	});

	it("returns 403 when board is archived", async () => {
		const mockUser = {
			userId: "user-1",
			email: "facilitator@example.com",
			name: "Facilitator",
		};

		const mockQuestionData = [
			{
				question: {
					id: "question-1",
					sceneId: "scene-1",
					question: "How is the team doing?",
					questionType: "redyellowgreen",
				},
				scene: {
					id: "scene-1",
					boardId: "board-1",
					mode: "survey",
				},
				boardId: "board-1",
				boardStatus: "archived", // Board is archived
				seriesId: "series-1",
			},
		];

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);
		vi.mocked(getSceneFlags).mockResolvedValue([SCENE_FLAGS.ALLOW_ADD_CARDS]);
		vi.mocked(getUserRoleInSeries).mockResolvedValue("facilitator");

		vi.mocked(db.select).mockReturnValue({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					innerJoin: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(() => Promise.resolve(mockQuestionData)),
						})),
					})),
				})),
			})),
		} as any);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/health-questions/question-1/copy-to-card",
			params: { questionId: "question-1" },
			body: { column_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
		});

		const response = await HealthQuestionsCopyToCard(event);
		const data = await response.json();

		expect(response.status).toBe(403);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Adding cards is not allowed for this scene");
		expect(createCard).not.toHaveBeenCalled();
	});

	it("returns 404 when question not found", async () => {
		const mockUser = {
			userId: "user-1",
			email: "facilitator@example.com",
			name: "Facilitator",
		};

		vi.mocked(requireUserForApi).mockReturnValue(mockUser);

		vi.mocked(db.select).mockReturnValue({
			from: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					innerJoin: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(() => Promise.resolve([])), // No question found
						})),
					})),
				})),
			})),
		} as any);

		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost:5173/api/health-questions/question-1/copy-to-card",
			params: { questionId: "question-1" },
			body: { column_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
		});

		const response = await HealthQuestionsCopyToCard(event);
		const data = await response.json();

		expect(response.status).toBe(404);
		expect(data.success).toBe(false);
		expect(data.error).toBe("Question not found");
	});
});
