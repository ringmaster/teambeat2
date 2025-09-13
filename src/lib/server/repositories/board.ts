import { db } from '../db/index.js';
import { boards, columns, scenes, cards, votes, comments, scenesColumns, boardSeries } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export interface CreateBoardData {
  name: string;
  seriesId: string;
  meetingDate?: string;
  blameFreeMode?: boolean;
  votingAllocation?: number;
}

export async function createBoard(data: CreateBoardData) {
  const id = uuidv4();

  return db.transaction((tx) => {
    const board = {
      id,
      seriesId: data.seriesId,
      name: data.name,
      meetingDate: data.meetingDate,
      blameFreeMode: data.blameFreeMode || false,
      votingAllocation: data.votingAllocation || 3,
      status: 'draft' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    tx
      .insert(boards)
      .values(board)
      .run();

    // Board is created empty - scenes and columns will be configured by user

    return board;
  });
}

export async function findBoardById(boardId: string) {
  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);

  return board;
}

export async function findBoardByColumnId(columnId: string) {
  const [result] = await db
    .select({
      boardId: columns.boardId
    })
    .from(columns)
    .where(eq(columns.id, columnId))
    .limit(1);

  return result?.boardId || null;
}

export async function findBoardsByUser(userId: string) {
  const userBoards = await db
    .select({
      id: boards.id,
      name: boards.name,
      status: boards.status,
      meetingDate: boards.meetingDate,
      createdAt: boards.createdAt,
      seriesId: boards.seriesId
    })
    .from(boards)
    .where(eq(boards.seriesId, userId))  // This will be fixed in the actual query logic
    .orderBy(desc(boards.createdAt))
    .limit(20);

  return userBoards;
}

export async function getBoardWithDetails(boardId: string) {
  const [boardResult] = await db
    .select({
      id: boards.id,
      seriesId: boards.seriesId,
      name: boards.name,
      status: boards.status,
      currentSceneId: boards.currentSceneId,
      blameFreeMode: boards.blameFreeMode,
      votingAllocation: boards.votingAllocation,
      votingEnabled: boards.votingEnabled,
      meetingDate: boards.meetingDate,
      createdAt: boards.createdAt,
      updatedAt: boards.updatedAt,
      series: boardSeries.name
    })
    .from(boards)
    .leftJoin(boardSeries, eq(boards.seriesId, boardSeries.id))
    .where(eq(boards.id, boardId))
    .limit(1);

  if (!boardResult) return null;
  const board = boardResult;

  const boardColumns = await db
    .select({
      id: columns.id,
      boardId: columns.boardId,
      title: columns.title,
      description: columns.description,
      seq: columns.seq,
      defaultAppearance: columns.defaultAppearance,
      createdAt: columns.createdAt
    })
    .from(columns)
    .where(eq(columns.boardId, boardId))
    .orderBy(columns.seq);

  const boardScenes = await db
    .select()
    .from(scenes)
    .where(eq(scenes.boardId, boardId))
    .orderBy(scenes.seq);

  const boardCards = await db
    .select({
      id: cards.id,
      columnId: cards.columnId,
      userId: cards.userId,
      content: cards.content,
      groupId: cards.groupId,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt
    })
    .from(cards);

  // Get hidden columns for all scenes
  const hiddenColumnsByScene: Record<string, string[]> = {};
  if (boardScenes.length > 0) {
    const hiddenColumns = await db
      .select({
        sceneId: scenesColumns.sceneId,
        columnId: scenesColumns.columnId
      })
      .from(scenesColumns)
      .where(and(
        eq(scenesColumns.state, 'hidden')
      ));

    // Group by scene
    for (const row of hiddenColumns) {
      if (!hiddenColumnsByScene[row.sceneId]) {
        hiddenColumnsByScene[row.sceneId] = [];
      }
      hiddenColumnsByScene[row.sceneId].push(row.columnId);
    }
  }

  // Filter columns based on current scene
  let visibleColumns = boardColumns;
  if (board.currentSceneId && hiddenColumnsByScene[board.currentSceneId]) {
    const hiddenIds = hiddenColumnsByScene[board.currentSceneId];
    visibleColumns = boardColumns.filter(col => !hiddenIds.includes(col.id));
  }

  return {
    ...board,
    columns: visibleColumns,
    allColumns: boardColumns, // Keep all columns for configuration
    scenes: boardScenes,
    cards: boardCards,
    hiddenColumnsByScene
  };
}

export async function updateBoardScene(boardId: string, sceneId: string) {
  await db
    .update(boards)
    .set({
      currentSceneId: sceneId,
      updatedAt: new Date().toISOString()
    })
    .where(eq(boards.id, boardId));
}

export async function updateBoardStatus(boardId: string, status: 'draft' | 'active' | 'completed' | 'archived') {
  await db
    .update(boards)
    .set({
      status,
      updatedAt: new Date().toISOString()
    })
    .where(eq(boards.id, boardId));
}

export interface UpdateBoardSettingsData {
  name?: string;
  blameFreeMode?: boolean;
  votingAllocation?: number;
  votingEnabled?: boolean;
  createdAt?: string;
}

export async function updateBoardSettings(boardId: string, data: UpdateBoardSettingsData) {
  const updateData = {
    ...data,
    updatedAt: new Date().toISOString()
  };

  await db
    .update(boards)
    .set(updateData)
    .where(eq(boards.id, boardId));
}

export async function reorderColumns(boardId: string, columnOrders: { id: string; seq: number }[]) {
  db.transaction((tx) => {
    for (const { id, seq } of columnOrders) {
      tx
        .update(columns)
        .set({ seq })
        .where(eq(columns.id, id))
        .run();
    }
  });
  return { success: true };
}

export async function updateColumn(
  columnId: string,
  data: {
    title?: string;
    description?: string | null;
    defaultAppearance?: string;
  }
) {
  const [column] = await db
    .update(columns)
    .set(data)
    .where(eq(columns.id, columnId))
    .returning();

  return column;
}

export async function deleteColumn(columnId: string) {
  await db
    .delete(columns)
    .where(eq(columns.id, columnId));

  return { success: true };
}

export async function deleteBoard(boardId: string) {
  return db.transaction((tx) => {
    // Just delete the board, the db is set up to cascade deletes
    tx.delete(boards).where(eq(boards.id, boardId)).run();
  });
}
