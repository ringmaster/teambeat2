import { json } from "@sveltejs/kit";
import { getTemplateList } from "$lib/server/templates.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
	const templates = getTemplateList();

	return json({
		success: true,
		templates,
	});
};
