import { json } from "@sveltejs/kit";
import { inArray } from "drizzle-orm";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { db } from "$lib/server/db/index.js";
import { healthResponses } from "$lib/server/db/schema.js";
import { findBoardById } from "$lib/server/repositories/board.js";
import { getUserRoleInSeries } from "$lib/server/repositories/board-series.js";
import {
	getHealthQuestionsByScene,
	getHistoricalDataByThreadIds,
} from "$lib/server/repositories/health.js";
import { findSceneById } from "$lib/server/repositories/scene.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const sceneId = event.params.sceneId;

		// Parse query parameters for historical data
		const url = new URL(event.request.url);
		const historyDepth = Math.min(
			Math.max(parseInt(url.searchParams.get("historyDepth") || "3", 10), 0),
			5,
		);
		const includeUserHistory =
			url.searchParams.get("includeUserHistory") === "true";

		const scene = await findSceneById(sceneId);
		if (!scene) {
			return json(
				{ success: false, error: "Scene not found" },
				{ status: 404 },
			);
		}

		// Get the current board info
		const currentBoard = await findBoardById(scene.boardId);

		// Check if user has access to the series
		const userRole = await getUserRoleInSeries(user.userId, scene.seriesId);
		if (!userRole) {
			return json({ success: false, error: "Access denied" }, { status: 403 });
		}

		// Get all questions for this scene
		const questions = await getHealthQuestionsByScene(sceneId);

		if (questions.length === 0) {
			return json({
				success: true,
				results: [],
				historicalBoards: [],
			});
		}

		const questionIds = questions.map((q) => q.id);
		const threadIds = questions.map((q) => q.threadId);

		// Get all responses for these questions (include userId to find current user's rating)
		const responses = await db
			.select({
				questionId: healthResponses.questionId,
				userId: healthResponses.userId,
				rating: healthResponses.rating,
			})
			.from(healthResponses)
			.where(inArray(healthResponses.questionId, questionIds));

		// Get historical data if requested
		let historicalDataMap = new Map<
			string,
			{
				questionId: string;
				boardId: string;
				boardName: string;
				boardCreatedAt: string;
				meetingDate: string | null;
				average: number;
				totalResponses: number;
				userRating: number | null;
			}[]
		>();

		if (historyDepth > 0) {
			historicalDataMap = await getHistoricalDataByThreadIds(
				threadIds,
				scene.seriesId,
				sceneId,
				includeUserHistory ? user.userId : undefined,
				historyDepth,
			);
		}

		// Build unique list of historical boards for radar chart legend
		const historicalBoardsMap = new Map<
			string,
			{
				boardId: string;
				boardName: string;
				boardCreatedAt: string;
				meetingDate: string | null;
			}
		>();
		for (const historyItems of historicalDataMap.values()) {
			for (const item of historyItems) {
				if (!historicalBoardsMap.has(item.boardId)) {
					historicalBoardsMap.set(item.boardId, {
						boardId: item.boardId,
						boardName: item.boardName,
						boardCreatedAt: item.boardCreatedAt,
						meetingDate: item.meetingDate,
					});
				}
			}
		}
		// Sort boards by date descending (most recent first)
		const historicalBoards = Array.from(historicalBoardsMap.values()).sort(
			(a, b) =>
				new Date(b.boardCreatedAt).getTime() -
				new Date(a.boardCreatedAt).getTime(),
		);

		// Calculate statistics for each question
		const results = questions.map((question) => {
			const questionResponses = responses.filter(
				(r) => r.questionId === question.id,
			);
			const totalResponses = questionResponses.length;

			let average = 0;
			const distribution: { [key: number]: number } = {};

			if (totalResponses > 0) {
				const sum = questionResponses.reduce((acc, r) => acc + r.rating, 0);
				average = sum / totalResponses;

				// Count distribution
				for (const response of questionResponses) {
					distribution[response.rating] =
						(distribution[response.rating] || 0) + 1;
				}
			}

			// Get historical data for this question's thread
			const history = historicalDataMap.get(question.threadId) || [];

			// Find current user's rating for this question
			const currentUserResponse = includeUserHistory
				? questionResponses.find((r) => r.userId === user.userId)
				: null;
			const currentUserRating = currentUserResponse?.rating ?? null;

			// Extract user's historical ratings (sorted oldest to newest for sparkline)
			const userHistory = includeUserHistory
				? history
						.filter((h) => h.userRating !== null)
						.map((h) => ({
							rating: h.userRating as number,
							boardCreatedAt: h.boardCreatedAt,
						}))
						.reverse() // oldest first for sparkline
				: [];

			return {
				question: {
					id: question.id,
					question: question.question,
					description: question.description,
					questionType: question.questionType,
					seq: question.seq,
					threadId: question.threadId,
				},
				average,
				totalResponses,
				distribution,
				history: history.slice().reverse(), // oldest first for sparkline
				userHistory,
				currentUserRating,
			};
		});

		// Sort by sequence
		results.sort((a, b) => a.question.seq - b.question.seq);

		return json({
			success: true,
			results,
			historicalBoards,
			currentBoard: currentBoard
				? {
						boardId: currentBoard.id,
						boardName: currentBoard.name,
						boardCreatedAt: currentBoard.createdAt,
						meetingDate: currentBoard.meetingDate,
					}
				: null,
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}

		console.error("Error getting health results:", error);
		return json(
			{
				success: false,
				error: "Failed to get health results",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
};
