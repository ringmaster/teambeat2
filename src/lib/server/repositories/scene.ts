import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import type { SceneFlag } from "../db/scene-flags.js";
import { boards, sceneFlags, scenes } from "../db/schema.js";
import { withTransaction } from "../db/transaction.js";

export interface CreateSceneData {
	boardId: string;
	title: string;
	description?: string;
	mode:
		| "columns"
		| "present"
		| "review"
		| "agreements"
		| "scorecard"
		| "static"
		| "survey"
		| "quadrant";
	seq: number;
	flags?: SceneFlag[];
}

export async function createScene(data: CreateSceneData) {
	const id = uuidv4();

	const [scene] = await db
		.insert(scenes)
		.values({
			id,
			boardId: data.boardId,
			title: data.title,
			description: data.description,
			mode: data.mode,
			seq: data.seq,
		})
		.returning();

	// Set flags if provided
	if (data.flags && data.flags.length > 0) {
		await setSceneFlags(id, data.flags);
	}

	// Return scene with flags
	const flags = await getSceneFlags(id);
	return {
		...scene,
		flags,
	};
}

export async function findSceneById(sceneId: string) {
	const [result] = await db
		.select({
			id: scenes.id,
			boardId: scenes.boardId,
			title: scenes.title,
			description: scenes.description,
			mode: scenes.mode,
			seq: scenes.seq,
			selectedCardId: scenes.selectedCardId,
			createdAt: scenes.createdAt,
			seriesId: boards.seriesId,
			displayRule: scenes.displayRule,
			displayMode: scenes.displayMode,
			focusedQuestionId: scenes.focusedQuestionId,
			quadrantConfig: scenes.quadrantConfig,
			presentModeFilter: scenes.presentModeFilter,
			quadrantPhase: scenes.quadrantPhase,
			continuationEnabled: scenes.continuationEnabled,
			continuationSceneId: scenes.continuationSceneId,
		})
		.from(scenes)
		.innerJoin(boards, eq(scenes.boardId, boards.id))
		.where(eq(scenes.id, sceneId))
		.limit(1);

	if (!result) {
		return undefined;
	}

	const flags = await getSceneFlags(sceneId);

	return {
		...result,
		flags,
	};
}

export async function updateScene(
	sceneId: string,
	data: {
		title?: string;
		description?: string;
		mode?:
			| "columns"
			| "present"
			| "review"
			| "agreements"
			| "scorecard"
			| "static"
			| "survey"
			| "quadrant";
		displayRule?: string | null;
		displayMode?: "collecting" | "results";
		focusedQuestionId?: string | null;
		quadrantConfig?: string | null;
		presentModeFilter?: string | null;
		quadrantPhase?: "input" | "results" | null;
		continuationEnabled?: boolean;
		continuationSceneId?: string | null;
	},
) {
	const [scene] = await db
		.update(scenes)
		.set(data)
		.where(eq(scenes.id, sceneId))
		.returning();

	const flags = await getSceneFlags(sceneId);
	return {
		...scene,
		flags,
	};
}

export async function getScenesByBoard(boardId: string) {
	const boardScenes = await db
		.select()
		.from(scenes)
		.where(eq(scenes.boardId, boardId))
		.orderBy(scenes.seq);

	// Fetch flags for all scenes
	const scenesWithFlags = await Promise.all(
		boardScenes.map(async (scene) => {
			const flags = await getSceneFlags(scene.id);
			return {
				...scene,
				flags,
			};
		}),
	);

	return scenesWithFlags;
}

export async function deleteScene(sceneId: string) {
	await db.delete(scenes).where(eq(scenes.id, sceneId));
}

export async function reorderScenes(
	boardId: string,
	sceneOrders: { id: string; seq: number }[],
) {
	return await withTransaction(async (tx) => {
		for (const { id, seq } of sceneOrders) {
			await tx.update(scenes).set({ seq }).where(eq(scenes.id, id));
		}
		return { success: true };
	});
}

// Scene flags methods
export async function getSceneFlags(sceneId: string): Promise<SceneFlag[]> {
	const flags = await db
		.select({ flag: sceneFlags.flag })
		.from(sceneFlags)
		.where(eq(sceneFlags.sceneId, sceneId));

	return flags.map((f) => f.flag as SceneFlag);
}

export async function setSceneFlags(
	sceneId: string,
	flags: SceneFlag[],
): Promise<void> {
	await withTransaction(async (tx) => {
		// Clear existing flags
		await tx.delete(sceneFlags).where(eq(sceneFlags.sceneId, sceneId));

		// Insert new flags
		if (flags.length > 0) {
			await tx
				.insert(sceneFlags)
				.values(flags.map((flag) => ({ sceneId, flag })));
		}
	});
}

export async function hasSceneFlag(
	sceneId: string,
	flag: SceneFlag,
): Promise<boolean> {
	const result = await db
		.select()
		.from(sceneFlags)
		.where(and(eq(sceneFlags.sceneId, sceneId), eq(sceneFlags.flag, flag)))
		.limit(1);

	return result.length > 0;
}
