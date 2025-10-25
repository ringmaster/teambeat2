import { json } from "@sveltejs/kit";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { getUserAuthenticators } from "$lib/server/auth/webauthn.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ cookies }) => {
	try {
		// Require authenticated user
		const sessionUser = requireUserForApi({ cookies } as any);

		if (!sessionUser) {
			return json({ error: "Unauthorized" }, { status: 401 });
		}

		// Get user's authenticators
		const passkeys = await getUserAuthenticators(sessionUser.userId);

		return json({ passkeys });
	} catch (error) {
		console.error("Failed to get user passkeys:", error);
		return json({ error: "Failed to get passkeys" }, { status: 500 });
	}
};
