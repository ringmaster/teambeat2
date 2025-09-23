import { getCardsForBoard } from '../repositories/card.js';

export interface CardData {
  id: string;
  columnId: string;
  userId: string | null;
  userName: string | null;
  content: string;
  groupId: string | null;
  isGroupLead: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
  voteCount: number;
}

/**
 * Builds complete cards data for a board
 * This function is used by both API endpoints and SSE broadcasts
 */
export async function buildAllCardsData(boardId: string): Promise<CardData[]> {
  const cards = await getCardsForBoard(boardId);
  return cards;
}
