import { db } from '../db/index.js';
import { cards, votes, columns, users } from '../db/schema.js';
import { eq, count } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export interface CreateCardData {
  columnId: string;
  userId: string;
  content: string;
  groupId?: string;
  isGroupLead?: boolean;
}

export async function createCard(data: CreateCardData) {
  const id = uuidv4();

  await db
    .insert(cards)
    .values({
      id,
      columnId: data.columnId,
      userId: data.userId,
      content: data.content,
      groupId: data.groupId,
      isGroupLead: data.isGroupLead || false
    });

  // Return the card with user name included
  const [card] = await db
    .select({
      id: cards.id,
      columnId: cards.columnId,
      userId: cards.userId,
      userName: users.name,
      content: cards.content,
      groupId: cards.groupId,
      isGroupLead: cards.isGroupLead,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt
    })
    .from(cards)
    .innerJoin(users, eq(users.id, cards.userId))
    .where(eq(cards.id, id))
    .limit(1);

  return card;
}

export async function findCardById(cardId: string) {
  const [card] = await db
    .select()
    .from(cards)
    .where(eq(cards.id, cardId))
    .limit(1);

  return card;
}

export interface UpdateCardData {
  content?: string;
  groupId?: string | null;
  userId?: string;
  isGroupLead?: boolean;
}

export async function updateCard(cardId: string, data: UpdateCardData) {
  const updateData: any = {
    updatedAt: new Date().toISOString(),
    ...data
  };

  await db
    .update(cards)
    .set(updateData)
    .where(eq(cards.id, cardId));

  // Return the card with user name included
  const [card] = await db
    .select({
      id: cards.id,
      columnId: cards.columnId,
      userId: cards.userId,
      userName: users.name,
      content: cards.content,
      groupId: cards.groupId,
      isGroupLead: cards.isGroupLead,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt
    })
    .from(cards)
    .innerJoin(users, eq(users.id, cards.userId))
    .where(eq(cards.id, cardId))
    .limit(1);

  return card;
}

export { findCardById as getCardById };

export async function deleteCard(cardId: string) {
  await db
    .delete(cards)
    .where(eq(cards.id, cardId));
}

export async function getCardsForBoard(boardId: string) {
  const result = await db
    .select({
      id: cards.id,
      columnId: cards.columnId,
      userId: cards.userId,
      userName: users.name,
      content: cards.content,
      groupId: cards.groupId,
      isGroupLead: cards.isGroupLead,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt,
      voteCount: count(votes.id)
    })
    .from(cards)
    .innerJoin(columns, eq(columns.id, cards.columnId))
    .innerJoin(users, eq(users.id, cards.userId))
    .leftJoin(votes, eq(votes.cardId, cards.id))
    .where(eq(columns.boardId, boardId))
    .groupBy(cards.id, cards.columnId, cards.userId, cards.content, cards.groupId, cards.isGroupLead, cards.createdAt, cards.updatedAt, users.name)
    .orderBy(cards.createdAt);

  return result;
}

export async function getCardsForColumn(columnId: string) {
  const result = await db
    .select({
      id: cards.id,
      columnId: cards.columnId,
      userId: cards.userId,
      content: cards.content,
      groupId: cards.groupId,
      isGroupLead: cards.isGroupLead,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt,
      voteCount: count(votes.id)
    })
    .from(cards)
    .leftJoin(votes, eq(votes.cardId, cards.id))
    .where(eq(cards.columnId, columnId))
    .groupBy(cards.id, cards.columnId, cards.userId, cards.content, cards.groupId, cards.isGroupLead, cards.createdAt, cards.updatedAt)
    .orderBy(cards.createdAt);

  return result;
}

export async function groupCards(cardIds: string[], groupId?: string) {
  const targetGroupId = groupId || uuidv4();

  // Update cards one by one since we can't use array in where clause directly
  for (const cardId of cardIds) {
    await db
      .update(cards)
      .set({
        groupId: targetGroupId,
        updatedAt: new Date().toISOString()
      })
      .where(eq(cards.id, cardId));
  }

  return targetGroupId;
}

export async function ungroupCard(cardId: string) {
  const card = await findCardById(cardId);
  if (!card || !card.groupId) return { affectedCardIds: [] };

  const originalGroupId = card.groupId;

  // Remove card from group
  await db
    .update(cards)
    .set({
      groupId: null,
      isGroupLead: false,
      updatedAt: new Date().toISOString()
    })
    .where(eq(cards.id, cardId));

  // Check if any cards remain in the group
  const remainingCards = await db
    .select({ id: cards.id, isGroupLead: cards.isGroupLead })
    .from(cards)
    .where(eq(cards.groupId, originalGroupId))
    .limit(2);

  const affectedCardIds: string[] = [];

  // If only one card remains, remove the group entirely
  if (remainingCards.length === 1) {
    await db
      .update(cards)
      .set({
        groupId: null,
        isGroupLead: false,
        updatedAt: new Date().toISOString()
      })
      .where(eq(cards.id, remainingCards[0].id));
    affectedCardIds.push(remainingCards[0].id);
  }
  // If no lead card exists, make the first remaining card the lead
  else if (remainingCards.length > 1 && !remainingCards.some(c => c.isGroupLead)) {
    await db
      .update(cards)
      .set({
        isGroupLead: true,
        updatedAt: new Date().toISOString()
      })
      .where(eq(cards.id, remainingCards[0].id));
    affectedCardIds.push(remainingCards[0].id);
  }

  return { affectedCardIds };
}

export async function getCardVoteCount(cardId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(votes)
    .where(eq(votes.cardId, cardId));

  return result.count;
}

export async function moveCardToColumn(cardId: string, newColumnId: string) {
  await db
    .update(cards)
    .set({
      columnId: newColumnId,
      updatedAt: new Date().toISOString()
    })
    .where(eq(cards.id, cardId));

  // Return the card with user name included
  const [card] = await db
    .select({
      id: cards.id,
      columnId: cards.columnId,
      userId: cards.userId,
      userName: users.name,
      content: cards.content,
      groupId: cards.groupId,
      isGroupLead: cards.isGroupLead,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt
    })
    .from(cards)
    .innerJoin(users, eq(users.id, cards.userId))
    .where(eq(cards.id, cardId))
    .limit(1);

  return card;
}

export async function groupCardOntoTarget(draggedCardId: string, targetCardId: string) {
  // Get both cards to determine the grouping strategy
  const draggedCard = await findCardById(draggedCardId);
  const targetCard = await findCardById(targetCardId);
  if (!draggedCard || !targetCard) throw new Error('Card not found');

  // Generate new group ID if target doesn't have one
  const targetGroupId = targetCard.groupId || uuidv4();

  // If target doesn't have a group yet, make it the lead card
  if (!targetCard.groupId) {
    await db
      .update(cards)
      .set({
        groupId: targetGroupId,
        isGroupLead: true,
        updatedAt: new Date().toISOString()
      })
      .where(eq(cards.id, targetCardId));
  }

  // If the dragged card is a group lead, move the entire group
  if (draggedCard.groupId && draggedCard.isGroupLead) {
    // Move all cards from the dragged card's group to the target's group
    await db
      .update(cards)
      .set({
        columnId: targetCard.columnId,
        groupId: targetGroupId,
        isGroupLead: false,
        updatedAt: new Date().toISOString()
      })
      .where(eq(cards.groupId, draggedCard.groupId));

    return { targetGroupId, affectedCardIds: [] };
  } else {
    let affectedCardIds: string[] = [];

    // If the dragged card is part of a group (subordinate), use ungroupCard for proper cleanup
    if (draggedCard.groupId) {
      const ungroupResult = await ungroupCard(draggedCardId);
      affectedCardIds = ungroupResult.affectedCardIds;
    }

    // Move the card to the target's group
    await db
      .update(cards)
      .set({
        columnId: targetCard.columnId,
        groupId: targetGroupId,
        isGroupLead: false,
        updatedAt: new Date().toISOString()
      })
      .where(eq(cards.id, draggedCardId));

    return { targetGroupId, affectedCardIds };
  }

  return { targetGroupId, affectedCardIds: [] };
}


export async function moveGroupToColumn(leadCardId: string, newColumnId: string) {
  const leadCard = await findCardById(leadCardId);
  if (!leadCard || !leadCard.groupId || !leadCard.isGroupLead) {
    throw new Error('Card is not a group lead');
  }

  // Move all cards in the group to the new column
  await db
    .update(cards)
    .set({
      columnId: newColumnId,
      updatedAt: new Date().toISOString()
    })
    .where(eq(cards.groupId, leadCard.groupId));
}
