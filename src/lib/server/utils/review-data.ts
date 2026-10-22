import { eq, inArray } from "drizzle-orm";
import { getUserDisplayName } from "$lib/utils/animalNames.js";
import {
	buildReviewMarkdown,
	getVisibleReviewColumns,
	type ReviewCard,
	type ReviewColumn,
	type ReviewSurvey,
	type ReviewViewMode,
} from "$lib/utils/review-markdown.js";
import { db } from "../db/index.js";
import { cards, columns, comments, healthResponses, users } from "../db/schema.js";
import { getBoardWithDetails } from "../repositories/board.js";
import {
	getHealthQuestionsByScene,
	getHistoricalDataByThreadIds,
} from "../repositories/health.js";
import { buildEnrichedAgreementsData } from "./agreements-data.js";
import { buildAllCardsData } from "./cards-data.js";

export interface ReviewSceneComment {
	id: string;
	cardId: string;
	// Display name; an animal name when the board is in blame-free mode
	author: string;
	content: string;
}

export interface ReviewSceneAgreement {
	id: string;
	source: "agreement" | "comment";
	content: string;
	completed: boolean;
	completedAt: string | null;
	cardId?: string;
	cardContent?: string;
}

// The data that produced a review scene's markdown
export interface ReviewSceneData {
	viewMode: ReviewViewMode;
	blameFreeMode: boolean;
	columns: ReviewColumn[];
	cards: ReviewCard[];
	comments: ReviewSceneComment[];
	agreements: ReviewSceneAgreement[];
	surveys: ReviewSurvey[];
}

// Row shapes for queries whose results are untyped (db is a SQLite/Postgres union)
interface BoardCommentRow {
	id: string;
	cardId: string;
	userName: string | null;
	content: string;
	isAgreement: boolean | null;
	isReaction: boolean | null;
}

interface HealthQuestionRow {
	id: string;
	question: string;
	seq: number;
	threadId: string;
}

interface BoardScene {
	id: string;
	title: string;
	mode: string;
}

export interface ReviewSceneContent {
	id: string;
	name: string;
	markdown: string;
	data: ReviewSceneData;
}

/**
 * All comments on the board's cards, with the author's name.
 * Same query as GET /api/boards/:id/comments, which the review scene uses in the UI.
 */
async function getBoardComments(boardId: string): Promise<BoardCommentRow[]> {
	return db
		.select({
			id: comments.id,
			cardId: comments.cardId,
			userName: users.name,
			content: comments.content,
			isAgreement: comments.isAgreement,
			isReaction: comments.isReaction,
		})
		.from(comments)
		.innerJoin(cards, eq(comments.cardId, cards.id))
		.innerJoin(columns, eq(cards.columnId, columns.id))
		.leftJoin(users, eq(comments.userId, users.id))
		.where(eq(columns.boardId, boardId))
		.orderBy(comments.createdAt);
}

/**
 * Survey averages for each survey scene on the board, with the prior board's average.
 * Matches GET /api/scenes/:id/health-results?historyDepth=1, which the review scene uses in the UI.
 * Survey scenes with no questions are left out.
 */
async function getBoardSurveyResults(
	seriesId: string,
	surveyScenes: { id: string; title: string }[],
): Promise<ReviewSurvey[]> {
	const surveys: ReviewSurvey[] = [];

	for (const scene of surveyScenes) {
		const questions: HealthQuestionRow[] = await getHealthQuestionsByScene(scene.id);
		if (questions.length === 0) continue;

		const responses: { questionId: string; rating: number }[] = await db
			.select({
				questionId: healthResponses.questionId,
				rating: healthResponses.rating,
			})
			.from(healthResponses)
			.where(
				inArray(
					healthResponses.questionId,
					questions.map((q) => q.id),
				),
			);

		const historyByThread = await getHistoricalDataByThreadIds(
			questions.map((q) => q.threadId),
			seriesId,
			scene.id,
			undefined,
			1,
		);

		const results = questions
			.map((question) => {
				const ratings = responses
					.filter((r) => r.questionId === question.id)
					.map((r) => r.rating);
				const average =
					ratings.length > 0
						? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
						: 0;
				const history = (historyByThread.get(question.threadId) || [])
					.slice()
					.reverse()
					.map((h) => ({
						boardId: h.boardId,
						boardName: h.boardName,
						average: h.average,
					}));

				return {
					question: {
						id: question.id,
						question: question.question,
						seq: question.seq,
					},
					average,
					totalResponses: ratings.length,
					history,
				};
			})
			.sort((a, b) => a.question.seq - b.question.seq);

		surveys.push({ sceneId: scene.id, sceneTitle: scene.title, results });
	}

	return surveys;
}

/**
 * The rendered markdown and source data for every review scene on a board,
 * in scene order. Returns null when the board does not exist.
 */
export async function buildReviewScenesData(
	boardId: string,
	viewMode: ReviewViewMode,
): Promise<ReviewSceneContent[] | null> {
	const board = await getBoardWithDetails(boardId);
	if (!board) return null;

	const boardScenes: BoardScene[] = board.scenes;
	const reviewScenes = boardScenes.filter((scene) => scene.mode === "review");
	if (reviewScenes.length === 0) return [];

	const surveyScenes = boardScenes.filter((scene) => scene.mode === "survey");
	const blameFreeMode = board.blameFreeMode || false;

	const [allCards, allComments, surveys] = await Promise.all([
		buildAllCardsData(boardId),
		getBoardComments(boardId),
		getBoardSurveyResults(board.seriesId, surveyScenes),
	]);

	const scenesContent: ReviewSceneContent[] = [];

	for (const scene of reviewScenes) {
		// Show each scene as a viewer sees it when that scene is the current scene:
		// its own hidden columns, and comment agreements from its visible columns.
		const visibleColumns = getVisibleReviewColumns(
			board.allColumns,
			board.hiddenColumnsByScene[scene.id] || [],
		);
		const visibleColumnIds = new Set(visibleColumns.map((c) => c.id));
		const sceneCards = allCards.filter((card) => visibleColumnIds.has(card.columnId));
		const agreements = await buildEnrichedAgreementsData(boardId, {
			...board,
			currentSceneId: scene.id,
		});

		const markdown = buildReviewMarkdown({
			boardId,
			blameFreeMode,
			visibleColumns,
			cards: sceneCards,
			comments: allComments,
			agreements,
			surveys,
			viewMode,
		});

		const sceneCardIds = new Set(sceneCards.map((card) => card.id));

		scenesContent.push({
			id: scene.id,
			name: scene.title,
			markdown,
			data: {
				viewMode,
				blameFreeMode,
				columns: visibleColumns.map((c) => ({ id: c.id, title: c.title, seq: c.seq })),
				cards: sceneCards.map((card) => ({
					id: card.id,
					columnId: card.columnId,
					content: card.content,
					notes: card.notes ?? null,
					groupId: card.groupId,
					isGroupLead: card.isGroupLead,
					voteCount: card.voteCount,
					reactions: card.reactions ?? {},
				})),
				// Only the comments that appear in the markdown
				comments: allComments
					.filter(
						(comment) =>
							sceneCardIds.has(comment.cardId) &&
							!comment.isReaction &&
							!comment.isAgreement,
					)
					.map((comment) => ({
						id: comment.id,
						cardId: comment.cardId,
						author: getUserDisplayName(
							comment.userName || "Anonymous",
							boardId,
							blameFreeMode,
						),
						content: comment.content,
					})),
				agreements: agreements.map((agreement) => ({
					id: agreement.id,
					source: agreement.source,
					content: agreement.content,
					completed: agreement.completed,
					completedAt: agreement.completedAt,
					cardId: agreement.cardId,
					cardContent: agreement.cardContent,
				})),
				surveys,
			},
		});
	}

	return scenesContent;
}
