import { json } from "@sveltejs/kit";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { requireSeriesMember } from "$lib/server/api/v1-access.js";
import { db } from "$lib/server/db/index.js";
import {
	boardSeries,
	boards,
	cards,
	columns,
	scenes,
	sceneFlags,
	scenesColumns,
} from "$lib/server/db/schema.js";
import { withTransaction } from "$lib/server/db/transaction.js";
import { v4 as uuidv4 } from "uuid";
import { getTemplate } from "$lib/server/templates.js";
import type { RequestHandler } from "./$types";

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
	meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	blameFreeMode: z.boolean().optional().default(false),
	votingAllocation: z.number().int().min(0).max(10).optional().default(3),
	templateId: z.string().optional(),
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
					sceneCount: sql<number>`(SELECT COUNT(*) FROM scenes WHERE scenes.board_id = ${boards.id})`,
					cardCount: sql<number>`(SELECT COUNT(*) FROM cards c JOIN columns col ON c.column_id = col.id WHERE col.board_id = ${boards.id})`,
					agreementCount: sql<number>`(SELECT COUNT(*) FROM agreements WHERE agreements.board_id = ${boards.id})`,
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
		if (err instanceof Response) throw err;
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

		// Enforce that templateId and manual columns/scenes are not both supplied
		const hasManualColumns = data.columns.length > 0;
		const hasManualScenes = data.scenes.length > 0;
		if (data.templateId && (hasManualColumns || hasManualScenes)) {
			return json(
				{
					success: false,
					error: "Cannot supply both templateId and columns/scenes — use one or the other",
				},
				{ status: 400 },
			);
		}

		const now = new Date().toISOString();
		const boardId = uuidv4();

		// If templateId is given, use template data instead of manual columns/scenes
		if (data.templateId) {
			const template = getTemplate(data.templateId);

			const result = await withTransaction(async (tx) => {
				// Create board — currentSceneId set after scenes are created
				await tx.insert(boards).values({
					id: boardId,
					seriesId,
					name: data.name,
					status: "draft",
					blameFreeMode: data.blameFreeMode,
					votingAllocation: data.votingAllocation,
					meetingDate: data.meetingDate ?? null,
					currentSceneId: null,
					createdAt: now,
					updatedAt: now,
				});

				// Create columns from template
				const columnIdMap = new Map<string, string>(); // title → id
				const createdColumns = [];
				for (const col of template.columns) {
					const description = col.getDescription ? col.getDescription() : (col.description ?? null);
					const columnId = uuidv4();
					await tx.insert(columns).values({
						id: columnId,
						boardId,
						title: col.title,
						description: description || null,
						seq: col.seq,
						defaultAppearance: col.default_appearance ?? "shown",
						createdAt: now,
					});
					columnIdMap.set(col.title, columnId);
					createdColumns.push({ id: columnId, title: col.title, seq: col.seq });
				}

				// Create scenes from template
				let currentSceneId: string | null = null;
				const createdScenes = [];
				for (const scene of template.scenes) {
					const sceneId = uuidv4();
					if (!currentSceneId) currentSceneId = sceneId;

					const { visibleColumns, flags, ...sceneData } = scene;
					await tx.insert(scenes).values({
						id: sceneId,
						boardId,
						...sceneData,
						createdAt: now,
					});

					// Insert scene flags
					if (flags && flags.length > 0) {
						for (const flag of flags) {
							await tx.insert(sceneFlags).values({ sceneId, flag });
						}
					}

					// Create scene-column relationships based on visibleColumns
					if (visibleColumns && visibleColumns.length > 0) {
						for (const [columnTitle, columnId] of columnIdMap) {
							await tx.insert(scenesColumns).values({
								sceneId,
								columnId,
								state: visibleColumns.includes(columnTitle) ? "visible" : "hidden",
							});
						}
					} else {
						for (const columnId of columnIdMap.values()) {
							await tx.insert(scenesColumns).values({
								sceneId,
								columnId,
								state: "visible",
							});
						}
					}

					createdScenes.push({
						id: sceneId,
						title: scene.title,
						mode: scene.mode,
						seq: scene.seq,
						flags: flags ?? [],
					});
				}

				// Set current scene to first scene
				if (currentSceneId) {
					await tx
						.update(boards)
						.set({ currentSceneId })
						.where(eq(boards.id, boardId));
				}

				return { columns: createdColumns, scenes: createdScenes, cards: [] as any[] };
			});

			return json(
				{
					success: true,
					board: {
						id: boardId,
						name: data.name,
						status: "draft",
						meetingDate: data.meetingDate ?? null,
						columns: result.columns,
						scenes: result.scenes,
						cards: result.cards,
						createdAt: now,
					},
				},
				{ status: 201 },
			);
		}

		// Manual columns/scenes path (original logic)

		// Validate card column references before touching the DB
		if (data.cards.length > 0) {
			const columnTitles = new Set(data.columns.map((c) => c.title));
			for (const card of data.cards) {
				if (!columnTitles.has(card.columnTitle)) {
					return json(
						{
							success: false,
							error: `Card references unknown column: '${card.columnTitle}'`,
						},
						{ status: 400 },
					);
				}
			}
		}

		// Pre-generate scene IDs so we know the first one before inserting the board
		const sceneIds = data.scenes.map(() => uuidv4());
		const firstSceneId = sceneIds[0] ?? null;

		const result = await withTransaction(async (tx) => {
			// Create board — set currentSceneId to first scene if scenes are provided
			await tx.insert(boards).values({
				id: boardId,
				seriesId,
				name: data.name,
				status: "draft",
				blameFreeMode: data.blameFreeMode,
				votingAllocation: data.votingAllocation,
				meetingDate: data.meetingDate ?? null,
				currentSceneId: firstSceneId,
				createdAt: now,
				updatedAt: now,
			});

			// Create columns
			const columnMap = new Map<string, string>(); // title → id
			const createdColumns = [];
			for (let i = 0; i < data.columns.length; i++) {
				const col = data.columns[i];
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

			// Create scenes
			const createdScenes = [];
			for (let i = 0; i < data.scenes.length; i++) {
				const scene = data.scenes[i];
				const sceneId = sceneIds[i];
				const seq = scene.seq ?? i + 1;
				await tx.insert(scenes).values({
					id: sceneId,
					boardId,
					title: scene.title,
					mode: scene.mode,
					seq,
					displayRule: scene.displayRule ?? null,
					createdAt: now,
				});
				// Insert scene flags
				for (const flag of scene.flags) {
					await tx.insert(sceneFlags).values({ sceneId, flag });
				}
				createdScenes.push({ id: sceneId, title: scene.title, mode: scene.mode, seq, flags: scene.flags });
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
					columns: result.columns,
					scenes: result.scenes,
					cards: result.cards,
					createdAt: now,
				},
			},
			{ status: 201 },
		);
	} catch (err) {
		if (err instanceof Response) throw err;
		if (err instanceof z.ZodError) {
			return json({ success: false, error: "Invalid input", details: err.errors }, { status: 400 });
		}
		console.error("[v1 POST /series/:id/boards]", err);
		return json({ success: false, error: "Failed to create board" }, { status: 500 });
	}
};
