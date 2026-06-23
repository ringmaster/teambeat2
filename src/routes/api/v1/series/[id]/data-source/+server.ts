import { json } from "@sveltejs/kit";
import { eq, desc } from "drizzle-orm";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { getUserRoleInSeries } from "$lib/server/repositories/board-series.js";
import { db } from "$lib/server/db/index.js";
import { boards } from "$lib/server/db/schema.js";
import { fanOutToSeries, getBoardDataset } from "$lib/server/repositories/board-dataset.js";
import { broadcastDataSourceUpdated } from "$lib/server/sse/broadcast.js";
import type { RequestHandler } from "./$types";

async function requireFacilitator(userId: string, seriesId: string) {
	const role = await getUserRoleInSeries(userId, seriesId);
	if (!role) return null;
	if (role !== "admin" && role !== "facilitator") return null;
	return role;
}

export const GET: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const seriesId = event.params.id;
		const role = await getUserRoleInSeries(user.userId, seriesId);
		if (!role) return json({ success: false, error: "Access denied" }, { status: 403 });

		const [latestBoard] = await db
			.select({ id: boards.id })
			.from(boards)
			.where(eq(boards.seriesId, seriesId))
			.orderBy(desc(boards.createdAt))
			.limit(1);

		if (!latestBoard) return json({ success: true, data: null, boardId: null });
		const dataset = await getBoardDataset(latestBoard.id);
		return json({
			success: true,
			data: dataset?.data ? JSON.parse(dataset.data) : null,
			boardId: latestBoard.id,
			updatedAt: dataset?.updatedAt,
		});
	} catch (err) {
		if (err instanceof Response) return err as Response;
		return json({ success: false, error: "Failed to fetch data source" }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const seriesId = event.params.id;
		const role = await requireFacilitator(user.userId, seriesId);
		if (!role) return json({ success: false, error: "Facilitator or admin required" }, { status: 403 });

		const body = await event.request.json();
		const count = await fanOutToSeries(seriesId, body, false, user.userId);

		const activeBoards = await db
			.select({ id: boards.id, status: boards.status })
			.from(boards)
			.where(eq(boards.seriesId, seriesId));
		for (const b of activeBoards.filter((b) => b.status === "draft" || b.status === "active")) {
			broadcastDataSourceUpdated(b.id);
		}

		return json({ success: true, boardsUpdated: count, updatedAt: new Date().toISOString() });
	} catch (err) {
		if (err instanceof Response) return err as Response;
		return json({ success: false, error: "Failed to update data source" }, { status: 500 });
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const seriesId = event.params.id;
		const role = await requireFacilitator(user.userId, seriesId);
		if (!role) return json({ success: false, error: "Facilitator or admin required" }, { status: 403 });

		const body = await event.request.json();
		const count = await fanOutToSeries(seriesId, body, true, user.userId);

		const activeBoards = await db
			.select({ id: boards.id, status: boards.status })
			.from(boards)
			.where(eq(boards.seriesId, seriesId));
		for (const b of activeBoards.filter((b) => b.status === "draft" || b.status === "active")) {
			broadcastDataSourceUpdated(b.id);
		}

		return json({ success: true, boardsUpdated: count, updatedAt: new Date().toISOString() });
	} catch (err) {
		if (err instanceof Response) return err as Response;
		return json({ success: false, error: "Failed to replace data source" }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const seriesId = event.params.id;
		const role = await requireFacilitator(user.userId, seriesId);
		if (!role) return json({ success: false, error: "Facilitator or admin required" }, { status: 403 });

		const count = await fanOutToSeries(seriesId, null, true, user.userId);
		return json({ success: true, boardsUpdated: count });
	} catch (err) {
		if (err instanceof Response) return err as Response;
		return json({ success: false, error: "Failed to clear data source" }, { status: 500 });
	}
};
