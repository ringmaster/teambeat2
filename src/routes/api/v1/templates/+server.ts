import { json } from "@sveltejs/kit";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { BOARD_TEMPLATES } from "$lib/server/templates.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		await requireApiV1Auth(event);

		const templates = Object.values(BOARD_TEMPLATES).map((t) => ({
			id: t.id,
			name: t.name,
			description: t.description,
			columns: t.columns.map((c) => ({ title: c.title, description: c.description ?? null })),
			scenes: t.scenes.map((s) => ({ title: s.title, mode: s.mode, seq: s.seq })),
		}));

		return json({ success: true, templates });
	} catch (err) {
		if (err instanceof Response) return err as Response;
		return json({ success: false, error: "Failed to fetch templates" }, { status: 500 });
	}
};
