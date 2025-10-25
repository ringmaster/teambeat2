import { json } from "@sveltejs/kit";
import { generateEmailVerificationToken } from "$lib/server/auth/email-verification.js";
import { getUser } from "$lib/server/auth/index.js";
import { emailService, isEmailConfigured } from "$lib/server/email/index.js";
import { emailVerificationTemplate } from "$lib/server/email/templates.js";
import {
	ensureEmailVerificationSecret,
	findUserById,
} from "$lib/server/repositories/user.js";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async (event) => {
	if (!isEmailConfigured) {
		return json(
			{
				success: false,
				error: "Email not configured on this server",
			},
			{ status: 400 },
		);
	}

	const sessionUser = getUser(event);
	if (!sessionUser) {
		return json(
			{ success: false, error: "Not authenticated" },
			{ status: 401 },
		);
	}

	const user = await findUserById(sessionUser.userId);
	if (!user) {
		return json({ success: false, error: "User not found" }, { status: 404 });
	}

	if (user.emailVerified) {
		return json(
			{
				success: false,
				error: "Email already verified",
			},
			{ status: 400 },
		);
	}

	// Ensure the user has an emailVerificationSecret (generate if missing)
	const emailVerificationSecret = await ensureEmailVerificationSecret(user.id);

	const token = generateEmailVerificationToken(
		user.id,
		emailVerificationSecret,
	);
	const verifyUrl = `${event.url.origin}/verify-email?token=${token}`;
	const html = emailVerificationTemplate(verifyUrl, user.name || user.email);

	const result = await emailService.send({
		to: user.email,
		subject: "Verify your TeamBeat email address",
		html,
	});

	if (!result.success) {
		console.error("Failed to send verification email:", result.error);
		return json(
			{
				success: false,
				error: "Failed to send email",
			},
			{ status: 500 },
		);
	}

	return json({ success: true, message: "Verification email sent" });
};
