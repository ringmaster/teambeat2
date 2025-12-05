import { json } from "@sveltejs/kit";
import { and, eq, ne } from "drizzle-orm";
import { COLUMN_PRESETS } from "$lib/data/column-presets";
import { handleApiError } from "$lib/server/api-utils.js";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { db } from "$lib/server/db";
import { boards } from "$lib/server/db/schema";
import { getUserRoleInSeries } from "$lib/server/repositories/board-series.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const boardId = event.params.id;

		// Get the column title from query param to filter presets
		const columnTitle = event.url.searchParams.get("columnTitle");

		// Get the board to find its series
		const board = await db.query.boards.findFirst({
			where: eq(boards.id, boardId),
		});

		if (!board) {
			return json({ error: "Board not found" }, { status: 404 });
		}

		// Check if user is facilitator or admin
		const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
		if (!userRole || !["admin", "facilitator"].includes(userRole)) {
			return json(
				{ error: "Forbidden - Admin or Facilitator access required" },
				{ status: 403 },
			);
		}

		// Get presets for the specified column title (if it exists in COLUMN_PRESETS)
		const presets = columnTitle ? COLUMN_PRESETS[columnTitle] || [] : [];

		// If no presets for this column, return empty array
		if (presets.length === 0) {
			return json({ presets: [] });
		}

		// Get all column descriptions from boards in the same series (excluding current board)
		const seriesBoards = await db.query.boards.findMany({
			where: and(eq(boards.seriesId, board.seriesId), ne(boards.id, boardId)),
			with: {
				columns: true,
			},
		});

		// Collect used descriptions
		const usedDescriptions = new Set<string>();
		for (const seriesBoard of seriesBoards) {
			for (const column of seriesBoard.columns) {
				if (column.description) {
					usedDescriptions.add(column.description);
				}
			}
		}

		// Mark which presets are used
		const presetsWithUsage = presets.map((preset) => ({
			value: preset,
			used: usedDescriptions.has(preset),
		}));

		return json({ presets: presetsWithUsage });
	} catch (error) {
		return handleApiError(error, "Failed to fetch column presets");
	}
};
