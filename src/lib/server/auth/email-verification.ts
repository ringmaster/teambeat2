import crypto from "crypto";
import { getUserById } from "$lib/server/repositories/user";

const TOKEN_VALIDITY_HOURS = 24;

export function generateEmailVerificationToken(
	userId: string,
	verificationSecret: string,
): string {
	const expiresAt = Date.now() + TOKEN_VALIDITY_HOURS * 60 * 60 * 1000;
	const payload = `${userId}:${expiresAt}`;

	const hmac = crypto.createHmac("sha256", verificationSecret);
	hmac.update(payload);
	const signature = hmac.digest("base64url");

	return `${payload}:${signature}`;
}

export async function validateEmailVerificationToken(
	token: string,
): Promise<{ valid: true; userId: string } | { valid: false; error: string }> {
	const parts = token.split(":");
	if (parts.length !== 3) {
		return { valid: false, error: "Invalid token format" };
	}

	const [userId, expiresAtStr, providedSignature] = parts;

	// Check expiration first
	const expiresAt = parseInt(expiresAtStr, 10);
	if (isNaN(expiresAt) || Date.now() > expiresAt) {
		return { valid: false, error: "Token expired" };
	}

	// Fetch user to get verification secret
	const user = await getUserById(userId);
	if (!user || !user.emailVerificationSecret) {
		return { valid: false, error: "Invalid token" };
	}

	// Verify signature
	const payload = `${userId}:${expiresAtStr}`;
	const hmac = crypto.createHmac("sha256", user.emailVerificationSecret);
	hmac.update(payload);
	const expectedSignature = hmac.digest("base64url");

	if (
		!crypto.timingSafeEqual(
			Buffer.from(expectedSignature),
			Buffer.from(providedSignature),
		)
	) {
		return { valid: false, error: "Invalid token" };
	}

	return { valid: true, userId };
}
