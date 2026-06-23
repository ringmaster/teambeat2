import { json } from "@sveltejs/kit";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { requireSeriesMember } from "$lib/server/api/v1-access.js";
import { db } from "$lib/server/db/index.js";
import {
	agreements,
	boardSeries,
	boards,
	cards,
	columns,
	scenes,
	sceneFlags,
	scenesColumns,
} from "$lib/server/db/schema.js";
import { withTransaction } from "$lib/server/db/transaction.js";
import { BOARD_TEMPLATES, getTemplate } from "$lib/server/templates.js";
import { v4 as uuidv4 } from "uuid";
import type { RequestHandler } from "./$types";

const VALID_TEMPLATE_IDS = Object.keys(BOARD_TEMPLATES);

const SCENE_MODES = [
	"columns",
	"present",
	"review",
	"agreements",
	"scorecard",
	"static",
	"survey",
	"quadrant",
] as const;

const createBoardSchema = z.object({
	name: z.string().min(1).max(100),
	templateId: z.string().optional(),
	meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	blameFreeMode: z.boolean().optional().default(false),
	votingAllocation: z.number().int().min(0).max(10).optional().default(3),
	columns: z
		.array(
			z.object({
				title: z.string().min(1).max(100),
				description: z.string().max(500).optional(),
				seq: z.number().int().positive().optional(),
			}),
		)
		.max(20)
		.optional()
		.default([]),
	scenes: z
		.array(
			z.object({
				title: z.string().min(1).max(100),
				mode: z.enum(SCENE_MODES),
				seq: z.number().int().positive().optional(),
				flags: z.array(z.string()).optional().default([]),
				displayRule: z.string().optional(),
			}),
		)
		.max(20)
		.optional()
		.default([]),
	cards: z
		.array(
			z.object({
				columnTitle: z.string(),
				content: z.string().min(1).max(2000),
				notes: z.string().max(5000).optional(),
			}),
		)
		.optional()
		.default([]),
});

export const GET: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const seriesId = event.params.id;

		const [series] = await db
			.select({ id: boardSeries.id })
			.from(boardSeries)
			.where(eq(boardSeries.id, seriesId))
			.limit(1);
		if (!series) return json({ success: false, error: "Series not found" }, { status: 404 });

		const member = await requireSeriesMember(user.userId, seriesId);
		if (!member) return json({ success: false, error: "Access denied" }, { status: 403 });

		const url = event.url;
		const statusFilter = url.searchParams.get("status") ?? null;
		const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 100);
		const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

		const where = and(
			eq(boards.seriesId, seriesId),
			statusFilter ? eq(boards.status, statusFilter as any) : undefined,
		);

		const [boardRows, [{ total }]] = await Promise.all([
			db
				.select({
					id: boards.id,
					name: boards.name,
					status: boards.status,
					meetingDate: boards.meetingDate,
					createdAt: boards.createdAt,
					sceneCount: sql<number>`(SELECT COUNT(*) FROM scenes WHERE scenes.board_id = boards.id)`,
					cardCount: sql<number>`(SELECT COUNT(*) FROM cards c JOIN columns col ON c.column_id = col.id WHERE col.board_id = boards.id)`,
					agreementCount: sql<number>`(SELECT COUNT(*) FROM agreements WHERE agreements.board_id = boards.id)`,
				})
				.from(boards)
				.where(where)
				.orderBy(desc(boards.meetingDate), desc(boards.createdAt))
				.limit(limit)
				.offset(offset),
			db
				.select({ total: count() })
				.from(boards)
				.where(where),
		]);

		return json({
			success: true,
			boards: boardRows,
			meta: { total, limit, offset },
		});
	} catch (err) {
		if (err instanceof Response) return err as Response;
		console.error("[v1 GET /series/:id/boards]", err);
		return json({ success: false, error: "Failed to fetch boards" }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const seriesId = event.params.id;

		const [series] = await db
			.select({ id: boardSeries.id })
			.from(boardSeries)
			.where(eq(boardSeries.id, seriesId))
			.limit(1);
		if (!series) return json({ success: false, error: "Series not found" }, { status: 404 });

		const member = await requireSeriesMember(user.userId, seriesId);
		if (!member) return json({ success: false, error: "Access denied" }, { status: 403 });

		const body = await event.request.json();
		const data = createBoardSchema.parse(body);

		// Resolve columns and scenes: template takes precedence over explicit arrays
		let resolvedColumns = data.columns;
		let resolvedScenes: Array<{ title: string; mode: string; seq: number; flags: string[]; displayRule?: string; visibleColumns?: string[] }> = data.scenes;
		let templateUsed: string | null = null;

		if (data.templateId) {
			if (!VALID_TEMPLATE_IDS.includes(data.templateId)) {
				return json(
					{ success: false, error: `Unknown templateId '${data.templateId}'. Valid options: ${VALID_TEMPLATE_IDS.join(", ")}` },
					{ status: 400 },
				);
			}
			const tmpl = getTemplate(data.templateId);
			resolvedColumns = tmpl.columns.map((c, i) => ({
				title: c.title,
				description: c.getDescription ? c.getDescription() : (c.description ?? undefined),
				seq: c.seq ?? i + 1,
			}));
			resolvedScenes = tmpl.scenes.map((s, i) => ({
				title: s.title,
				mode: s.mode,
				seq: s.seq ?? i + 1,
				flags: [...(s.flags ?? [])],
				displayRule: s.displayRule,
				visibleColumns: s.visibleColumns,
			}));
			templateUsed = data.templateId;
		}

		// Validate card column references
		if (data.cards.length > 0) {
			const columnTitles = new Set(resolvedColumns.map((c) => c.title));
			for (const card of data.cards) {
				if (!columnTitles.has(card.columnTitle)) {
					return json(
						{ success: false, error: `Card references unknown column: '${card.columnTitle}'` },
						{ status: 400 },
					);
				}
			}
		}

		const now = new Date().toISOString();
		const boardId = uuidv4();

		const result = await withTransaction(async (tx) => {
			// Create board
			await tx.insert(boards).values({
				id: boardId,
				seriesId,
				name: data.name,
				status: "draft",
				blameFreeMode: data.blameFreeMode,
				votingAllocation: data.votingAllocation,
				meetingDate: data.meetingDate ?? null,
				createdAt: now,
				updatedAt: now,
			});

			// Create columns
			const columnMap = new Map<string, string>(); // title → id
			const createdColumns = [];
			for (let i = 0; i < resolvedColumns.length; i++) {
				const col = resolvedColumns[i];
				const colId = uuidv4();
				const seq = col.seq ?? i + 1;
				await tx.insert(columns).values({
					id: colId,
					boardId,
					title: col.title,
					description: col.description ?? null,
					seq,
					createdAt: now,
				});
				columnMap.set(col.title, colId);
				createdColumns.push({ id: colId, title: col.title, seq });
			}

			// Create scenes + scene flags + scene-column visibility
			const createdScenes = [];
			let firstSceneId: string | null = null;
			for (let i = 0; i < resolvedScenes.length; i++) {
				const scene = resolvedScenes[i];
				const sceneId = uuidv4();
				const seq = scene.seq ?? i + 1;
				if (!firstSceneId) firstSceneId = sceneId;

				await tx.insert(scenes).values({
					id: sceneId,
					boardId,
					title: scene.title,
					mode: scene.mode,
					seq,
					displayRule: scene.displayRule ?? null,
					createdAt: now,
				});

				for (const flag of scene.flags) {
					await tx.insert(sceneFlags).values({ sceneId, flag });
				}

				// Scene-column visibility (from template visibleColumns, or all visible)
				if (columnMap.size > 0) {
					for (const [colTitle, colId] of columnMap) {
						await tx.insert(scenesColumns).values({
							sceneId,
							columnId: colId,
							state: scene.visibleColumns
								? (scene.visibleColumns.includes(colTitle) ? "visible" : "hidden")
								: "visible",
						});
					}
				}

				createdScenes.push({ id: sceneId, title: scene.title, mode: scene.mode, seq, flags: scene.flags });
			}

			// Set currentSceneId to first scene
			if (firstSceneId) {
				await tx.update(boards).set({ currentSceneId: firstSceneId }).where(eq(boards.id, boardId));
			}

			// Create seed cards
			const createdCards = [];
			for (let i = 0; i < data.cards.length; i++) {
				const card = data.cards[i];
				const cardId = uuidv4();
				const colId = columnMap.get(card.columnTitle)!;
				await tx.insert(cards).values({
					id: cardId,
					columnId: colId,
					userId: user.userId,
					content: card.content,
					notes: card.notes ?? null,
					seq: i + 1,
					createdAt: now,
					updatedAt: now,
				});
				createdCards.push({ id: cardId, columnId: colId, content: card.content });
			}

			return { columns: createdColumns, scenes: createdScenes, cards: createdCards };
		});

		return json(
			{
				success: true,
				board: {
					id: boardId,
					name: data.name,
					status: "draft",
					meetingDate: data.meetingDate ?? null,
					templateId: templateUsed,
					columns: result.columns,
					scenes: result.scenes,
					cards: result.cards,
					createdAt: now,
				},
			},
			{ status: 201 },
		);
	} catch (err) {
		if (err instanceof Response) return err as Response;
		if (err instanceof z.ZodError) {
			return json({ success: false, error: "Invalid input", details: err.errors }, { status: 400 });
		}
		console.error("[v1 POST /series/:id/boards]", err);
		return json({ success: false, error: "Failed to create board" }, { status: 500 });
	}
};
