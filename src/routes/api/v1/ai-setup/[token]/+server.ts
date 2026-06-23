import { json, text } from "@sveltejs/kit";
import { buildSetupData } from "../_setup.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	const data = await buildSetupData(event.params.token, event.url.origin);

	if (!data) {
		return json({ success: false, error: "Invalid or expired API access URL." }, { status: 401 });
	}

	return text(data.instructions, {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
};
