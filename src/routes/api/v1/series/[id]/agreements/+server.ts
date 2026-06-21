import { json } from "@sveltejs/kit";
import { and, count, desc, eq } from "drizzle-orm";
import { requireApiV1Auth } from "$lib/server/auth/index.js";
import { requireSeriesMember } from "$lib/server/api/v1-access.js";
import { db } from "$lib/server/db/index.js";
import { agreements, boardSeries, boards, users } from "$lib/server/db/schema.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
	try {
		const user = await requireApiV1Auth(event);
		const seriesId = event.params.id;

		const [series] = await db
			.select({ id: boardSeries.id })
			.from(boardSeries)
			.where(eq(boardSeries.id, seriesId))
			.limit(1);
		if (!series) return json({ success: false, error: "Series not found" }, { status: 404 });

		const member = await requireSeriesMember(user.userId, seriesId);
		if (!member) return json({ success: false, error: "Access denied" }, { status: 403 });

		const url = event.url;
		const completedParam = url.searchParams.get("completed");
		const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 200);
		const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

		const completedFilter =
			completedParam === "true" ? true : completedParam === "false" ? false : null;

		// completedBy user join
		const completedByUser = {
			id: users.id,
			name: users.name,
		};

		const where = and(
			eq(boards.seriesId, seriesId),
			completedFilter !== null ? eq(agreements.completed, completedFilter) : undefined,
		);

		const [rows, [{ total }]] = await Promise.all([
			db
				.select({
					id: agreements.id,
					content: agreements.content,
					completed: agreements.completed,
					boardId: boards.id,
					boardName: boards.name,
					meetingDate: boards.meetingDate,
					createdAt: agreements.createdAt,
					completedAt: agreements.completedAt,
					completedByName: users.name,
				})
				.from(agreements)
				.innerJoin(boards, eq(boards.id, agreements.boardId))
				.leftJoin(users, eq(users.id, agreements.completedByUserId))
				.where(where)
				.orderBy(desc(boards.meetingDate), desc(agreements.createdAt))
				.limit(limit)
				.offset(offset),
			db
				.select({ total: count() })
				.from(agreements)
				.innerJoin(boards, eq(boards.id, agreements.boardId))
				.where(where),
		]);

		return json({
			success: true,
			agreements: rows,
			meta: { total, limit, offset },
		});
	} catch (err) {
		if (err instanceof Response) throw err;
		return json({ success: false, error: "Failed to fetch agreements" }, { status: 500 });
	}
};
