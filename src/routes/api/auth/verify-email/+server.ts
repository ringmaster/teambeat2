import { json } from "@sveltejs/kit";
import { z } from "zod";
import { validateEmailVerificationToken } from "$lib/server/auth/email-verification.js";
import { markEmailVerified } from "$lib/server/repositories/user.js";
import type { RequestHandler } from "./$types";

const verifySchema = z.object({
	token: z.string(),
});

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const result = verifySchema.safeParse(body);

	if (!result.success) {
		return json({ success: false, error: "Invalid request" }, { status: 400 });
	}

	const validation = await validateEmailVerificationToken(result.data.token);

	if (!validation.valid) {
		return json(
			{
				success: false,
				error:
					validation.error === "Token expired"
						? "Verification link expired. Please request a new one."
						: "Invalid verification link.",
			},
			{ status: 400 },
		);
	}

	await markEmailVerified(validation.userId);

	return json({
		success: true,
		message: "Email verified successfully",
	});
};
