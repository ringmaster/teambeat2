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
	const emailVerificationSecret = uuidv4();

	const [user] = await db
		.insert(users)
		.values({
			id,
			email: data.email,
			name: data.name,
			passwordHash,
			emailVerificationSecret
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
	emailVerified: boolean;
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
			emailVerified: users.emailVerified,
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

export async function getUserById(userId: string) {
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);

	return user;
}

export async function getUserByEmail(email: string) {
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.email, email))
		.limit(1);

	return user;
}

export async function markEmailVerified(userId: string): Promise<void> {
	await db
		.update(users)
		.set({
			emailVerified: true,
			updatedAt: new Date().toISOString()
		})
		.where(eq(users.id, userId));
}

export async function setEmailVerified(userId: string, verified: boolean): Promise<void> {
	await db
		.update(users)
		.set({
			emailVerified: verified,
			updatedAt: new Date().toISOString()
		})
		.where(eq(users.id, userId));
}

export async function ensureEmailVerificationSecret(userId: string): Promise<string> {
	const user = await findUserById(userId);

	if (!user) {
		throw new Error('User not found');
	}

	// If secret already exists, return it
	if (user.emailVerificationSecret) {
		return user.emailVerificationSecret;
	}

	// Generate a new secret for this user
	const newSecret = uuidv4();
	await db
		.update(users)
		.set({
			emailVerificationSecret: newSecret,
			updatedAt: new Date().toISOString()
		})
		.where(eq(users.id, userId));

	return newSecret;
}

export function canCreateResources(user: { emailVerified: boolean }): boolean {
	const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER;

	// Email verification is required if EMAIL_PROVIDER is explicitly set (including 'console')
	// Only when EMAIL_PROVIDER is undefined/empty should verification be disabled
	const isEmailConfigured = !!EMAIL_PROVIDER;

	if (!isEmailConfigured) {
		return true; // No email provider configured, all users can create
	}

	return user.emailVerified === true; // Email provider configured, only verified users can create
}