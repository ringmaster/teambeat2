import { json } from "@sveltejs/kit";
import { asc, desc, eq } from "drizzle-orm";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { requireSeriesMember } from "$lib/server/api/v1-access.js";
import { db } from "$lib/server/db/index.js";
import {
	boardSeries,
	boards,
	healthQuestions,
	healthResponses,
	scenes,
} from "$lib/server/db/schema.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const seriesId = event.params.id;

		const [series] = await db
			.select({ id: boardSeries.id, name: boardSeries.name })
			.from(boardSeries)
			.where(eq(boardSeries.id, seriesId))
			.limit(1);
		if (!series) return json({ success: false, error: "Series not found" }, { status: 404 });

		const member = await requireSeriesMember(user.userId, seriesId);
		if (!member) return json({ success: false, error: "Access denied" }, { status: 403 });

		const boardLimit = Math.min(
			Math.max(Number(event.url.searchParams.get("limit") ?? 10), 1),
			50,
		);

		// Get recent boards (sorted newest-first for slicing, then reversed for history order)
		const recentBoards = await db
			.select({ id: boards.id, name: boards.name, meetingDate: boards.meetingDate })
			.from(boards)
			.where(eq(boards.seriesId, seriesId))
			.orderBy(desc(boards.meetingDate), desc(boards.createdAt))
			.limit(boardLimit);

		if (recentBoards.length === 0) {
			return json({ success: true, series, questions: [] });
		}

		const boardIndex = new Map(recentBoards.map((b) => [b.id, b]));

		// One query: health questions → scenes → boards → responses for this series
		const allQuestionRows = await db
			.select({
				threadId: healthQuestions.threadId,
				question: healthQuestions.question,
				questionType: healthQuestions.questionType,
				boardId: boards.id,
				boardName: boards.name,
				meetingDate: boards.meetingDate,
				rating: healthResponses.rating,
			})
			.from(healthQuestions)
			.innerJoin(scenes, eq(scenes.id, healthQuestions.sceneId))
			.innerJoin(boards, eq(boards.id, scenes.boardId))
			.leftJoin(healthResponses, eq(healthResponses.questionId, healthQuestions.id))
			.where(eq(boards.seriesId, seriesId))
			.orderBy(asc(boards.meetingDate), asc(healthQuestions.seq));

		// Aggregate: threadId → { question meta, boardData map }
		const threadMap = new Map<
			string,
			{
				threadId: string;
				question: string;
				questionType: string;
				boardData: Map<string, { boardId: string; boardName: string; meetingDate: string | null; ratings: number[] }>;
			}
		>();

		for (const row of allQuestionRows) {
			if (!boardIndex.has(row.boardId)) continue;

			if (!threadMap.has(row.threadId)) {
				threadMap.set(row.threadId, {
					threadId: row.threadId,
					question: row.question,
					questionType: row.questionType,
					boardData: new Map(),
				});
			}
			const thread = threadMap.get(row.threadId)!;

			if (!thread.boardData.has(row.boardId)) {
				thread.boardData.set(row.boardId, {
					boardId: row.boardId,
					boardName: row.boardName,
					meetingDate: row.meetingDate,
					ratings: [],
				});
			}

			if (row.rating !== null) {
				thread.boardData.get(row.boardId)!.ratings.push(row.rating);
			}
		}

		const questions = Array.from(threadMap.values()).map((thread) => {
			const history = Array.from(thread.boardData.values())
				.sort((a, b) => {
					if (!a.meetingDate && !b.meetingDate) return 0;
					if (!a.meetingDate) return 1;
					if (!b.meetingDate) return -1;
					return a.meetingDate.localeCompare(b.meetingDate);
				})
				.map((bd) => {
					const { ratings } = bd;
					const responseCount = ratings.length;
					const avgRating =
						responseCount > 0
							? Math.round((ratings.reduce((a, b) => a + b, 0) / responseCount) * 10) / 10
							: null;
					const distribution: Record<string, number> = {};
					for (const r of ratings) {
						const key = String(r);
						distribution[key] = (distribution[key] ?? 0) + 1;
					}
					return { boardId: bd.boardId, boardName: bd.boardName, meetingDate: bd.meetingDate, avgRating, responseCount, distribution };
				});

			return { threadId: thread.threadId, question: thread.question, questionType: thread.questionType, history };
		});

		return json({ success: true, series, questions });
	} catch (err) {
		if (err instanceof Response) return err as Response;
		console.error("[v1 health-summary]", err);
		return json({ success: false, error: "Failed to fetch health summary" }, { status: 500 });
	}
};
