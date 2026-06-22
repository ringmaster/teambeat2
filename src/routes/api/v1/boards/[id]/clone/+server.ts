import { json } from "@sveltejs/kit";
import { and, eq, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { handleApiError } from "$lib/server/api-utils.js";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { requireSeriesMember } from "$lib/server/api/v1-access.js";
import { db } from "$lib/server/db/index.js";
import {
	agreements,
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
import { getBoardWithDetails } from "$lib/server/repositories/board.js";
import type { RequestHandler } from "./$types";

const cloneBoardSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const POST: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const sourceId = event.params.id;

		// Load source board
		const sourceBoard = await getBoardWithDetails(sourceId);
		if (!sourceBoard) {
			return json({ success: false, error: "Board not found" }, { status: 404 });
		}

		// Check series membership
		const member = await requireSeriesMember(user.userId, sourceBoard.seriesId);
		if (!member) {
			return json({ success: false, error: "Access denied" }, { status: 403 });
		}

		// Parse optional body
		let body: { name?: string; meetingDate?: string } = {};
		try {
			const raw = await event.request.json();
			body = cloneBoardSchema.parse(raw);
		} catch {
			// Empty body is fine
		}

		const now = new Date().toISOString();
		const newBoardId = uuidv4();
		const boardName = body.name ?? sourceBoard.name;
		const meetingDate = body.meetingDate ?? null;

		await withTransaction(async (tx) => {
			// Create the new empty board row
			await tx.insert(boards).values({
				id: newBoardId,
				seriesId: sourceBoard.seriesId,
				name: boardName,
				status: "draft",
				blameFreeMode: sourceBoard.blameFreeMode,
				votingAllocation: sourceBoard.votingAllocation,
				votingEnabled: sourceBoard.votingEnabled,
				cloneOf: sourceId,
				meetingDate,
				currentSceneId: null,
				createdAt: now,
				updatedAt: now,
			});

			// Clone columns
			const sourceColumns = await tx
				.select()
				.from(columns)
				.where(eq(columns.boardId, sourceId));

			const columnIdMapping: Record<string, string> = {};

			for (const column of sourceColumns) {
				const newColumnId = uuidv4();
				columnIdMapping[column.id] = newColumnId;

				await tx.insert(columns).values({
					id: newColumnId,
					boardId: newBoardId,
					title: column.title,
					description: column.description,
					seq: column.seq,
					defaultAppearance: column.defaultAppearance,
					createdAt: now,
				});
			}

			// Clone scenes
			const sourceScenes = await tx
				.select()
				.from(scenes)
				.where(eq(scenes.boardId, sourceId));

			let firstSceneId: string | null = null;
			const sceneIdMapping: Record<string, string> = {};

			for (const scene of sourceScenes) {
				const newSceneId = uuidv4();
				if (!firstSceneId) firstSceneId = newSceneId;
				sceneIdMapping[scene.id] = newSceneId;

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
			if (Object.keys(sceneIdMapping).length > 0) {
				const sourceSceneIds = Object.keys(sceneIdMapping);
				const sourceSceneFlags = await tx
					.select()
					.from(sceneFlags)
					.where(inArray(sceneFlags.sceneId, sourceSceneIds));

				for (const sceneFlag of sourceSceneFlags) {
					const newSceneId = sceneIdMapping[sceneFlag.sceneId];
					if (newSceneId) {
						await tx.insert(sceneFlags).values({
							sceneId: newSceneId,
							flag: sceneFlag.flag,
						});
					}
				}
			}

			// Clone scene column settings
			const allSourceScenesColumns = await tx
				.select({
					sceneId: scenesColumns.sceneId,
					columnId: scenesColumns.columnId,
					state: scenesColumns.state,
				})
				.from(scenesColumns)
				.innerJoin(scenes, eq(scenes.id, scenesColumns.sceneId))
				.where(eq(scenes.boardId, sourceId));

			for (const sceneColumn of allSourceScenesColumns) {
				const newSceneId = sceneIdMapping[sceneColumn.sceneId];
				const newColumnId = columnIdMapping[sceneColumn.columnId];

				if (newSceneId && newColumnId) {
					await tx.insert(scenesColumns).values({
						sceneId: newSceneId,
						columnId: newColumnId,
						state: sceneColumn.state,
					});
				}
			}

			// Set current scene to first scene
			if (firstSceneId) {
				await tx
					.update(boards)
					.set({ currentSceneId: firstSceneId })
					.where(eq(boards.id, newBoardId));
			}

			// Clone scene scorecards
			if (Object.keys(sceneIdMapping).length > 0) {
				const sourceSceneIds = Object.keys(sceneIdMapping);
				const sourceScorecards = await tx
					.select()
					.from(sceneScorecards)
					.where(inArray(sceneScorecards.sceneId, sourceSceneIds));

				for (const scorecard of sourceScorecards) {
					const newSceneId = sceneIdMapping[scorecard.sceneId];
					if (newSceneId) {
						await tx.insert(sceneScorecards).values({
							id: uuidv4(),
							sceneId: newSceneId,
							scorecardId: scorecard.scorecardId,
							collectedData: null,
							processedAt: null,
							createdAt: now,
						});
					}
				}
			}

			// Clone health questions (preserving thread_id for historical comparison)
			if (Object.keys(sceneIdMapping).length > 0) {
				const sourceSceneIds = Object.keys(sceneIdMapping);
				const sourceHealthQuestions = await tx
					.select()
					.from(healthQuestions)
					.where(inArray(healthQuestions.sceneId, sourceSceneIds));

				for (const question of sourceHealthQuestions) {
					const newSceneId = sceneIdMapping[question.sceneId];
					if (newSceneId) {
						await tx.insert(healthQuestions).values({
							id: uuidv4(),
							threadId: question.threadId, // Preserve thread_id for historical comparison
							sceneId: newSceneId,
							question: question.question,
							description: question.description,
							questionType: question.questionType,
							seq: question.seq,
							createdAt: now,
						});
					}
				}
			}

			// Clone incomplete agreements (both free-form and comment-based)
			const incompleteFreeFormAgreements =
				await findIncompleteAgreementsByBoardId(sourceId);
			const incompleteCommentAgreements =
				await findIncompleteCommentAgreementsByBoardId(sourceId);

			// Clone free-form agreements
			for (const agreement of incompleteFreeFormAgreements) {
				await tx.insert(agreements).values({
					id: uuidv4(),
					boardId: newBoardId,
					userId: agreement.userId,
					content: agreement.content,
					completed: false,
					completedByUserId: null,
					completedAt: null,
					sourceAgreementId: agreement.id,
					createdAt: agreement.createdAt,
					updatedAt: now,
				});
			}

			// Clone comment-based agreements
			for (const commentAgreement of incompleteCommentAgreements) {
				await tx.insert(agreements).values({
					id: uuidv4(),
					boardId: newBoardId,
					userId: commentAgreement.userId,
					content: commentAgreement.content,
					completed: false,
					completedByUserId: null,
					completedAt: null,
					sourceAgreementId: null,
					createdAt: commentAgreement.createdAt,
					updatedAt: now,
				});
			}
		});

		return json({
			success: true,
			board: {
				id: newBoardId,
				name: boardName,
				seriesId: sourceBoard.seriesId,
				status: "draft",
				createdAt: now,
			},
		});
	} catch (error) {
		return handleApiError(error, "Failed to clone board");
	}
};
