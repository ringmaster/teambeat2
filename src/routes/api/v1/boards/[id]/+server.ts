import { json } from "@sveltejs/kit";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { getBoardSeriesForUser, requireSeriesMember } from "$lib/server/api/v1-access.js";
import { db } from "$lib/server/db/index.js";
import { boards, cards, columns, sceneFlags, scenes } from "$lib/server/db/schema.js";
import { updateBoardSettings, updateBoardStatus } from "$lib/server/repositories/board.js";
import type { RequestHandler } from "./$types";

const patchBoardSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
	status: z.enum(["draft", "active", "completed", "archived"]).optional(),
	blameFreeMode: z.boolean().optional(),
	votingAllocation: z.number().int().min(0).max(20).optional(),
});

export const GET: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const boardId = event.params.id;

		const access = await getBoardSeriesForUser(user.userId, boardId);
		if (access === "not_found")
			return json({ success: false, error: "Board not found" }, { status: 404 });
		if (access === "forbidden")
			return json({ success: false, error: "Access denied" }, { status: 403 });

		const [[board], boardColumns, boardScenes, boardCards] = await Promise.all([
			db
				.select({
					id: boards.id,
					seriesId: boards.seriesId,
					name: boards.name,
					status: boards.status,
					meetingDate: boards.meetingDate,
					blameFreeMode: boards.blameFreeMode,
					votingAllocation: boards.votingAllocation,
					votingEnabled: boards.votingEnabled,
					currentSceneId: boards.currentSceneId,
					createdAt: boards.createdAt,
				})
				.from(boards)
				.where(eq(boards.id, boardId))
				.limit(1),

			db
				.select({ id: columns.id, title: columns.title, seq: columns.seq })
				.from(columns)
				.where(eq(columns.boardId, boardId))
				.orderBy(columns.seq),

			db
				.select({ id: scenes.id, title: scenes.title, mode: scenes.mode, seq: scenes.seq })
				.from(scenes)
				.where(eq(scenes.boardId, boardId))
				.orderBy(scenes.seq),

			db
				.select({
					id: cards.id,
					columnId: cards.columnId,
					content: cards.content,
					groupId: cards.groupId,
					voteCount: sql<number>`(SELECT COUNT(*) FROM votes WHERE votes.card_id = ${cards.id})`,
					commentCount: sql<number>`(SELECT COUNT(*) FROM comments WHERE comments.card_id = ${cards.id} AND comments.is_reaction = 0)`,
					createdAt: cards.createdAt,
				})
				.from(cards)
				.innerJoin(columns, eq(columns.id, cards.columnId))
				.where(eq(columns.boardId, boardId))
				.orderBy(cards.seq, cards.createdAt),
		]);

		// Fetch scene flags for all scenes in one query
		const flagMap = new Map<string, string[]>();
		if (boardScenes.length > 0) {
			const flagRows = await db
				.select({ sceneId: sceneFlags.sceneId, flag: sceneFlags.flag })
				.from(sceneFlags)
				.innerJoin(scenes, eq(scenes.id, sceneFlags.sceneId))
				.where(eq(scenes.boardId, boardId));

			for (const row of flagRows) {
				if (!flagMap.has(row.sceneId)) flagMap.set(row.sceneId, []);
				flagMap.get(row.sceneId)!.push(row.flag);
			}
		}

		return json({
			success: true,
			board: {
				...board,
				columns: boardColumns,
				scenes: boardScenes.map((s) => ({ ...s, flags: flagMap.get(s.id) ?? [] })),
				cards: boardCards,
			},
		});
	} catch (err) {
		if (err instanceof Response) throw err;
		return json({ success: false, error: "Failed to fetch board" }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const boardId = event.params.id;

		const access = await getBoardSeriesForUser(user.userId, boardId);
		if (access === "not_found")
			return json({ success: false, error: "Board not found" }, { status: 404 });
		if (access === "forbidden")
			return json({ success: false, error: "Access denied" }, { status: 403 });

		const member = await requireSeriesMember(user.userId, access.seriesId);
		if (!member || (member.role !== "admin" && member.role !== "facilitator"))
			return json({ success: false, error: "Only facilitators and admins can update boards" }, { status: 403 });

		const body = await event.request.json();
		const data = patchBoardSchema.parse(body);

		if (data.status) await updateBoardStatus(boardId, data.status);

		const settings: Record<string, unknown> = {};
		if (data.name !== undefined) settings.name = data.name;
		if (data.meetingDate !== undefined) settings.meetingDate = data.meetingDate;
		if (data.blameFreeMode !== undefined) settings.blameFreeMode = data.blameFreeMode;
		if (data.votingAllocation !== undefined) settings.votingAllocation = data.votingAllocation;
		if (Object.keys(settings).length > 0) await updateBoardSettings(boardId, settings);

		const [board] = await db
			.select({ id: boards.id, name: boards.name, status: boards.status, meetingDate: boards.meetingDate, blameFreeMode: boards.blameFreeMode, votingAllocation: boards.votingAllocation, currentSceneId: boards.currentSceneId })
			.from(boards).where(eq(boards.id, boardId)).limit(1);

		return json({ success: true, board });
	} catch (err) {
		if (err instanceof Response) throw err;
		return json({ success: false, error: "Failed to update board" }, { status: 500 });
	}
};
