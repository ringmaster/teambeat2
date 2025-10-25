import crypto from "crypto";
import { findUserById } from "../repositories/user.js";

// Token validity period in hours
export const PASSWORD_RESET_TOKEN_VALIDITY_HOURS = 1;

/**
 * Generates a stateless password reset token
 * Format: userId:expirationTimestamp:signature
 *
 * The signature is an HMAC-SHA256 of "userId:expirationTimestamp"
 * using the user's current password hash as the secret.
 * This ensures tokens automatically become invalid when password changes.
 */
export function generatePasswordResetToken(
	userId: string,
	passwordHash: string,
): string {
	const expiresAt =
		Date.now() + PASSWORD_RESET_TOKEN_VALIDITY_HOURS * 60 * 60 * 1000;
	const payload = `${userId}:${expiresAt}`;

	const hmac = crypto.createHmac("sha256", passwordHash);
	hmac.update(payload);
	const signature = hmac.digest("base64url");

	return `${payload}:${signature}`;
}

/**
 * Validates a password reset token
 * Returns { valid: true, userId } if valid
 * Returns { valid: false, error } if invalid
 */
export async function validatePasswordResetToken(
	token: string,
): Promise<{ valid: true; userId: string } | { valid: false; error: string }> {
	// Parse token format: userId:timestamp:signature
	const parts = token.split(":");
	if (parts.length !== 3) {
		return { valid: false, error: "Invalid token format" };
	}

	const [userId, expiresAtStr, receivedSignature] = parts;
	const expiresAt = parseInt(expiresAtStr, 10);

	// Check expiration first (cheap operation)
	if (isNaN(expiresAt) || Date.now() > expiresAt) {
		return { valid: false, error: "Token has expired" };
	}

	// Fetch user to get current password hash
	const user = await findUserById(userId);
	if (!user || !user.passwordHash) {
		return { valid: false, error: "Invalid token" };
	}

	// Recompute signature with current password hash
	const payload = `${userId}:${expiresAt}`;
	const hmac = crypto.createHmac("sha256", user.passwordHash);
	hmac.update(payload);
	const expectedSignature = hmac.digest("base64url");

	// Constant-time comparison to prevent timing attacks
	const expectedBuffer = Buffer.from(expectedSignature);
	const receivedBuffer = Buffer.from(receivedSignature);

	// Buffers must be same length for timingSafeEqual
	if (expectedBuffer.length !== receivedBuffer.length) {
		return { valid: false, error: "Invalid token" };
	}

	const signaturesMatch = crypto.timingSafeEqual(
		expectedBuffer,
		receivedBuffer,
	);

	if (!signaturesMatch) {
		return { valid: false, error: "Invalid token" };
	}

	return { valid: true, userId };
}
