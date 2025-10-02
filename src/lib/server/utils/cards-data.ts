import { getCardsForBoard } from '../repositories/card.js';
import { db } from '../db/index.js';
import { comments } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

export interface CardData {
  id: string;
  columnId: string;
  userId: string | null;
  userName: string | null;
  content: string;
  notes?: string | null;
  groupId: string | null;
  isGroupLead: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
  voteCount: number;
  reactions?: Record<string, number>;
  commentCount?: number;
}

/**
 * Get comment and reaction counts for multiple cards
 */
async function getCommentCountsForCards(cardIds: string[]): Promise<Map<string, { reactions: Record<string, number>, commentCount: number }>> {
  const countsMap = new Map();

  if (cardIds.length === 0) {
    return countsMap;
  }

  // Initialize all cards with empty counts
  cardIds.forEach(id => {
    countsMap.set(id, { reactions: {}, commentCount: 0 });
  });

  // Get reaction counts
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

  // Get comment counts
  const commentCounts = await db
    .select({
      cardId: comments.cardId,
      count: sql<number>`COUNT(*)`.as('count')
    })
    .from(comments)
    .where(and(
      sql`${comments.cardId} IN (${sql.join(cardIds.map(id => sql`${id}`), sql`, `)})`,
      eq(comments.isReaction, false)
    ))
    .groupBy(comments.cardId);

  // Process reaction counts
  reactionCounts.forEach(({ cardId, emoji, count }) => {
    const cardCounts = countsMap.get(cardId);
    if (cardCounts) {
      cardCounts.reactions[emoji] = count;
    }
  });

  // Process comment counts
  commentCounts.forEach(({ cardId, count }) => {
    const cardCounts = countsMap.get(cardId);
    if (cardCounts) {
      cardCounts.commentCount = count;
    }
  });

  return countsMap;
}

/**
 * Enriches a single card with comment and reaction counts
 * @param card - The card to enrich
 * @returns The card with added reaction and comment counts
 */
export async function enrichCardWithCounts(card: any): Promise<CardData> {
  const countsMap = await getCommentCountsForCards([card.id]);
  return {
    ...card,
    ...countsMap.get(card.id)
  };
}

/**
 * Enriches multiple cards with comment and reaction counts
 * @param cards - The cards to enrich
 * @returns The cards with added reaction and comment counts
 */
export async function enrichCardsWithCounts(cards: any[]): Promise<CardData[]> {
  if (cards.length === 0) return cards;

  const cardIds = cards.map(c => c.id);
  const countsMap = await getCommentCountsForCards(cardIds);

  return cards.map(card => ({
    ...card,
    ...countsMap.get(card.id)
  }));
}

/**
 * Builds complete cards data for a board
 * This function is used by both API endpoints and SSE broadcasts
 */
export async function buildAllCardsData(boardId: string): Promise<CardData[]> {
  const cards = await getCardsForBoard(boardId);
  return enrichCardsWithCounts(cards);
}
