interface RateLimitEntry {
	count: number;
	resetAt: number;
	failedAttempts?: number; // Track failed login attempts
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(
	() => {
		const now = Date.now();
		for (const [key, entry] of rateLimitStore.entries()) {
			if (entry.resetAt < now) {
				rateLimitStore.delete(key);
			}
		}
	},
	5 * 60 * 1000,
);

export async function checkRateLimit(
	key: string,
	maxRequests: number,
	windowMs: number,
): Promise<{ allowed: boolean; remaining: number }> {
	const now = Date.now();
	const entry = rateLimitStore.get(key);

	if (!entry || entry.resetAt < now) {
		// New window
		rateLimitStore.set(key, {
			count: 1,
			resetAt: now + windowMs,
		});
		return { allowed: true, remaining: maxRequests - 1 };
	}

	if (entry.count >= maxRequests) {
		return { allowed: false, remaining: 0 };
	}

	entry.count++;
	return { allowed: true, remaining: maxRequests - entry.count };
}

// Login-specific rate limiting
export interface LoginRateLimitResult {
	allowed: boolean;
	failedAttempts: number;
	attemptsRemaining: number;
	isHardBlocked: boolean;
}

/**
 * Check login rate limit
 * - Attempts 1-10: Allowed with countdown
 * - After 10 attempts: Hard block for 15 minutes
 */
export function checkLoginRateLimit(key: string): LoginRateLimitResult {
	const now = Date.now();
	const windowMs = 15 * 60 * 1000; // 15 minutes
	const maxAttempts = 10;
	const entry = rateLimitStore.get(key);

	if (!entry || entry.resetAt < now) {
		// New window - always allow first attempt
		rateLimitStore.set(key, {
			count: 1,
			resetAt: now + windowMs,
			failedAttempts: 0,
		});
		return {
			allowed: true,
			failedAttempts: 0,
			attemptsRemaining: maxAttempts,
			isHardBlocked: false,
		};
	}

	const attempts = entry.failedAttempts || 0;

	// Hard block - exceeded all attempts
	if (attempts >= maxAttempts) {
		return {
			allowed: false,
			failedAttempts: attempts,
			attemptsRemaining: 0,
			isHardBlocked: true,
		};
	}

	// Still within allowed attempts
	return {
		allowed: true,
		failedAttempts: attempts,
		attemptsRemaining: maxAttempts - attempts,
		isHardBlocked: false,
	};
}

export function recordLoginFailure(key: string): void {
	const entry = rateLimitStore.get(key);
	if (entry) {
		entry.failedAttempts = (entry.failedAttempts || 0) + 1;
	}
}

export function resetLoginAttempts(key: string): void {
	const entry = rateLimitStore.get(key);
	if (entry) {
		entry.failedAttempts = 0;
	}
}

export function getLoginAttempts(key: string): number {
	const entry = rateLimitStore.get(key);
	return entry?.failedAttempts || 0;
}
