import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async () => {
	return json(
		{ success: false, error: "This endpoint is not yet available" },
		{ status: 501 },
	);
};
