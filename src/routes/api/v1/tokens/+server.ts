import { json } from "@sveltejs/kit";
import { z } from "zod";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import {
	createApiToken,
	listApiTokens,
	revokeApiToken,
} from "$lib/server/repositories/api-tokens.js";
import type { RequestHandler } from "./$types";

const createSchema = z.object({
	label: z.string().min(1, "label is required").max(100),
});

export const GET: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const tokens = await listApiTokens(user.userId);
		return json({ success: true, tokens });
	} catch (err) {
		if (err instanceof Response) return err as Response;
		return json({ success: false, error: "Failed to list tokens" }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const body = await event.request.json();
		const { label } = createSchema.parse(body);

		const result = await createApiToken(user.userId, label);
		return json(
			{ success: true, token: result.rawToken, tokenInfo: result.tokenInfo },
			{ status: 201 },
		);
	} catch (err) {
		if (err instanceof Response) return err as Response;
		if (err instanceof z.ZodError) {
			return json(
				{ success: false, error: "Invalid input", details: err.errors },
				{ status: 400 },
			);
		}
		return json({ success: false, error: "Failed to create token" }, { status: 500 });
	}
};
