import { db } from '../db/index.js';
import { withTransaction } from '../db/transaction.js';
import { sseManager } from '$lib/server/sse/manager';
import { broadcastToBoardUsers } from '$lib/server/sse/broadcast';

import { boards, columns, scenes, cards, scenesColumns, boardSeries } from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getSceneFlags } from './scene.js';

// In-memory store for timer votes
const timerVotes = new Map<string, { A: Set<string>; B: Set<string> }>();

// In-memory store for poll configurations (supports different poll types)
interface PollConfig {
  pollType: 'timer' | 'roman' | 'fist-of-five' | 'multiple-choice';
  question?: string;
  choices?: string[];
}
const pollConfigs = new Map<string, PollConfig>();

// In-memory store for poll votes (for non-timer polls)
const pollVotes = new Map<string, Map<string, string>>();

export function setPollConfig(boardId: string, config: PollConfig) {
  pollConfigs.set(boardId, config);
}

export function getPollConfig(boardId: string): PollConfig | null {
  return pollConfigs.get(boardId) || null;
}

export function clearPollConfig(boardId: string) {
  pollConfigs.delete(boardId);
  pollVotes.delete(boardId);
}

export function recordPollVote(boardId: string, userId: string, choice: string) {
  if (!pollVotes.has(boardId)) {
    pollVotes.set(boardId, new Map());
  }
  const votes = pollVotes.get(boardId)!;
  votes.set(userId, choice);
}

export function getPollVotes(boardId: string): Record<string, number> {
  const votes = pollVotes.get(boardId);
  if (!votes) return {};

  const counts: Record<string, number> = {};
  for (const [_, choice] of votes) {
    counts[choice] = (counts[choice] || 0) + 1;
  }
  return counts;
}

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

  // Use transaction wrapper - works with both PostgreSQL and SQLite
  return await withTransaction(async (tx) => {
    await tx.insert(boards).values(board);
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
      cloneOf: boards.cloneOf,
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

  // Fetch clone source info if this board is a clone
  let cloneSource = null;
  if (board.cloneOf) {
    const [sourceBoard] = await db
      .select({
        name: boards.name,
        meetingDate: boards.meetingDate,
        createdAt: boards.createdAt
      })
      .from(boards)
      .where(eq(boards.id, board.cloneOf))
      .limit(1);

    if (sourceBoard) {
      cloneSource = sourceBoard;
    }
  }

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

  // Fetch flags for all scenes
  const scenesWithFlags = await Promise.all(
    boardScenes.map(async (scene) => {
      const flags = await getSceneFlags(scene.id);
      return {
        ...scene,
        flags
      };
    })
  );

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
    .from(cards)
    .innerJoin(columns, eq(cards.columnId, columns.id))
    .where(eq(columns.boardId, boardId));

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
    scenes: scenesWithFlags,
    cards: boardCards,
    hiddenColumnsByScene,
    cloneSource
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

export async function startBoardTimer(
  boardId: string,
  duration: number,
  pollType: 'timer' | 'roman' | 'fist-of-five' | 'multiple-choice' = 'timer',
  question?: string,
  choices?: string[]
) {
  const now = new Date().toISOString();

  // Store poll configuration in memory
  setPollConfig(boardId, { pollType, question, choices });

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
  // Clear poll configuration and votes
  clearPollConfig(boardId);

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

  // Get poll configuration
  const pollConfig = getPollConfig(boardId);

  return {
    timer_start: board.timerStart,
    timer_passed: elapsed,
    timer_remaining: remaining,
    active: !!board.timerStart, //remaining > 0
    poll_type: pollConfig?.pollType || 'timer',
    question: pollConfig?.question,
    choices: pollConfig?.choices
  };
}

export async function broadcastTimerUpdate(boardId: string) {
  const timerData = await getBoardTimer(boardId);
  let voteData = null;
  let totalUsers = 0;

  if (timerData && timerData.timer_start) {
    const pollConfig = getPollConfig(boardId);

    // For timer mode, use the old A/B vote system
    // For other poll types, use the new poll vote system
    if (pollConfig?.pollType === 'timer') {
      voteData = getTimerVotes(timerData.timer_start);
    } else {
      voteData = getPollVotes(boardId);
    }

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
  return await withTransaction(async (tx) => {
    for (const { id, seq } of columnOrders) {
      await tx
        .update(columns)
        .set({ seq })
        .where(eq(columns.id, id));
    }
    return { success: true };
  });
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
  // Just delete the board, the db is set up to cascade deletes
  await db.delete(boards).where(eq(boards.id, boardId));
}

export async function getColumnsBySeriesId(seriesId: string, excludeBoardId?: string) {
  const conditions = [eq(boards.seriesId, seriesId)];

  if (excludeBoardId) {
    conditions.push(sql`${boards.id} != ${excludeBoardId}`);
  }

  const result = await db
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
    .innerJoin(boards, eq(columns.boardId, boards.id))
    .where(and(...conditions))
    .orderBy(columns.title, columns.seq);

  return result;
}
