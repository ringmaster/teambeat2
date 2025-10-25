import { json } from "@sveltejs/kit";
import { z } from "zod";
import { generateEmailVerificationToken } from "$lib/server/auth/email-verification.js";
import { setSessionCookie } from "$lib/server/auth/index.js";
import { createSession } from "$lib/server/auth/session.js";
import { emailService, isEmailConfigured } from "$lib/server/email/index.js";
import { emailVerificationTemplate } from "$lib/server/email/templates.js";
import { createUser } from "$lib/server/repositories/user.js";
import type { RequestHandler } from "./$types";

const registerSchema = z.object({
	email: z.string().email("Invalid email format"),
	name: z.string().min(1).max(50).optional(),
	password: z.string().min(6).max(100),
});

export const POST: RequestHandler = async (event) => {
	const { request, cookies, url } = event;
	try {
		const body = await request.json();
		const data = registerSchema.parse(body);

		const user = await createUser(data);
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
	} catch (error) {
		if (error instanceof z.ZodError) {
			return json(
				{ success: false, error: "Invalid input", details: error.errors },
				{ status: 400 },
			);
		}

		return json(
			{ success: false, error: "Registration failed" },
			{ status: 400 },
		);
	}
};
