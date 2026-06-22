import { json } from "@sveltejs/kit";
import { getTemplateForApi } from "$lib/server/templates.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
	const results = getTemplateForApi(params.id);
	if (results.length === 0) {
		return json({ success: false, error: "Template not found" }, { status: 404 });
	}
	return json({ success: true, template: results[0] });
};
