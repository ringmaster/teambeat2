import { json } from "@sveltejs/kit";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { deleteUserAuthenticator } from "$lib/server/auth/webauthn.js";
import type { RequestHandler } from "./$types";

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	try {
		// Require authenticated user
		const sessionUser = requireUserForApi({ cookies } as any);

		if (!sessionUser) {
			return json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id } = params;

		if (!id) {
			return json({ error: "Authenticator ID is required" }, { status: 400 });
		}

		// Delete the authenticator
		const deleted = await deleteUserAuthenticator(sessionUser.userId, id);

		if (deleted) {
			return json({ success: true });
		} else {
			return json(
				{ error: "Authenticator not found or could not be deleted" },
				{ status: 404 },
			);
		}
	} catch (error) {
		console.error("Failed to delete passkey:", error);
		return json({ error: "Failed to delete passkey" }, { status: 500 });
	}
};
