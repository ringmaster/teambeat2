import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq, like, or, sql, count } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { hashPassword } from '../auth/password.js';

export interface CreateUserData {
	email: string;
	name?: string;
	password: string;
}

export async function createUser(data: CreateUserData) {
	const id = uuidv4();
	const passwordHash = hashPassword(data.password);
	
	const [user] = await db
		.insert(users)
		.values({
			id,
			email: data.email,
			name: data.name,
			passwordHash
		})
		.returning();
	
	return user;
}

export async function findUserByEmail(email: string) {
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.email, email))
		.limit(1);
	
	return user;
}

export async function findUserById(id: string) {
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.id, id))
		.limit(1);

	return user;
}

export async function updateUserPassword(userId: string, newPassword: string) {
	const passwordHash = hashPassword(newPassword);

	const [updatedUser] = await db
		.update(users)
		.set({
			passwordHash,
			updatedAt: new Date().toISOString()
		})
		.where(eq(users.id, userId))
		.returning();

	return updatedUser;
}

export async function searchUsers(
	search: string,
	page: number,
	pageSize: number
): Promise<Array<{
	id: string;
	email: string;
	name: string | null;
	isAdmin: boolean;
	createdAt: string;
}>> {
	const offset = (page - 1) * pageSize;
	const searchPattern = `%${search}%`;

	const results = await db
		.select({
			id: users.id,
			email: users.email,
			name: users.name,
			isAdmin: users.is_admin,
			createdAt: users.createdAt
		})
		.from(users)
		.where(
			search
				? or(
					like(users.email, searchPattern),
					like(users.name, searchPattern)
				)
				: undefined
		)
		.orderBy(users.email)
		.limit(pageSize)
		.offset(offset);

	return results;
}

export async function countUsers(search: string): Promise<number> {
	const searchPattern = `%${search}%`;

	const [result] = await db
		.select({ count: count() })
		.from(users)
		.where(
			search
				? or(
					like(users.email, searchPattern),
					like(users.name, searchPattern)
				)
				: undefined
		);

	return result?.count ?? 0;
}

export async function deleteUserById(userId: string): Promise<void> {
	await db
		.delete(users)
		.where(eq(users.id, userId));
}