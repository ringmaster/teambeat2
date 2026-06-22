import { json } from "@sveltejs/kit";
import { getTemplateForApi } from "$lib/server/templates.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
	const templates = getTemplateForApi();
	return json({ success: true, templates });
};
