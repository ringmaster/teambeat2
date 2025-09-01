import { db } from '../db/index.js';
import { cards, votes, comments, columns, users } from '../db/schema.js';
import { eq, and, count } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export interface CreateCardData {
	columnId: string;
	userId: string;
	content: string;
	groupId?: string;
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
			groupId: data.groupId
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
}

export async function updateCard(cardId: string, data: UpdateCardData) {
	const updateData: any = {
		updatedAt: new Date().toISOString(),
		...data
	};
	
	const [card] = await db
		.update(cards)
		.set(updateData)
		.where(eq(cards.id, cardId))
		.returning();
	
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
			createdAt: cards.createdAt,
			updatedAt: cards.updatedAt,
			voteCount: count(votes.id)
		})
		.from(cards)
		.innerJoin(columns, eq(columns.id, cards.columnId))
		.innerJoin(users, eq(users.id, cards.userId))
		.leftJoin(votes, eq(votes.cardId, cards.id))
		.where(eq(columns.boardId, boardId))
		.groupBy(cards.id)
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
			createdAt: cards.createdAt,
			updatedAt: cards.updatedAt,
			voteCount: count(votes.id)
		})
		.from(cards)
		.leftJoin(votes, eq(votes.cardId, cards.id))
		.where(eq(cards.columnId, columnId))
		.groupBy(cards.id)
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
	await db
		.update(cards)
		.set({ 
			groupId: null,
			updatedAt: new Date().toISOString()
		})
		.where(eq(cards.id, cardId));
}

export async function getCardVoteCount(cardId: string) {
	const [result] = await db
		.select({ count: count() })
		.from(votes)
		.where(eq(votes.cardId, cardId));
	
	return result.count;
}

export async function moveCardToColumn(cardId: string, newColumnId: string) {
	const [card] = await db
		.update(cards)
		.set({
			columnId: newColumnId,
			updatedAt: new Date().toISOString()
		})
		.where(eq(cards.id, cardId))
		.returning();
	
	return card;
}