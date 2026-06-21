import { json } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { getBoardSeriesForUser } from "$lib/server/api/v1-access.js";
import { db } from "$lib/server/db/index.js";
import { agreements, users } from "$lib/server/db/schema.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const boardId = event.params.id;

		const access = await getBoardSeriesForUser(user.userId, boardId);
		if (access === "not_found")
			return json({ success: false, error: "Board not found" }, { status: 404 });
		if (access === "forbidden")
			return json({ success: false, error: "Access denied" }, { status: 403 });

		const completedParam = event.url.searchParams.get("completed");
		const completedFilter =
			completedParam === "true" ? true : completedParam === "false" ? false : null;

		const result = await db
			.select({
				id: agreements.id,
				content: agreements.content,
				completed: agreements.completed,
				createdAt: agreements.createdAt,
				completedAt: agreements.completedAt,
				completedByName: users.name,
			})
			.from(agreements)
			.leftJoin(users, eq(users.id, agreements.completedByUserId))
			.where(
				and(
					eq(agreements.boardId, boardId),
					completedFilter !== null ? eq(agreements.completed, completedFilter) : undefined,
				),
			)
			.orderBy(agreements.createdAt);

		return json({ success: true, agreements: result });
	} catch (err) {
		if (err instanceof Response) throw err;
		return json({ success: false, error: "Failed to fetch agreements" }, { status: 500 });
	}
};
