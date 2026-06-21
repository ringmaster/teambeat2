import { and, eq, gt, lt } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { generateToken, TOKEN_TTL_MS } from "../auth/api-token.js";
import { db } from "../db/index.js";
import { apiTokens } from "../db/schema.js";

export async function createApiToken(userId: string, label: string) {
	const id = uuidv4();
	const { token, hash } = generateToken();
	const now = Date.now();
	const expiresAt = now + TOKEN_TTL_MS;

	await db.insert(apiTokens).values({
		id,
		userId,
		tokenHash: hash,
		label,
		expiresAt,
		lastUsedAt: null,
		createdAt: now,
	});

	return {
		rawToken: token,
		tokenInfo: {
			id,
			label,
			expiresAt,
			lastUsedAt: null,
			createdAt: now,
		},
	};
}

export async function listApiTokens(userId: string) {
	const now = Date.now();
	return db
		.select({
			id: apiTokens.id,
			label: apiTokens.label,
			expiresAt: apiTokens.expiresAt,
			lastUsedAt: apiTokens.lastUsedAt,
			createdAt: apiTokens.createdAt,
		})
		.from(apiTokens)
		.where(and(eq(apiTokens.userId, userId), gt(apiTokens.expiresAt, now)))
		.orderBy(apiTokens.createdAt);
}

export async function revokeApiToken(
	tokenId: string,
	userId: string,
): Promise<boolean> {
	const result = await db
		.delete(apiTokens)
		.where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId)));

	// Drizzle returns rowsAffected in different shapes for pg vs sqlite
	const rows =
		(result as any).rowsAffected ??
		(result as any).rowCount ??
		(Array.isArray(result) ? result.length : 0);
	return rows > 0;
}

export async function cleanupExpiredTokens(): Promise<void> {
	await db.delete(apiTokens).where(lt(apiTokens.expiresAt, Date.now()));
}
