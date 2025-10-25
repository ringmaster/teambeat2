import { error } from "@sveltejs/kit";
import { readFileSync } from "fs";
import { join } from "path";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	const { page } = params;

	// Sanitize the page parameter to prevent directory traversal
	const sanitizedPage = page.replace(/[^a-zA-Z0-9-_]/g, "");
	if (sanitizedPage !== page) {
		throw error(400, "Invalid page name");
	}

	try {
		// Try to read the HTML file from the static directory
		const filePath = join("static", `${sanitizedPage}.html`);
		const content = readFileSync(filePath, "utf-8");

		return {
			page: sanitizedPage,
			content,
			title: sanitizedPage.charAt(0).toUpperCase() + sanitizedPage.slice(1),
		};
	} catch {
		// If file doesn't exist, return 404
		throw error(404, `Page "${page}" not found`);
	}
};
