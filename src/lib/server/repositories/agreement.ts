import { and, eq, isNull, or } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import {
	agreements,
	boards,
	cards,
	columns,
	comments,
	users,
} from "../db/schema.js";

export interface CreateAgreementData {
	boardId: string;
	userId: string;
	content: string;
	sourceAgreementId?: string | null;
}

export async function createAgreement(data: CreateAgreementData) {
	const id = uuidv4();
	const now = new Date().toISOString();

	await db.insert(agreements).values({
		id,
		boardId: data.boardId,
		userId: data.userId,
		content: data.content,
		completed: false,
		sourceAgreementId: data.sourceAgreementId || null,
		createdAt: now,
		updatedAt: now,
	});

	return await findAgreementById(id);
}

export async function findAgreementById(agreementId: string) {
	const [agreement] = await db
		.select({
			id: agreements.id,
			boardId: agreements.boardId,
			userId: agreements.userId,
			content: agreements.content,
			completed: agreements.completed,
			completedByUserId: agreements.completedByUserId,
			completedAt: agreements.completedAt,
			sourceAgreementId: agreements.sourceAgreementId,
			createdAt: agreements.createdAt,
			updatedAt: agreements.updatedAt,
		})
		.from(agreements)
		.where(eq(agreements.id, agreementId))
		.limit(1);

	return agreement;
}

export interface UpdateAgreementData {
	content?: string;
	completed?: boolean;
	completedByUserId?: string | null;
	completedAt?: string | null;
}

export async function updateAgreement(
	agreementId: string,
	data: UpdateAgreementData,
) {
	const updateData: any = {
		updatedAt: new Date().toISOString(),
		...data,
	};

	await db
		.update(agreements)
		.set(updateData)
		.where(eq(agreements.id, agreementId));

	return await findAgreementById(agreementId);
}

export async function setAgreementCompletion(
	agreementId: string,
	completed: boolean,
	completedByUserId: string,
) {
	return await updateAgreement(agreementId, {
		completed,
		completedByUserId: completed ? completedByUserId : null,
		completedAt: completed ? new Date().toISOString() : null,
	});
}

export async function deleteAgreement(agreementId: string) {
	await db.delete(agreements).where(eq(agreements.id, agreementId));
}

export async function findAgreementsByBoardId(boardId: string) {
	const results = await db
		.select({
			id: agreements.id,
			boardId: agreements.boardId,
			userId: agreements.userId,
			content: agreements.content,
			completed: agreements.completed,
			completedByUserId: agreements.completedByUserId,
			completedAt: agreements.completedAt,
			sourceAgreementId: agreements.sourceAgreementId,
			createdAt: agreements.createdAt,
			updatedAt: agreements.updatedAt,
		})
		.from(agreements)
		.where(eq(agreements.boardId, boardId))
		.orderBy(agreements.createdAt);

	return results;
}

export async function findIncompleteAgreementsByBoardId(boardId: string) {
	const results = await db
		.select({
			id: agreements.id,
			boardId: agreements.boardId,
			userId: agreements.userId,
			content: agreements.content,
			completed: agreements.completed,
			completedByUserId: agreements.completedByUserId,
			completedAt: agreements.completedAt,
			sourceAgreementId: agreements.sourceAgreementId,
			createdAt: agreements.createdAt,
			updatedAt: agreements.updatedAt,
		})
		.from(agreements)
		.where(
			and(eq(agreements.boardId, boardId), eq(agreements.completed, false)),
		)
		.orderBy(agreements.createdAt);

	return results;
}

// Find comment-based agreements for a board given visible column IDs
export async function findCommentAgreementsByColumns(columnIds: string[]) {
	if (columnIds.length === 0) {
		return [];
	}

	const results = await db
		.select({
			id: comments.id,
			cardId: comments.cardId,
			userId: comments.userId,
			content: comments.content,
			completed: comments.completed,
			completedByUserId: comments.completedByUserId,
			completedAt: comments.completedAt,
			createdAt: comments.createdAt,
			updatedAt: comments.updatedAt,
			cardContent: cards.content,
			columnId: cards.columnId,
			columnTitle: columns.title,
		})
		.from(comments)
		.innerJoin(cards, eq(cards.id, comments.cardId))
		.innerJoin(columns, eq(columns.id, cards.columnId))
		.where(
			and(
				eq(comments.isAgreement, true),
				or(...columnIds.map((id) => eq(cards.columnId, id))),
			),
		)
		.orderBy(comments.createdAt);

	return results;
}

// Update comment completion status
export async function setCommentCompletion(
	commentId: string,
	completed: boolean,
	completedByUserId: string,
) {
	await db
		.update(comments)
		.set({
			completed,
			completedByUserId: completed ? completedByUserId : null,
			completedAt: completed ? new Date().toISOString() : null,
			updatedAt: new Date().toISOString(),
		})
		.where(eq(comments.id, commentId));

	const [comment] = await db
		.select()
		.from(comments)
		.where(eq(comments.id, commentId))
		.limit(1);

	return comment;
}

// Find incomplete comment-based agreements for a board (for cloning)
export async function findIncompleteCommentAgreementsByBoardId(
	boardId: string,
) {
	const results = await db
		.select({
			id: comments.id,
			cardId: comments.cardId,
			userId: comments.userId,
			content: comments.content,
			completed: comments.completed,
			completedByUserId: comments.completedByUserId,
			completedAt: comments.completedAt,
			createdAt: comments.createdAt,
			updatedAt: comments.updatedAt,
		})
		.from(comments)
		.innerJoin(cards, eq(cards.id, comments.cardId))
		.innerJoin(columns, eq(columns.id, cards.columnId))
		.innerJoin(boards, eq(boards.id, columns.boardId))
		.where(
			and(
				eq(boards.id, boardId),
				eq(comments.isAgreement, true),
				eq(comments.completed, false),
			),
		)
		.orderBy(comments.createdAt);

	return results;
}
