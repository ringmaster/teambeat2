import { db } from '../db/index.js';
import { votes, cards, columns, users } from '../db/schema.js';
import { eq, and, count, desc, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getBoardPresence } from './presence.js';

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

  // Get vote counts for each active user
  const votingStats = [];
  for (const activeUser of activeUsers) {
    // Get user details
    const [userDetails] = await db
      .select({
        name: users.name
      })
      .from(users)
      .where(eq(users.id, activeUser.userId))
      .limit(1);

    const voteCount = await getUserVoteCount(activeUser.userId, boardId);
    votingStats.push({
      userId: activeUser.userId,
      username: userDetails?.name || 'Unknown User',
      name: userDetails?.name || 'Unknown User',
      voteCount,
      hasVoted: voteCount > 0
    });
  }

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
