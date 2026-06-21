/**
 * Access-check helpers for v1 API routes.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { boards, seriesMembers } from "../db/schema.js";

export async function requireSeriesMember(
	userId: string,
	seriesId: string,
): Promise<{ role: string } | null> {
	const [member] = await db
		.select({ role: seriesMembers.role })
		.from(seriesMembers)
		.where(and(eq(seriesMembers.userId, userId), eq(seriesMembers.seriesId, seriesId)))
		.limit(1);
	return member ?? null;
}

/**
 * Returns the seriesId for a board if the user is a member, null otherwise.
 * Returns undefined if the board doesn't exist.
 */
export async function getBoardSeriesForUser(
	userId: string,
	boardId: string,
): Promise<{ seriesId: string } | "not_found" | "forbidden"> {
	const [board] = await db
		.select({ seriesId: boards.seriesId })
		.from(boards)
		.where(eq(boards.id, boardId))
		.limit(1);

	if (!board) return "not_found";

	const member = await requireSeriesMember(userId, board.seriesId);
	if (!member) return "forbidden";

	return { seriesId: board.seriesId };
}
