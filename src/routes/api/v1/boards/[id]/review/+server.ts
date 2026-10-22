import { json } from "@sveltejs/kit";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { getBoardSeriesForUser } from "$lib/server/api/v1-access.js";
import { reportApiError } from "$lib/server/api/report-error.js";
import { buildReviewScenesData } from "$lib/server/utils/review-data.js";
import type { ReviewViewMode } from "$lib/utils/review-markdown.js";
import type { RequestHandler } from "./$types";

const VIEW_MODES: ReviewViewMode[] = ["by-column", "by-votes"];

export const GET: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const boardId = event.params.id;

		const view = event.url.searchParams.get("view") ?? "by-column";
		if (!VIEW_MODES.includes(view as ReviewViewMode)) {
			return json(
				{ success: false, error: `view must be one of: ${VIEW_MODES.join(", ")}` },
				{ status: 400 },
			);
		}

		const access = await getBoardSeriesForUser(user.userId, boardId);
		if (access === "not_found")
			return json({ success: false, error: "Board not found" }, { status: 404 });
		if (access === "forbidden")
			return json({ success: false, error: "Access denied" }, { status: 403 });

		const scenes = await buildReviewScenesData(boardId, view as ReviewViewMode);
		if (!scenes) return json({ success: false, error: "Board not found" }, { status: 404 });

		return json({ success: true, scenes });
	} catch (err) {
		if (err instanceof Response) return err as Response;
		reportApiError("[v1 GET /boards/:id/review]", err);
		return json({ success: false, error: "Failed to fetch review scenes" }, { status: 500 });
	}
};
