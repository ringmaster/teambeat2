import { db } from '../db/index.js';
import { boardSeries, seriesMembers, boards, users } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export interface CreateSeriesData {
	name: string;
	slug?: string;
	description?: string;
	creatorId: string;
}

export async function createBoardSeries(data: CreateSeriesData) {
	const id = uuidv4();
	const baseSlug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
	const slug = `${baseSlug}-${id.substring(0, 8)}`;
	
	return db.transaction((tx) => {
		const series = {
			id,
			name: data.name,
			slug,
			description: data.description,
			createdAt: new Date().toISOString()
		};
		
		tx
			.insert(boardSeries)
			.values(series)
			.run();
		
		tx
			.insert(seriesMembers)
			.values({
				seriesId: series.id,
				userId: data.creatorId,
				role: 'admin'
			})
			.run();
		
		return series;
	});
}

export async function findSeriesByUser(userId: string) {
	const result = await db
		.select({
			id: boardSeries.id,
			name: boardSeries.name,
			slug: boardSeries.slug,
			description: boardSeries.description,
			createdAt: boardSeries.createdAt,
			role: seriesMembers.role
		})
		.from(boardSeries)
		.innerJoin(seriesMembers, eq(seriesMembers.seriesId, boardSeries.id))
		.where(eq(seriesMembers.userId, userId));
	
	return result;
}

export async function findSeriesWithBoardsByUser(userId: string) {
	const seriesResult = await findSeriesByUser(userId);
	
	// Get boards for each series
	const seriesWithBoards = await Promise.all(
		seriesResult.map(async (series) => {
			const seriesBoards = await db
				.select({
					id: boards.id,
					name: boards.name,
					status: boards.status,
					createdAt: boards.createdAt,
					updatedAt: boards.updatedAt
				})
				.from(boards)
				.where(eq(boards.seriesId, series.id))
				.orderBy(desc(boards.createdAt));
			
			// Filter draft boards based on user role
			// Non-admin/facilitator users can only see active and completed boards
			const filteredBoards = ['admin', 'facilitator'].includes(series.role) 
				? seriesBoards 
				: seriesBoards.filter(board => board.status !== 'draft');
			
			return {
				...series,
				boards: filteredBoards
			};
		})
	);
	
	return seriesWithBoards;
}

export async function findSeriesById(seriesId: string) {
	const [series] = await db
		.select()
		.from(boardSeries)
		.where(eq(boardSeries.id, seriesId))
		.limit(1);
	
	return series;
}

export async function getUserRoleInSeries(userId: string, seriesId: string) {
	const [membership] = await db
		.select({ role: seriesMembers.role })
		.from(seriesMembers)
		.where(
			and(
				eq(seriesMembers.userId, userId),
				eq(seriesMembers.seriesId, seriesId)
			)
		)
		.limit(1);
	
	return membership?.role || null;
}

export async function addSeriesMember(seriesId: string, userId: string, role: 'admin' | 'facilitator' | 'member') {
	await db
		.insert(seriesMembers)
		.values({
			seriesId,
			userId,
			role
		});
}

export async function removeSeriesMember(seriesId: string, userId: string) {
	await db
		.delete(seriesMembers)
		.where(
			and(
				eq(seriesMembers.seriesId, seriesId),
				eq(seriesMembers.userId, userId)
			)
		);
}

export async function getSeriesMembers(seriesId: string) {
	const members = await db
		.select({
			userId: seriesMembers.userId,
			userName: users.name,
			email: users.email,
			role: seriesMembers.role,
			joinedAt: seriesMembers.joinedAt
		})
		.from(seriesMembers)
		.innerJoin(users, eq(users.id, seriesMembers.userId))
		.where(eq(seriesMembers.seriesId, seriesId))
		.orderBy(seriesMembers.role, users.name);
	
	return members;
}

export async function addUserToSeries(seriesId: string, userId: string, role: 'admin' | 'facilitator' | 'member') {
	await db.insert(seriesMembers).values({
		seriesId,
		userId,
		role,
		joinedAt: new Date().toISOString()
	});
}

export async function removeUserFromSeries(seriesId: string, userId: string) {
	await db
		.delete(seriesMembers)
		.where(and(eq(seriesMembers.seriesId, seriesId), eq(seriesMembers.userId, userId)));
}

export async function updateUserRoleInSeries(seriesId: string, userId: string, newRole: 'admin' | 'facilitator' | 'member') {
	await db
		.update(seriesMembers)
		.set({ role: newRole })
		.where(and(eq(seriesMembers.seriesId, seriesId), eq(seriesMembers.userId, userId)));
}