import { db } from '../db/index.js';
import { votes, cards, columns, users, boards, boardSeries, seriesMembers, scenes } from '../db/schema.js';
import { eq, and, count, desc, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getBoardPresence } from './presence.js';
import { getSceneFlags } from './scene.js';

/**
 * Get all data needed for vote validation and response in a single optimized query.
 * Returns card, board, series access, current vote count, and scene info.
 */
export async function getVoteContext(cardId: string, userId: string) {
  // Main query with card, board, and series member info
  const result = await db
    .select({
      // Card info
      cardId: cards.id,
      cardGroupId: cards.groupId,
      cardIsGroupLead: cards.isGroupLead,
      cardColumnId: cards.columnId,
      cardContent: cards.content,
      cardNotes: cards.notes,
      cardUserId: cards.userId,
      cardCreatedAt: cards.createdAt,
      cardUpdatedAt: cards.updatedAt,
      // Column info
      columnId: columns.id,
      // Board info
      boardId: boards.id,
      boardSeriesId: boards.seriesId,
      boardCurrentSceneId: boards.currentSceneId,
      boardVotingAllocation: boards.votingAllocation,
      boardStatus: boards.status,
      // Series member info (null if user not a member)
      memberRole: seriesMembers.role
    })
    .from(cards)
    .innerJoin(columns, eq(columns.id, cards.columnId))
    .innerJoin(boards, eq(boards.id, columns.boardId))
    .leftJoin(seriesMembers, and(
      eq(seriesMembers.seriesId, boards.seriesId),
      eq(seriesMembers.userId, userId)
    ))
    .where(eq(cards.id, cardId))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const data = result[0];

  // Get current scene with flags if it exists
  let currentScene = null;
  if (data.boardCurrentSceneId) {
    const [sceneResult] = await db
      .select({
        id: scenes.id,
        boardId: scenes.boardId,
        title: scenes.title,
        description: scenes.description,
        mode: scenes.mode,
        seq: scenes.seq,
        selectedCardId: scenes.selectedCardId,
        displayRule: scenes.displayRule,
        displayMode: scenes.displayMode,
        focusedQuestionId: scenes.focusedQuestionId,
        createdAt: scenes.createdAt
      })
      .from(scenes)
      .where(eq(scenes.id, data.boardCurrentSceneId))
      .limit(1);

    if (sceneResult) {
      const flags = await getSceneFlags(sceneResult.id);
      currentScene = { ...sceneResult, flags };
    }
  }

  // Get user's vote count for this board
  const [voteCountResult] = await db
    .select({ count: count() })
    .from(votes)
    .innerJoin(cards, eq(cards.id, votes.cardId))
    .innerJoin(columns, eq(columns.id, cards.columnId))
    .where(
      and(
        eq(votes.userId, userId),
        eq(columns.boardId, data.boardId)
      )
    );

  return {
    card: {
      id: data.cardId,
      columnId: data.cardColumnId,
      groupId: data.cardGroupId,
      isGroupLead: data.cardIsGroupLead,
      content: data.cardContent,
      notes: data.cardNotes,
      userId: data.cardUserId,
      createdAt: data.cardCreatedAt,
      updatedAt: data.cardUpdatedAt
    },
    board: {
      id: data.boardId,
      seriesId: data.boardSeriesId,
      currentSceneId: data.boardCurrentSceneId,
      votingAllocation: data.boardVotingAllocation,
      status: data.boardStatus,
      currentScene
    },
    userRole: data.memberRole,
    currentVoteCount: voteCountResult.count
  };
}

export async function castVote(cardId: string, userId: string, delta: 1 | -1) {
  if (delta === 1) {
    // Add a vote
    const voteId = uuidv4();
    await db
      .insert(votes)
      .values({
        id: voteId,
        cardId,
        userId
      });

    return { action: 'added', voteId };
  } else if (delta === -1) {
    // Remove one vote (most recent)
    const [existingVote] = await db
      .select()
      .from(votes)
      .where(
        and(
          eq(votes.cardId, cardId),
          eq(votes.userId, userId)
        )
      )
      .orderBy(desc(votes.createdAt))
      .limit(1);

    if (existingVote) {
      await db
        .delete(votes)
        .where(eq(votes.id, existingVote.id));

      return { action: 'removed', voteId: existingVote.id };
    } else {
      return { action: 'none', reason: 'No votes to remove' };
    }
  }

  throw new Error('Invalid delta value. Must be 1 or -1');
}

export async function getCardVotes(cardId: string) {
  const cardVotes = await db
    .select()
    .from(votes)
    .where(eq(votes.cardId, cardId));

  return cardVotes;
}

export async function getUserVotesForBoard(userId: string, boardId: string) {
  const userVotes = await db
    .select({
      voteId: votes.id,
      cardId: votes.cardId,
      createdAt: votes.createdAt
    })
    .from(votes)
    .innerJoin(cards, eq(cards.id, votes.cardId))
    .innerJoin(columns, eq(columns.id, cards.columnId))
    .where(
      and(
        eq(votes.userId, userId),
        eq(columns.boardId, boardId)
      )
    );

  return userVotes;
}

export async function getAllUsersVotesForBoard(boardId: string) {
  const allVotes = await db
    .select({
      voteId: votes.id,
      cardId: votes.cardId,
      userId: votes.userId,
      createdAt: votes.createdAt
    })
    .from(votes)
    .innerJoin(cards, eq(cards.id, votes.cardId))
    .innerJoin(columns, eq(columns.id, cards.columnId))
    .where(eq(columns.boardId, boardId));

  return allVotes;
}

export async function getUserVoteCount(userId: string, boardId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(votes)
    .innerJoin(cards, eq(cards.id, votes.cardId))
    .innerJoin(columns, eq(columns.id, cards.columnId))
    .where(
      and(
        eq(votes.userId, userId),
        eq(columns.boardId, boardId)
      )
    );

  return result.count;
}

export async function getBoardVotingStats(boardId: string, _seriesId: string) {
  // Get currently active/present users on this board
  const activeUsers = await getBoardPresence(boardId);

  if (activeUsers.length === 0) {
    return [];
  }

  const userIds = activeUsers.map(u => u.userId);

  // Batch query: Get all user details in one query
  const userDetailsMap = new Map(
    (await db
      .select({
        id: users.id,
        name: users.name
      })
      .from(users)
      .where(inArray(users.id, userIds)))
      .map(u => [u.id, u.name])
  );

  // Batch query: Get all vote counts in one query
  const voteCountsResult = await db
    .select({ 
      userId: votes.userId, 
      count: count() 
    })
    .from(votes)
    .innerJoin(cards, eq(cards.id, votes.cardId))
    .innerJoin(columns, eq(columns.id, cards.columnId))
    .where(and(
      inArray(votes.userId, userIds),
      eq(columns.boardId, boardId)
    ))
    .groupBy(votes.userId);

  const voteCountsMap = new Map(
    voteCountsResult.map(vc => [vc.userId, vc.count])
  );

  // Build voting stats from pre-fetched data
  const votingStats = activeUsers.map(activeUser => {
    const voteCount = voteCountsMap.get(activeUser.userId) || 0;
    const userName = userDetailsMap.get(activeUser.userId) || 'Unknown User';
    
    return {
      userId: activeUser.userId,
      username: userName,
      name: userName,
      voteCount,
      hasVoted: voteCount > 0
    };
  });

  return votingStats;
}

export async function checkVotingAllocation(userId: string, boardId: string, votingAllocation: number) {
  const currentVotes = await getUserVoteCount(userId, boardId);
  return {
    currentVotes,
    maxVotes: votingAllocation,
    remainingVotes: Math.max(0, votingAllocation - currentVotes),
    canVote: currentVotes < votingAllocation
  };
}

export async function getVoteCountsByCard(boardId: string): Promise<Record<string, number>> {
  const voteCounts = await db
    .select({
      cardId: votes.cardId,
      count: count()
    })
    .from(votes)
    .innerJoin(cards, eq(cards.id, votes.cardId))
    .innerJoin(columns, eq(columns.id, cards.columnId))
    .where(eq(columns.boardId, boardId))
    .groupBy(votes.cardId);

  const voteCountsByCard: Record<string, number> = {};
  voteCounts.forEach(vc => {
    voteCountsByCard[vc.cardId] = vc.count;
  });

  return voteCountsByCard;
}

export async function clearBoardVotes(boardId: string) {
  // Get all card IDs for this board first
  const boardCards = await db
    .select({ id: cards.id })
    .from(cards)
    .innerJoin(columns, eq(columns.id, cards.columnId))
    .where(eq(columns.boardId, boardId));

  if (boardCards.length === 0) {
    return { success: true, deletedCount: 0 };
  }

  const cardIds = boardCards.map(card => card.id);

  // Delete all votes for these cards using inArray
  const deleteResult = await db
    .delete(votes)
    .where(
      cardIds.length === 1
        ? eq(votes.cardId, cardIds[0])
        : inArray(votes.cardId, cardIds)
    );

  return { success: true, deletedCount: deleteResult.changes || 0 };
}

export async function calculateAggregateVotingStats(boardId: string, seriesId: string, votingAllocation: number, activeUserIds?: Set<string>) {
  const votingStats = await getBoardVotingStats(boardId, seriesId);

  // If activeUserIds not provided, fetch presence data
  let activeUsers = 0;
  if (activeUserIds) {
    activeUsers = votingStats.filter(u => activeUserIds.has(u.userId)).length;
  } else {
    const { getBoardPresence } = await import('./presence.js');
    const presenceData = await getBoardPresence(boardId);
    const activeIds = new Set(presenceData.map(p => p.userId));
    activeUsers = votingStats.filter(u => activeIds.has(u.userId)).length;
  }

  return {
    totalUsers: votingStats.length,
    activeUsers,
    usersWhoVoted: votingStats.filter(u => u.hasVoted).length,
    usersWhoHaventVoted: votingStats.length - votingStats.filter(u => u.hasVoted).length,
    totalVotesCast: votingStats.reduce((sum, u) => sum + u.voteCount, 0),
    maxPossibleVotes: votingStats.length * votingAllocation,
    remainingVotes: (votingStats.length * votingAllocation) - votingStats.reduce((sum, u) => sum + u.voteCount, 0),
    maxVotesPerUser: votingAllocation
  };
}
