import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/lib/server/db/index", () => ({
	db: { select: vi.fn() },
}));

vi.mock("../../../src/lib/server/db/schema", () => ({
	cards: {},
	columns: {},
	comments: {},
	healthResponses: {},
	users: {},
}));

// Contract: getBoardWithDetails(boardId) resolves to the board with
// allColumns, scenes (with mode), and hiddenColumnsByScene, or null.
vi.mock("../../../src/lib/server/repositories/board", () => ({
	getBoardWithDetails: vi.fn(),
}));

// Contract: getHealthQuestionsByScene(sceneId) resolves to the scene's questions;
// getHistoricalDataByThreadIds(threadIds, seriesId, sceneId, userId, limit)
// resolves to a Map of threadId -> prior board averages, newest first.
vi.mock("../../../src/lib/server/repositories/health", () => ({
	getHealthQuestionsByScene: vi.fn(),
	getHistoricalDataByThreadIds: vi.fn(),
}));

// Contract: buildEnrichedAgreementsData(boardId, board) resolves to the agreements
// visible in board.currentSceneId.
vi.mock("../../../src/lib/server/utils/agreements-data", () => ({
	buildEnrichedAgreementsData: vi.fn(),
}));

// Contract: buildAllCardsData(boardId) resolves to cards with voteCount and reactions.
vi.mock("../../../src/lib/server/utils/cards-data", () => ({
	buildAllCardsData: vi.fn(),
}));

import { db } from "../../../src/lib/server/db/index";
import { getBoardWithDetails } from "../../../src/lib/server/repositories/board";
import {
	getHealthQuestionsByScene,
	getHistoricalDataByThreadIds,
} from "../../../src/lib/server/repositories/health";
import { buildEnrichedAgreementsData } from "../../../src/lib/server/utils/agreements-data";
import { buildAllCardsData } from "../../../src/lib/server/utils/cards-data";
import { buildReviewScenesData } from "../../../src/lib/server/utils/review-data";
import { getUserDisplayName } from "../../../src/lib/utils/animalNames";

const board = {
	id: "board-1",
	seriesId: "series-1",
	blameFreeMode: false,
	currentSceneId: "scene-cols",
	allColumns: [
		{ id: "col-a", title: "Went well", seq: 1 },
		{ id: "col-b", title: "To improve", seq: 2 },
	],
	scenes: [
		{ id: "scene-cols", title: "Brainstorm", mode: "columns" },
		{ id: "scene-review", title: "Review", mode: "review" },
		{ id: "scene-review-2", title: "Improvements only", mode: "review" },
		{ id: "scene-survey", title: "Team health", mode: "survey" },
	],
	hiddenColumnsByScene: { "scene-review-2": ["col-a"] },
};

const allCards = [
	{ id: "c1", columnId: "col-a", content: "Fast deploys", notes: null, groupId: null, isGroupLead: false, voteCount: 2, reactions: { "👍": 1 }, userName: "Ann", userId: "u-ann" },
	{ id: "c2", columnId: "col-b", content: "Flaky tests", notes: "CI", groupId: null, isGroupLead: false, voteCount: 1, reactions: {}, userName: "Bo", userId: "u-bo" },
];

const commentRows = [
	{ id: "m1", cardId: "c1", userName: "Ann", content: "Nice", isReaction: false, isAgreement: false },
	{ id: "m2", cardId: "c2", userName: "Bo", content: "Ugh", isReaction: false, isAgreement: false },
	{ id: "m3", cardId: "c2", userName: "Bo", content: "👎", isReaction: true, isAgreement: false },
];

const responseRows = [
	{ questionId: "q1", rating: 3 },
	{ questionId: "q1", rating: 5 },
];

// db.select is used for the board comments query (selects userName) and the survey responses query.
// Every chained call returns the same object, which resolves to the rows for that query.
function mockDbSelect() {
	vi.mocked(db.select).mockImplementation((fields: any) => {
		const rows = "userName" in fields ? commentRows : responseRows;
		const chain: any = {
			then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject),
		};
		for (const method of ["from", "innerJoin", "leftJoin", "where", "orderBy"]) {
			chain[method] = vi.fn(() => chain);
		}
		return chain;
	});
}

function mockSources(boardOverrides: Record<string, unknown> = {}) {
	vi.mocked(getBoardWithDetails).mockResolvedValue({ ...board, ...boardOverrides } as any);
	vi.mocked(buildAllCardsData).mockResolvedValue(allCards as any);
	vi.mocked(buildEnrichedAgreementsData).mockImplementation(async (_boardId, b: any) => [
		{
			id: `agr-${b.currentSceneId}`,
			source: "agreement",
			content: "Ship weekly",
			completed: false,
			completedAt: null,
			userName: "Ann",
			displayName: "Ann",
		} as any,
	]);
	vi.mocked(getHealthQuestionsByScene).mockResolvedValue([
		{ id: "q1", question: "Morale", seq: 1, threadId: "t1", description: null, questionType: "rating" } as any,
	]);
	vi.mocked(getHistoricalDataByThreadIds).mockResolvedValue(
		new Map([["t1", [{ boardId: "prior", boardName: "Sprint 41", average: 2, questionId: "old", boardCreatedAt: "", meetingDate: null, totalResponses: 2, userRating: null }]]]),
	);
	mockDbSelect();
}

describe("buildReviewScenesData", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns null when the board does not exist", async () => {
		vi.mocked(getBoardWithDetails).mockResolvedValue(null);

		expect(await buildReviewScenesData("missing", "by-column")).toBeNull();
	});

	it("returns an empty array when the board has no review scenes", async () => {
		vi.mocked(getBoardWithDetails).mockResolvedValue({ ...board, scenes: [board.scenes[0]] } as any);

		expect(await buildReviewScenesData("board-1", "by-column")).toEqual([]);
		expect(buildAllCardsData).not.toHaveBeenCalled();
	});

	it("returns each review scene in order with its markdown and source data", async () => {
		mockSources();

		const scenes = await buildReviewScenesData("board-1", "by-column");

		expect(scenes?.map((s) => [s.id, s.name])).toEqual([
			["scene-review", "Review"],
			["scene-review-2", "Improvements only"],
		]);

		const [review] = scenes!;
		expect(review.markdown).toBe(
			"## Went well\n\n" +
				"### Fast deploys (2 votes)\n\n(1×👍)\n\n**Comments:**\n\n- Ann: Nice\n\n" +
				"## To improve\n\n" +
				"### Flaky tests (1 vote)\n\nCI\n\n**Comments:**\n\n- Bo: Ugh\n\n" +
				"## Survey: Team health\n\n- **Morale**: 4.00 (↑100%)\n\n" +
				"## Agreements\n\n- [ ] **Ship weekly**\n    - (board-level agreement)\n",
		);
		expect(review.data).toEqual({
			viewMode: "by-column",
			blameFreeMode: false,
			columns: [
				{ id: "col-a", title: "Went well", seq: 1 },
				{ id: "col-b", title: "To improve", seq: 2 },
			],
			cards: [
				{ id: "c1", columnId: "col-a", content: "Fast deploys", notes: null, groupId: null, isGroupLead: false, voteCount: 2, reactions: { "👍": 1 } },
				{ id: "c2", columnId: "col-b", content: "Flaky tests", notes: "CI", groupId: null, isGroupLead: false, voteCount: 1, reactions: {} },
			],
			comments: [
				{ id: "m1", cardId: "c1", author: "Ann", content: "Nice" },
				{ id: "m2", cardId: "c2", author: "Bo", content: "Ugh" },
			],
			agreements: [
				{ id: "agr-scene-review", source: "agreement", content: "Ship weekly", completed: false, completedAt: null, cardId: undefined, cardContent: undefined },
			],
			surveys: [
				{
					sceneId: "scene-survey",
					sceneTitle: "Team health",
					results: [
						{
							question: { id: "q1", question: "Morale", seq: 1 },
							average: 4,
							totalResponses: 2,
							history: [{ boardId: "prior", boardName: "Sprint 41", average: 2 }],
						},
					],
				},
			],
		});
		expect(getHistoricalDataByThreadIds).toHaveBeenCalledWith(["t1"], "series-1", "scene-survey", undefined, 1);
	});

	it("applies each scene's hidden columns and loads agreements as that scene", async () => {
		mockSources();

		const scenes = await buildReviewScenesData("board-1", "by-column");
		const improvements = scenes![1];

		expect(improvements.data.columns.map((c) => c.id)).toEqual(["col-b"]);
		expect(improvements.data.cards.map((c) => c.id)).toEqual(["c2"]);
		expect(improvements.data.comments.map((c) => c.id)).toEqual(["m2"]);
		expect(improvements.markdown).not.toContain("Went well");
		expect(improvements.data.agreements[0].id).toBe("agr-scene-review-2");
		expect(buildEnrichedAgreementsData).toHaveBeenCalledWith(
			"board-1",
			expect.objectContaining({ currentSceneId: "scene-review-2" }),
		);
	});

	it("passes the view mode through to the markdown", async () => {
		mockSources();

		const [review] = (await buildReviewScenesData("board-1", "by-votes"))!;

		expect(review.data.viewMode).toBe("by-votes");
		expect(review.markdown.startsWith("## All Cards\n\n### Fast deploys (2 votes)\n\nOriginally in: Went well")).toBe(true);
	});

	it("does not expose author names on blame-free boards", async () => {
		mockSources({ blameFreeMode: true });

		const [review] = (await buildReviewScenesData("board-1", "by-column"))!;
		const serialized = JSON.stringify(review);

		expect(review.data.comments[0].author).toBe(getUserDisplayName("Ann", "board-1", true));
		expect(serialized).not.toContain("Ann");
		expect(serialized).not.toContain("u-ann");
	});

	it("skips survey scenes that have no questions", async () => {
		mockSources();
		vi.mocked(getHealthQuestionsByScene).mockResolvedValue([]);

		const [review] = (await buildReviewScenesData("board-1", "by-column"))!;

		expect(review.data.surveys).toEqual([]);
		expect(review.markdown).not.toContain("Survey");
	});
});
