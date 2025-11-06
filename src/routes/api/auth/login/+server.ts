import { json } from "@sveltejs/kit";
import { z } from "zod";
import { setSessionCookie } from "$lib/server/auth/index.js";
import { verifyPassword } from "$lib/server/auth/password.js";
import { createSession } from "$lib/server/auth/session.js";
import { findUserByEmail } from "$lib/server/repositories/user.js";
import type { RequestHandler } from "./$types";
import {
	checkLoginRateLimit,
	recordLoginFailure,
	resetLoginAttempts,
} from "$lib/server/rate-limit.js";

const loginSchema = z.object({
	email: z.string().email("Invalid email format"),
	password: z.string().min(1),
});

export const POST: RequestHandler = async (event) => {
	const { request, getClientAddress } = event;
	try {
		const body = await request.json();
		const data = loginSchema.parse(body);

		// Get rate limit key based on IP address
		const ip = getClientAddress();
		const rateLimitKey = `login:${ip}`;

		// Check rate limit
		const rateLimitResult = checkLoginRateLimit(rateLimitKey);

		if (!rateLimitResult.allowed) {
			// Hard block - exceeded all 10 attempts
			return json(
				{
					success: false,
					error: "Too many login attempts. Please try again in 15 minutes.",
					attemptsRemaining: 0,
				},
				{ status: 429 },
			);
		}

		// Validate credentials
		const user = await findUserByEmail(data.email);
		if (!user || !verifyPassword(data.password, user.passwordHash)) {
			// Record failed attempt
			recordLoginFailure(rateLimitKey);

			// Get updated rate limit info
			const updatedLimit = checkLoginRateLimit(rateLimitKey);

			return json(
				{
					success: false,
					error: "Invalid email or password",
					attemptsRemaining: updatedLimit.attemptsRemaining,
				},
				{ status: 401 },
			);
		}

		// Success - reset attempts
		resetLoginAttempts(rateLimitKey);

		const sessionId = createSession(user.id, user.email);
		setSessionCookie(event, sessionId);

		return json({
			success: true,
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
			},
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return json(
				{ success: false, error: "Invalid input", details: error.errors },
				{ status: 400 },
			);
		}

		console.error("Login error:", error);
		return json({ success: false, error: "Login failed" }, { status: 500 });
	}
};
