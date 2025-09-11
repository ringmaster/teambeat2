import { db } from '../db/index.js';
import { votes, cards, seriesMembers, columns } from '../db/schema.js';
import { eq, and, count, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

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

export async function getBoardVotingStats(boardId: string, seriesId: string) {
  // Get all series members
  const members = await db
    .select({
      userId: seriesMembers.userId,
      username: 'users.username',
      name: 'users.name'
    })
    .from(seriesMembers)
    .innerJoin('users', eq('users.id', seriesMembers.userId))
    .where(eq(seriesMembers.seriesId, seriesId));

  // Get vote counts for each member
  const votingStats = [];
  for (const member of members) {
    const voteCount = await getUserVoteCount(member.userId, boardId);
    votingStats.push({
      userId: member.userId,
      username: member.username,
      name: member.name,
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
