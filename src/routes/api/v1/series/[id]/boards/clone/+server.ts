import { json } from "@sveltejs/kit";
import { eq, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { requireSeriesMember } from "$lib/server/api/v1-access.js";
import { db } from "$lib/server/db/index.js";
import {
	agreements,
	boardSeries,
	boards,
	columns,
	healthQuestions,
	sceneFlags,
	sceneScorecards,
	scenes,
	scenesColumns,
} from "$lib/server/db/schema.js";
import { withTransaction } from "$lib/server/db/transaction.js";
import {
	findIncompleteAgreementsByBoardId,
	findIncompleteCommentAgreementsByBoardId,
} from "$lib/server/repositories/agreement.js";
import type { RequestHandler } from "./$types";

const cloneSchema = z.object({
	sourceId: z.string().uuid(),
	name: z.string().min(1).max(100).optional(),
	meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

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
		if (!member || (member.role !== "admin" && member.role !== "facilitator")) {
			return json({ success: false, error: "Facilitator or admin required" }, { status: 403 });
		}

		const body = await event.request.json();
		const data = cloneSchema.parse(body);

		// Fetch source board and verify it belongs to this series
		const [sourceBoard] = await db
			.select({
				id: boards.id,
				name: boards.name,
				seriesId: boards.seriesId,
				status: boards.status,
				blameFreeMode: boards.blameFreeMode,
				votingAllocation: boards.votingAllocation,
				votingEnabled: boards.votingEnabled,
			})
			.from(boards)
			.where(eq(boards.id, data.sourceId))
			.limit(1);

		if (!sourceBoard) {
			return json({ success: false, error: "Source board not found" }, { status: 404 });
		}
		if (sourceBoard.seriesId !== seriesId) {
			return json({ success: false, error: "Source board does not belong to this series" }, { status: 400 });
		}

		const willComplete = sourceBoard.status === "active" || sourceBoard.status === "draft";
		const now = new Date().toISOString();
		const newBoardId = uuidv4();
		const newBoardName = data.name ?? sourceBoard.name;

		await withTransaction(async (tx) => {
			// Create the new board
			await tx.insert(boards).values({
				id: newBoardId,
				seriesId,
				name: newBoardName,
				status: "draft",
				blameFreeMode: sourceBoard.blameFreeMode,
				votingAllocation: sourceBoard.votingAllocation,
				votingEnabled: sourceBoard.votingEnabled,
				meetingDate: data.meetingDate ?? null,
				cloneOf: data.sourceId,
				createdAt: now,
				updatedAt: now,
			});

			// Clone columns
			const sourceColumns = await tx
				.select()
				.from(columns)
				.where(eq(columns.boardId, data.sourceId));

			const columnIdMap = new Map<string, string>(); // old → new
			for (const col of sourceColumns) {
				const newColId = uuidv4();
				columnIdMap.set(col.id, newColId);
				await tx.insert(columns).values({
					id: newColId,
					boardId: newBoardId,
					title: col.title,
					description: col.description,
					seq: col.seq,
					defaultAppearance: col.defaultAppearance,
					createdAt: now,
				});
			}

			// Clone scenes
			const sourceScenes = await tx
				.select()
				.from(scenes)
				.where(eq(scenes.boardId, data.sourceId));

			const sceneIdMap = new Map<string, string>(); // old → new
			let firstSceneId: string | null = null;
			for (const scene of sourceScenes) {
				const newSceneId = uuidv4();
				sceneIdMap.set(scene.id, newSceneId);
				if (!firstSceneId) firstSceneId = newSceneId;
				await tx.insert(scenes).values({
					id: newSceneId,
					boardId: newBoardId,
					title: scene.title,
					description: scene.description,
					mode: scene.mode,
					seq: scene.seq,
					displayRule: scene.displayRule,
					createdAt: now,
				});
			}

			// Clone scene flags
			if (sceneIdMap.size > 0) {
				const sourceFlags = await tx
					.select()
					.from(sceneFlags)
					.where(inArray(sceneFlags.sceneId, [...sceneIdMap.keys()]));
				for (const f of sourceFlags) {
					const newSceneId = sceneIdMap.get(f.sceneId);
					if (newSceneId) await tx.insert(sceneFlags).values({ sceneId: newSceneId, flag: f.flag });
				}
			}

			// Clone scene-column visibility
			if (sceneIdMap.size > 0) {
				const sourceScenesColumns = await tx
					.select({ sceneId: scenesColumns.sceneId, columnId: scenesColumns.columnId, state: scenesColumns.state })
					.from(scenesColumns)
					.innerJoin(scenes, eq(scenes.id, scenesColumns.sceneId))
					.where(eq(scenes.boardId, data.sourceId));
				for (const sc of sourceScenesColumns) {
					const newSceneId = sceneIdMap.get(sc.sceneId);
					const newColId = columnIdMap.get(sc.columnId);
					if (newSceneId && newColId) {
						await tx.insert(scenesColumns).values({ sceneId: newSceneId, columnId: newColId, state: sc.state });
					}
				}
			}

			// Clone scene scorecards
			if (sceneIdMap.size > 0) {
				const sourceScorecards = await tx
					.select()
					.from(sceneScorecards)
					.where(inArray(sceneScorecards.sceneId, [...sceneIdMap.keys()]));
				for (const sc of sourceScorecards) {
					const newSceneId = sceneIdMap.get(sc.sceneId);
					if (newSceneId) {
						await tx.insert(sceneScorecards).values({
							id: uuidv4(),
							sceneId: newSceneId,
							scorecardId: sc.scorecardId,
							collectedData: null,
							processedAt: null,
							createdAt: now,
						});
					}
				}
			}

			// Clone health questions (preserve threadId for historical continuity)
			if (sceneIdMap.size > 0) {
				const sourceQuestions = await tx
					.select()
					.from(healthQuestions)
					.where(inArray(healthQuestions.sceneId, [...sceneIdMap.keys()]));
				for (const q of sourceQuestions) {
					const newSceneId = sceneIdMap.get(q.sceneId);
					if (newSceneId) {
						await tx.insert(healthQuestions).values({
							id: uuidv4(),
							threadId: q.threadId,
							sceneId: newSceneId,
							question: q.question,
							description: q.description,
							questionType: q.questionType,
							seq: q.seq,
							createdAt: now,
						});
					}
				}
			}

			// Carry forward incomplete agreements from source
			const [incompleteFree, incompleteComment] = await Promise.all([
				findIncompleteAgreementsByBoardId(data.sourceId),
				findIncompleteCommentAgreementsByBoardId(data.sourceId),
			]);
			for (const ag of [...incompleteFree, ...incompleteComment]) {
				await tx.insert(agreements).values({
					id: uuidv4(),
					boardId: newBoardId,
					userId: ag.userId,
					content: ag.content,
					completed: false,
					completedByUserId: null,
					completedAt: null,
					sourceAgreementId: (ag as any).id ?? null,
					createdAt: ag.createdAt,
					updatedAt: now,
				});
			}

			// Set currentSceneId on new board
			if (firstSceneId) {
				await tx.update(boards).set({ currentSceneId: firstSceneId }).where(eq(boards.id, newBoardId));
			}

			// Mark source as completed if it was active or draft
			if (willComplete) {
				await tx.update(boards).set({ status: "completed", updatedAt: now }).where(eq(boards.id, data.sourceId));
			}
		});

		return json(
			{
				success: true,
				board: {
					id: newBoardId,
					name: newBoardName,
					status: "draft",
					meetingDate: data.meetingDate ?? null,
					cloneOf: data.sourceId,
					createdAt: now,
				},
				sourceBoardCompleted: willComplete,
			},
			{ status: 201 },
		);
	} catch (err) {
		if (err instanceof Response) return err as Response;
		if (err instanceof z.ZodError) {
			return json({ success: false, error: "Invalid input", details: err.errors }, { status: 400 });
		}
		return json({ success: false, error: "Failed to clone board" }, { status: 500 });
	}
};
