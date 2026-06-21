import crypto from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/index.js";
import { apiTokens, users } from "../db/schema.js";

export const TOKEN_PREFIX = "tb_";
export const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export function generateToken(): { token: string; hash: string } {
	const bytes = crypto.randomBytes(32);
	const token = TOKEN_PREFIX + bytes.toString("hex");
	const hash = hashToken(token);
	return { token, hash };
}

export function hashToken(rawToken: string): string {
	return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function validateApiToken(
	rawToken: string,
): Promise<{ userId: string; email: string } | null> {
	if (!rawToken.startsWith(TOKEN_PREFIX)) return null;

	const hash = hashToken(rawToken);
	const now = Date.now();

	const [record] = await db
		.select({
			tokenId: apiTokens.id,
			userId: apiTokens.userId,
			userEmail: users.email,
		})
		.from(apiTokens)
		.innerJoin(users, eq(users.id, apiTokens.userId))
		.where(and(eq(apiTokens.tokenHash, hash), gt(apiTokens.expiresAt, now)))
		.limit(1);

	if (!record) return null;

	// Fire-and-forget last-used update — don't block the request
	db.update(apiTokens)
		.set({ lastUsedAt: now })
		.where(eq(apiTokens.id, record.tokenId))
		.catch(() => {});

	return { userId: record.userId, email: record.userEmail };
}
