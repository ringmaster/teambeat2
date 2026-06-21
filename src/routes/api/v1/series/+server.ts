import { json } from "@sveltejs/kit";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { findSeriesByUser } from "$lib/server/repositories/board-series.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const series = await findSeriesByUser(user.userId);
		return json({ success: true, series });
	} catch (err) {
		if (err instanceof Response) throw err;
		return json({ success: false, error: "Failed to fetch series" }, { status: 500 });
	}
};
