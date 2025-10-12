import {
  findAgreementsByBoardId,
  findCommentAgreementsByColumns
} from '../repositories/agreement.js';
import { db } from '../db/index.js';
import { users, scenesColumns, columns, comments } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { getUserDisplayName } from '$lib/utils/animalNames.js';

export interface UnifiedAgreement {
  id: string;
  source: 'agreement' | 'comment';
  userId: string | null;
  userName: string | null;
  displayName: string | null;
  content: string;
  completed: boolean;
  completedByUserId: string | null;
  completedByUserName: string | null;
  completedByDisplayName: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reactions?: Record<string, number>;
  // Agreement-specific fields
  boardId?: string;
  sourceAgreementId?: string | null;
  // Comment-specific fields
  cardId?: string;
  cardContent?: string;
  columnId?: string;
  columnTitle?: string;
}

/**
 * Get user name by ID
 */
async function getUserName(userId: string | null): Promise<string | null> {
  if (!userId) return null;

  const [user] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user?.name || null;
}

/**
 * Get user names for multiple user IDs efficiently
 */
async function getUserNames(userIds: (string | null)[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds.filter(id => id !== null))] as string[];

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const userRecords = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, uniqueIds[0])); // Drizzle doesn't have IN for multiple values easily

  const nameMap = new Map<string, string>();
  userRecords.forEach(user => {
    if (user.name) {
      nameMap.set(user.id, user.name);
    }
  });

  return nameMap;
}

/**
 * Get reactions for a set of card IDs (for comment-based agreements)
 */
async function getReactionsForCards(cardIds: string[]): Promise<Map<string, Record<string, number>>> {
  if (cardIds.length === 0) return new Map();

  const reactionCounts = await db
    .select({
      cardId: comments.cardId,
      emoji: comments.content,
      count: sql<number>`COUNT(*)`.as('count')
    })
    .from(comments)
    .where(and(
      sql`${comments.cardId} IN (${sql.join(cardIds.map(id => sql`${id}`), sql`, `)})`,
      eq(comments.isReaction, true)
    ))
    .groupBy(comments.cardId, comments.content);

  const reactionsMap = new Map<string, Record<string, number>>();

  reactionCounts.forEach(({ cardId, emoji, count }) => {
    if (!reactionsMap.has(cardId)) {
      reactionsMap.set(cardId, {});
    }
    reactionsMap.get(cardId)![emoji] = count;
  });

  return reactionsMap;
}

/**
 * Enriches all agreements with user information and reactions
 */
async function enrichAgreements(
  agreements: any[],
  boardId: string,
  blameFreeMode: boolean,
  source: 'agreement' | 'comment'
): Promise<UnifiedAgreement[]> {
  if (agreements.length === 0) return [];

  // Collect all user IDs
  const userIds: (string | null)[] = [];
  agreements.forEach(a => {
    userIds.push(a.userId);
    userIds.push(a.completedByUserId);
  });

  // Fetch user names in batch
  const uniqueIds = [...new Set(userIds.filter(id => id !== null))] as string[];
  const userNameMap = new Map<string, string>();

  for (const userId of uniqueIds) {
    const name = await getUserName(userId);
    if (name) {
      userNameMap.set(userId, name);
    }
  }

  // For comment-based agreements, fetch reactions
  let reactionsMap = new Map<string, Record<string, number>>();
  if (source === 'comment') {
    const cardIds = agreements.map(a => a.cardId).filter(Boolean);
    reactionsMap = await getReactionsForCards(cardIds);
  }

  // Enrich agreements
  return agreements.map(agreement => {
    const userName = agreement.userId ? userNameMap.get(agreement.userId) || null : null;
    const completedByUserName = agreement.completedByUserId
      ? userNameMap.get(agreement.completedByUserId) || null
      : null;

    return {
      ...agreement,
      source,
      userName,
      displayName: userName ? getUserDisplayName(userName, boardId, blameFreeMode) : null,
      completedByUserName,
      completedByDisplayName: completedByUserName
        ? getUserDisplayName(completedByUserName, boardId, blameFreeMode)
        : null,
      reactions: source === 'comment' && agreement.cardId
        ? reactionsMap.get(agreement.cardId) || {}
        : undefined
    };
  });
}

/**
 * Builds complete enriched agreements data for a board
 * This function is used by both API endpoints and SSE broadcasts (DRY principle)
 *
 * @param boardId - The board ID
 * @param board - The board with details (must include currentSceneId and blameFreeMode)
 * @returns Unified array of agreements sorted chronologically
 */
export async function buildEnrichedAgreementsData(
  boardId: string,
  board: any
): Promise<UnifiedAgreement[]> {
  // Get free-form agreements
  const freeFormAgreements = await findAgreementsByBoardId(boardId);

  // Get visible columns for current scene
  // Columns are visible by default unless explicitly hidden
  let visibleColumnIds: string[] = [];
  if (board.currentSceneId) {
    // Get all columns for the board
    const allColumns = await db
      .select({ id: columns.id })
      .from(columns)
      .where(eq(columns.boardId, boardId));

    // Get columns that are explicitly hidden in this scene
    const hiddenColumnSettings = await db
      .select({ columnId: scenesColumns.columnId })
      .from(scenesColumns)
      .where(
        and(
          eq(scenesColumns.sceneId, board.currentSceneId),
          eq(scenesColumns.state, 'hidden')
        )
      );

    const hiddenColumnIds = hiddenColumnSettings.map(s => s.columnId);
    visibleColumnIds = allColumns
      .map(c => c.id)
      .filter(id => !hiddenColumnIds.includes(id));
  }

  // Get comment-based agreements for visible columns
  const commentAgreements = visibleColumnIds.length > 0
    ? await findCommentAgreementsByColumns(visibleColumnIds)
    : [];

  // Enrich both types with user information
  const enrichedFreeForm = await enrichAgreements(
    freeFormAgreements,
    boardId,
    board.blameFreeMode,
    'agreement'
  );

  const enrichedComments = await enrichAgreements(
    commentAgreements,
    boardId,
    board.blameFreeMode,
    'comment'
  );

  // Combine and sort chronologically
  const allAgreements = [...enrichedFreeForm, ...enrichedComments];
  allAgreements.sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return allAgreements;
}
