import { and, count, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { boardTimers, timerExtensionVotes } from "../db/schema.js";

export interface CreateTimerData {
	boardId: string;
	durationSeconds: number;
}

export async function createTimer(data: CreateTimerData) {
	const startedAt = Math.floor(Date.now() / 1000);

	// Delete any existing timer for this board
	await db.delete(boardTimers).where(eq(boardTimers.boardId, data.boardId));

	const [timer] = await db
		.insert(boardTimers)
		.values({
			boardId: data.boardId,
			durationSeconds: data.durationSeconds,
			startedAt,
		})
		.returning();

	return timer;
}

export async function getTimer(boardId: string) {
	const [timer] = await db
		.select()
		.from(boardTimers)
		.where(eq(boardTimers.boardId, boardId))
		.limit(1);

	return timer;
}

export async function deleteTimer(boardId: string) {
	await db.delete(boardTimers).where(eq(boardTimers.boardId, boardId));

	// Also delete any extension votes
	await db
		.delete(timerExtensionVotes)
		.where(eq(timerExtensionVotes.boardId, boardId));
}

export async function castExtensionVote(
	boardId: string,
	userId: string,
	vote: "done" | "more_time",
) {
	// Delete existing vote if any
	await db
		.delete(timerExtensionVotes)
		.where(
			and(
				eq(timerExtensionVotes.boardId, boardId),
				eq(timerExtensionVotes.userId, userId),
			),
		);

	// Cast new vote
	await db.insert(timerExtensionVotes).values({
		boardId,
		userId,
		vote,
	});
}

export async function getExtensionVotes(boardId: string) {
	const votes = await db
		.select()
		.from(timerExtensionVotes)
		.where(eq(timerExtensionVotes.boardId, boardId));

	return votes;
}

export async function getExtensionVoteCounts(boardId: string) {
	const [doneCount] = await db
		.select({ count: count() })
		.from(timerExtensionVotes)
		.where(
			and(
				eq(timerExtensionVotes.boardId, boardId),
				eq(timerExtensionVotes.vote, "done"),
			),
		);

	const [moreTimeCount] = await db
		.select({ count: count() })
		.from(timerExtensionVotes)
		.where(
			and(
				eq(timerExtensionVotes.boardId, boardId),
				eq(timerExtensionVotes.vote, "more_time"),
			),
		);

	return {
		done: doneCount.count,
		moreTime: moreTimeCount.count,
	};
}

export async function getRemainingTime(boardId: string) {
	const timer = await getTimer(boardId);
	if (!timer) return null;

	const now = Math.floor(Date.now() / 1000);
	const elapsed = now - timer.startedAt;
	const remaining = Math.max(0, timer.durationSeconds - elapsed);

	return {
		...timer,
		remainingSeconds: remaining,
		isExpired: remaining === 0,
	};
}
