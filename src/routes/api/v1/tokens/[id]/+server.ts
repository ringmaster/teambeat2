import { json } from "@sveltejs/kit";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { revokeApiToken } from "$lib/server/repositories/api-tokens.js";
import type { RequestHandler } from "./$types";

export const DELETE: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const revoked = await revokeApiToken(event.params.id, user.userId);
		if (!revoked) {
			return json({ success: false, error: "Token not found" }, { status: 404 });
		}
		return json({ success: true });
	} catch (err) {
		if (err instanceof Response) throw err;
		return json({ success: false, error: "Failed to revoke token" }, { status: 500 });
	}
};
