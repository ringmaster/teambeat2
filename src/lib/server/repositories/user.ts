import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
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