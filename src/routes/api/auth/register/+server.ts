import { json } from "@sveltejs/kit";
import { z } from "zod";
import { generateEmailVerificationToken } from "$lib/server/auth/email-verification.js";
import { setSessionCookie } from "$lib/server/auth/index.js";
import { createSession } from "$lib/server/auth/session.js";
import { emailService, isEmailConfigured } from "$lib/server/email/index.js";
import { emailVerificationTemplate } from "$lib/server/email/templates.js";
import { createUser } from "$lib/server/repositories/user.js";
import type { RequestHandler } from "./$types";
import {
	checkLoginRateLimit,
	recordLoginFailure,
	resetLoginAttempts,
} from "$lib/server/rate-limit.js";

const registerSchema = z.object({
	email: z.string().email("Invalid email format"),
	name: z.string().min(1).max(50).optional(),
	password: z.string().min(6).max(100),
});

export const POST: RequestHandler = async (event) => {
	const { request, url, getClientAddress } = event;
	try {
		const body = await request.json();
		const data = registerSchema.parse(body);

		// Get rate limit key based on IP address
		const ip = getClientAddress();
		const rateLimitKey = `register:${ip}`;

		// Check rate limit
		const rateLimitResult = checkLoginRateLimit(rateLimitKey);

		if (!rateLimitResult.allowed) {
			// Hard block - exceeded all 10 attempts
			return json(
				{
					success: false,
					error:
						"Too many registration attempts. Please try again in 15 minutes.",
					attemptsRemaining: 0,
				},
				{ status: 429 },
			);
		}

		// Try to create user
		try {
			const user = await createUser(data);

			// Success - reset attempts
			resetLoginAttempts(rateLimitKey);

			const sessionId = createSession(user.id, user.email);
			setSessionCookie(event, sessionId);

			// Send verification email if email is configured
			if (isEmailConfigured && user.emailVerificationSecret) {
				const token = generateEmailVerificationToken(
					user.id,
					user.emailVerificationSecret,
				);
				const verifyUrl = `${url.origin}/verify-email?token=${token}`;
				const html = emailVerificationTemplate(
					verifyUrl,
					user.name || user.email,
				);

				// Send email asynchronously - don't block registration on email delivery
				emailService
					.send({
						to: user.email,
						subject: "Verify your TeamBeat email address",
						html,
					})
					.catch((error) => {
						console.error(
							"Failed to send verification email during registration:",
							error,
						);
					});
			}

			return json({
				success: true,
				user: {
					id: user.id,
					email: user.email,
					name: user.name,
				},
			});
		} catch (userError) {
			// Record failed attempt (e.g., duplicate email)
			recordLoginFailure(rateLimitKey);

			// Get updated rate limit info
			const updatedLimit = checkLoginRateLimit(rateLimitKey);

			return json(
				{
					success: false,
					error: "Registration failed. Email may already be in use.",
					attemptsRemaining: updatedLimit.attemptsRemaining,
				},
				{ status: 400 },
			);
		}
	} catch (error) {
		if (error instanceof z.ZodError) {
			return json(
				{ success: false, error: "Invalid input", details: error.errors },
				{ status: 400 },
			);
		}

		console.error("Registration error:", error);
		return json(
			{ success: false, error: "Registration failed" },
			{ status: 500 },
		);
	}
};
