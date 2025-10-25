import { json } from "@sveltejs/kit";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { generatePasskeyRegistrationOptions } from "$lib/server/auth/webauthn.js";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		// Require authenticated user
		const sessionUser = requireUserForApi({ cookies } as any);

		if (!sessionUser) {
			return json({ error: "Unauthorized" }, { status: 401 });
		}

		// Get full user details for proper passkey registration
		const { findUserById } = await import("$lib/server/repositories/user.js");
		const user = await findUserById(sessionUser.userId);

		if (!user) {
			return json({ error: "User not found" }, { status: 404 });
		}

		// Generate registration options
		const options = await generatePasskeyRegistrationOptions(
			user.id,
			user.email,
			user.name || user.email,
			request,
		);

		return json(options);
	} catch (error) {
		console.error("WebAuthn registration begin error:", error);
		console.error("Error details:", error.message, error.stack);
		return json(
			{ error: "Failed to generate registration options" },
			{ status: 500 },
		);
	}
};
