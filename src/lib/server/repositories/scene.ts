import { db } from '../db/index.js';
import { withTransaction } from '../db/transaction.js';
import { scenes, boards } from '../db/schema.js';
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
  showVotes?: boolean;
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
      showVotes: data.showVotes ?? true,
      multipleVotesPerCard: data.multipleVotesPerCard ?? true
    })
    .returning();

  return scene;
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
      allowAddCards: scenes.allowAddCards,
      allowEditCards: scenes.allowEditCards,
      allowObscureCards: scenes.allowObscureCards,
      allowMoveCards: scenes.allowMoveCards,
      allowGroupCards: scenes.allowGroupCards,
      showVotes: scenes.showVotes,
      allowVoting: scenes.allowVoting,
      showComments: scenes.showComments,
      allowComments: scenes.allowComments,
      multipleVotesPerCard: scenes.multipleVotesPerCard,
      createdAt: scenes.createdAt,
      seriesId: boards.seriesId
    })
    .from(scenes)
    .innerJoin(boards, eq(scenes.boardId, boards.id))
    .where(eq(scenes.id, sceneId))
    .limit(1);

  return result;
}

export async function updateScenePermissions(
  sceneId: string,
  permissions: {
    allowAddCards?: boolean;
    allowEditCards?: boolean;
    allowComments?: boolean;
    allowVoting?: boolean;
    showVotes?: boolean;
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
    showVotes?: boolean;
    multipleVotesPerCard?: boolean;
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
  return await withTransaction(async (tx) => {
    for (const { id, seq } of sceneOrders) {
      await tx
        .update(scenes)
        .set({ seq })
        .where(eq(scenes.id, id));
    }
    return { success: true };
  });
}
