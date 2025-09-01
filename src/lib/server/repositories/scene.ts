import { db } from '../db/index.js';
import { scenes } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export interface CreateSceneData {
	boardId: string;
	title: string;
	description?: string;
	mode: 'columns' | 'present' | 'review';
	seq: number;
	allowAddCards?: boolean;
	allowEditCards?: boolean;
	allowComments?: boolean;
	allowVoting?: boolean;
	multipleVotesPerCard?: boolean;
}

export async function createScene(data: CreateSceneData) {
	const id = uuidv4();
	
	const [scene] = await db
		.insert(scenes)
		.values({
			id,
			...data,
			allowAddCards: data.allowAddCards ?? true,
			allowEditCards: data.allowEditCards ?? true,
			allowComments: data.allowComments ?? true,
			allowVoting: data.allowVoting ?? false,
			multipleVotesPerCard: data.multipleVotesPerCard ?? false
		})
		.returning();
	
	return scene;
}

export async function findSceneById(sceneId: string) {
	const [scene] = await db
		.select()
		.from(scenes)
		.where(eq(scenes.id, sceneId))
		.limit(1);
	
	return scene;
}

export async function updateScenePermissions(
	sceneId: string,
	permissions: {
		allowAddCards?: boolean;
		allowEditCards?: boolean;
		allowComments?: boolean;
		allowVoting?: boolean;
		multipleVotesPerCard?: boolean;
	}
) {
	const [scene] = await db
		.update(scenes)
		.set(permissions)
		.where(eq(scenes.id, sceneId))
		.returning();
	
	return scene;
}

export async function updateScene(
	sceneId: string,
	data: {
		title?: string;
		mode?: 'columns' | 'present' | 'review';
		allowAddCards?: boolean;
		allowEditCards?: boolean;
		allowComments?: boolean;
		allowVoting?: boolean;
	}
) {
	const [scene] = await db
		.update(scenes)
		.set(data)
		.where(eq(scenes.id, sceneId))
		.returning();
	
	return scene;
}

export async function getScenesByBoard(boardId: string) {
	const boardScenes = await db
		.select()
		.from(scenes)
		.where(eq(scenes.boardId, boardId))
		.orderBy(scenes.seq);
	
	return boardScenes;
}

export async function deleteScene(sceneId: string) {
	await db
		.delete(scenes)
		.where(eq(scenes.id, sceneId));
}

export async function reorderScenes(boardId: string, sceneOrders: { id: string; seq: number }[]) {
	db.transaction((tx) => {
		for (const { id, seq } of sceneOrders) {
			tx
				.update(scenes)
				.set({ seq })
				.where(eq(scenes.id, id))
				.run();
		}
	});
	return { success: true };
}