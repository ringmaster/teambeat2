import { error } from "@sveltejs/kit";
import { buildSetupData } from "../_setup.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, url }) => {
	const data = await buildSetupData(params.token, url.origin);
	if (!data) {
		error(401, "Invalid or expired API Access URL.");
	}
	return data;
};
