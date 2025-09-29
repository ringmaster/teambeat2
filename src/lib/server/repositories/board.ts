import { db } from '../db/index.js';
import { sseManager } from '$lib/server/sse/manager';
import { broadcastToBoardUsers } from '$lib/server/sse/broadcast';

import { boards, columns, scenes, cards, scenesColumns, boardSeries } from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// In-memory store for timer votes
const timerVotes = new Map<string, { A: Set<string>; B: Set<string> }>();

export function recordTimerVote(timerId: string, userId: string, choice: 'A' | 'B') {
  if (!timerVotes.has(timerId)) {
    timerVotes.set(timerId, { A: new Set(), B: new Set() });
  }
  const votes = timerVotes.get(timerId)!;

  if (choice === 'A') {
    votes.B.delete(userId);
    votes.A.add(userId);
  } else {
    votes.A.delete(userId);
    votes.B.add(userId);
  }
  timerVotes.set(timerId, votes);
}

export function getTimerVotes(timerId: string) {
  if (!timerVotes.has(timerId)) {
    return { A: 0, B: 0 };
  }
  const votes = timerVotes.get(timerId)!;
  return {
    A: votes.A.size,
    B: votes.B.size,
  };
}

export function clearTimerVotes(timerId: string) {
  timerVotes.delete(timerId);
}


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
      votingAllocation: data.votingAllocation,
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
      timerStart: boards.timerStart,
      timerDuration: boards.timerDuration,
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

export async function startBoardTimer(boardId: string, duration: number) {
  const now = new Date().toISOString();
  const [result] = await db
    .update(boards)
    .set({
      timerStart: now,
      timerDuration: duration,
      updatedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(eq(boards.id, boardId))
    .returning();

  return result;
}

export async function updateBoardTimer(boardId: string, addSeconds: number) {
  // First get the current timer state
  const [board] = await db
    .select({
      timerStart: boards.timerStart,
      timerDuration: boards.timerDuration
    })
    .from(boards)
    .where(eq(boards.id, boardId));

  const updateData: any = {
    updatedAt: sql`CURRENT_TIMESTAMP`
  };

  if (!board || !board.timerStart || !board.timerDuration) {
    // No timer exists - create new one
    updateData.timerStart = new Date().toISOString();
    updateData.timerDuration = addSeconds;
  } else {
    // Check if timer is expired
    const start = new Date(board.timerStart).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - start) / 1000);
    const remaining = board.timerDuration - elapsed;

    if (remaining <= 0) {
      // Timer has expired - restart with new duration
      updateData.timerStart = new Date().toISOString();
      updateData.timerDuration = addSeconds;
    } else {
      // Timer is still active - just add to duration, keep start time
      updateData.timerDuration = board.timerDuration + addSeconds;
    }
  }

  const [result] = await db
    .update(boards)
    .set(updateData)
    .where(eq(boards.id, boardId))
    .returning();

  return result;
}

export async function stopBoardTimer(boardId: string) {
  const [result] = await db
    .update(boards)
    .set({
      timerStart: null,
      timerDuration: null,
      updatedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(eq(boards.id, boardId))
    .returning();

  return result;
}

export async function getBoardTimer(boardId: string) {
  const [board] = await db
    .select({
      timerStart: boards.timerStart,
      timerDuration: boards.timerDuration
    })
    .from(boards)
    .where(eq(boards.id, boardId));

  if (!board || !board.timerStart || !board.timerDuration) {
    return null;
  }

  const start = new Date(board.timerStart).getTime();
  const now = Date.now();
  const elapsed = Math.floor((now - start) / 1000);
  const remaining = Math.max(0, board.timerDuration - elapsed);

  return {
    timer_start: board.timerStart,
    timer_passed: elapsed,
    timer_remaining: remaining,
    active: !!board.timerStart //remaining > 0
  };
}

export async function broadcastTimerUpdate(boardId: string) {
  const timerData = await getBoardTimer(boardId);
  let voteData = null;
  let totalUsers = 0;

  if (timerData && timerData.timer_start) {
    voteData = getTimerVotes(timerData.timer_start);
    totalUsers = sseManager.getConnectedUsers(boardId).length;
  }

  const message = {
    type: 'timer_update',
    board_id: boardId,
    data: {
      ...(timerData || { active: false }),
      votes: voteData,
      totalUsers: totalUsers
    }
  };

  broadcastToBoardUsers(boardId, message);

  return message;
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
