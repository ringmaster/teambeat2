import { and, count, desc, eq, like, lte, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/index.js";
import {
	boardSeries,
	boards,
	presence,
	seriesMembers,
	users,
} from "../db/schema.js";
import { withTransaction } from "../db/transaction.js";
import { shortCodeToSeriesIdPrefix } from "../../utils/short-codes.js";
import { findCurrentActiveBoard, findNextDraftBoard } from "./board.js";

export interface CreateSeriesData {
	name: string;
	slug?: string;
	description?: string;
	creatorId: string;
}

export async function createBoardSeries(data: CreateSeriesData) {
	const id = uuidv4();
	const baseSlug =
		data.slug || data.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
	const slug = `${baseSlug}-${id.substring(0, 8)}`;

	const series = {
		id,
		name: data.name,
		slug,
		description: data.description,
		createdAt: new Date().toISOString(),
	};

	// Use transaction wrapper - works with both PostgreSQL and SQLite
	return await withTransaction(async (tx) => {
		await tx.insert(boardSeries).values(series);
		await tx.insert(seriesMembers).values({
			seriesId: series.id,
			userId: data.creatorId,
			role: "admin",
		});
		return series;
	});
}

export async function findSeriesByUser(userId: string) {
	const result = await db
		.select({
			id: boardSeries.id,
			name: boardSeries.name,
			slug: boardSeries.slug,
			description: boardSeries.description,
			createdAt: boardSeries.createdAt,
			role: seriesMembers.role,
		})
		.from(boardSeries)
		.innerJoin(seriesMembers, eq(seriesMembers.seriesId, boardSeries.id))
		.where(eq(seriesMembers.userId, userId));

	return result;
}

export async function findSeriesWithBoardsByUser(userId: string) {
	const seriesResult = await findSeriesByUser(userId);

	// Get boards for each series
	const seriesWithBoards = await Promise.all(
		seriesResult.map(async (series) => {
			const seriesBoards = await db
				.select({
					id: boards.id,
					name: boards.name,
					status: boards.status,
					createdAt: boards.createdAt,
					updatedAt: boards.updatedAt,
					meetingDate: boards.meetingDate,
				})
				.from(boards)
				.where(eq(boards.seriesId, series.id))
				.orderBy(desc(boards.createdAt));

			// Filter draft boards based on user role
			// Non-admin/facilitator users can only see active and completed boards
			const filteredBoards = ["admin", "facilitator"].includes(series.role)
				? seriesBoards
				: seriesBoards.filter((board) => board.status !== "draft");

			// Compute current board IDs using repository functions
			const currentActiveBoard = await findCurrentActiveBoard(series.id);
			const nextDraftBoard = ["admin", "facilitator"].includes(series.role)
				? await findNextDraftBoard(series.id)
				: null;

			return {
				...series,
				boards: filteredBoards,
				currentBoardId: currentActiveBoard?.id || null,
				nextDraftBoardId: nextDraftBoard?.id || null,
			};
		}),
	);

	return seriesWithBoards;
}

export async function findSeriesById(seriesId: string) {
	const [series] = await db
		.select()
		.from(boardSeries)
		.where(eq(boardSeries.id, seriesId))
		.limit(1);

	return series;
}

export async function getUserRoleInSeries(userId: string, seriesId: string) {
	const [result] = await db
		.select({
			isAdmin: users.is_admin,
			role: seriesMembers.role,
		})
		.from(users)
		.leftJoin(
			seriesMembers,
			and(
				eq(seriesMembers.userId, users.id),
				eq(seriesMembers.seriesId, seriesId),
			),
		)
		.where(eq(users.id, userId))
		.limit(1);

	if (!result) return null;
	if (result.isAdmin) return "admin";
	return result.role || null;
}

export async function addSeriesMember(
	seriesId: string,
	userId: string,
	role: "admin" | "facilitator" | "member",
) {
	await db.insert(seriesMembers).values({
		seriesId,
		userId,
		role,
	});
}

export async function removeSeriesMember(seriesId: string, userId: string) {
	await db
		.delete(seriesMembers)
		.where(
			and(
				eq(seriesMembers.seriesId, seriesId),
				eq(seriesMembers.userId, userId),
			),
		);
}

export async function getSeriesMembers(seriesId: string) {
	const members = await db
		.select({
			userId: seriesMembers.userId,
			userName: users.name,
			email: users.email,
			role: seriesMembers.role,
			joinedAt: seriesMembers.joinedAt,
		})
		.from(seriesMembers)
		.innerJoin(users, eq(users.id, seriesMembers.userId))
		.where(eq(seriesMembers.seriesId, seriesId))
		.orderBy(seriesMembers.role, users.name);

	return members;
}

export async function addUserToSeries(
	seriesId: string,
	userId: string,
	role: "admin" | "facilitator" | "member",
) {
	await db.insert(seriesMembers).values({
		seriesId,
		userId,
		role,
		joinedAt: new Date().toISOString(),
	});
}

export async function removeUserFromSeries(seriesId: string, userId: string) {
	await db
		.delete(seriesMembers)
		.where(
			and(
				eq(seriesMembers.seriesId, seriesId),
				eq(seriesMembers.userId, userId),
			),
		);
}

export async function updateUserRoleInSeries(
	seriesId: string,
	userId: string,
	newRole: "admin" | "facilitator" | "member",
) {
	await db
		.update(seriesMembers)
		.set({ role: newRole })
		.where(
			and(
				eq(seriesMembers.seriesId, seriesId),
				eq(seriesMembers.userId, userId),
			),
		);
}

export async function hasActiveBoards(seriesId: string): Promise<boolean> {
	const [result] = await db
		.select({ id: boards.id })
		.from(boards)
		.where(and(eq(boards.seriesId, seriesId), eq(boards.status, "active")))
		.limit(1);

	return !!result;
}

export interface SeriesStats {
	id: string;
	name: string;
	slug: string | null;
	description: string | null;
	createdAt: string;
	userCount: number;
	boardCount: number;
	lastAccessTime: string | null;
	adminIsMember: boolean;
}

export async function getAllSeriesStats(
	adminUserId: string,
	page: number = 1,
	pageSize: number = 50,
): Promise<{
	series: SeriesStats[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}> {
	const offset = (page - 1) * pageSize;

	// Get total count
	const [countResult] = await db.select({ count: count() }).from(boardSeries);

	const total = countResult?.count || 0;
	const totalPages = Math.ceil(total / pageSize);

	// Get series with stats
	const seriesData = await db
		.select({
			id: boardSeries.id,
			name: boardSeries.name,
			slug: boardSeries.slug,
			description: boardSeries.description,
			createdAt: boardSeries.createdAt,
		})
		.from(boardSeries)
		.orderBy(desc(boardSeries.createdAt))
		.limit(pageSize)
		.offset(offset);

	// For each series, get stats
	const seriesStats: SeriesStats[] = await Promise.all(
		seriesData.map(async (series) => {
			// Get user count
			const [userCountResult] = await db
				.select({ count: count() })
				.from(seriesMembers)
				.where(eq(seriesMembers.seriesId, series.id));

			// Get board count
			const [boardCountResult] = await db
				.select({ count: count() })
				.from(boards)
				.where(eq(boards.seriesId, series.id));

			// Get last access time from presence table (exclude future dates)
			const now = Date.now();
			const [lastAccessResult] = await db
				.select({ lastSeen: presence.lastSeen })
				.from(presence)
				.innerJoin(boards, eq(boards.id, presence.boardId))
				.where(
					and(
						eq(boards.seriesId, series.id),
						lte(presence.lastSeen, now.toString()),
					),
				)
				.orderBy(desc(presence.lastSeen))
				.limit(1);

			// If no presence data, fall back to board updated_at
			let lastAccessTime: string | null = null;
			if (lastAccessResult?.lastSeen) {
				lastAccessTime = new Date(
					Number(lastAccessResult.lastSeen),
				).toISOString();
			} else {
				const [lastBoardUpdate] = await db
					.select({ updatedAt: boards.updatedAt })
					.from(boards)
					.where(
						and(
							eq(boards.seriesId, series.id),
							lte(boards.updatedAt, new Date().toISOString()),
						),
					)
					.orderBy(desc(boards.updatedAt))
					.limit(1);

				if (lastBoardUpdate?.updatedAt) {
					lastAccessTime = lastBoardUpdate.updatedAt;
				}
			}

			// Check if admin is a member
			const [membershipResult] = await db
				.select({ userId: seriesMembers.userId })
				.from(seriesMembers)
				.where(
					and(
						eq(seriesMembers.seriesId, series.id),
						eq(seriesMembers.userId, adminUserId),
					),
				)
				.limit(1);

			return {
				...series,
				userCount: userCountResult?.count || 0,
				boardCount: boardCountResult?.count || 0,
				lastAccessTime,
				adminIsMember: !!membershipResult,
			};
		}),
	);

	return {
		series: seriesStats,
		total,
		page,
		pageSize,
		totalPages,
	};
}

export async function deleteSeries(seriesId: string): Promise<void> {
	// Delete series - cascade will handle related data
	await db.delete(boardSeries).where(eq(boardSeries.id, seriesId));
}

export async function toggleAdminMembership(
	seriesId: string,
	adminUserId: string,
): Promise<boolean> {
	// Check if admin is already a member
	const [existingMembership] = await db
		.select({ role: seriesMembers.role })
		.from(seriesMembers)
		.where(
			and(
				eq(seriesMembers.seriesId, seriesId),
				eq(seriesMembers.userId, adminUserId),
			),
		)
		.limit(1);

	if (existingMembership) {
		// Remove membership
		await db
			.delete(seriesMembers)
			.where(
				and(
					eq(seriesMembers.seriesId, seriesId),
					eq(seriesMembers.userId, adminUserId),
				),
			);
		return false; // Now not a member
	} else {
		// Add membership as admin
		await db.insert(seriesMembers).values({
			seriesId,
			userId: adminUserId,
			role: "admin",
			joinedAt: new Date().toISOString(),
		});
		return true; // Now a member
	}
}

/**
 * Find a series by its short code.
 * Decodes the short code to a series ID prefix and searches for a match.
 */
export async function findSeriesByShortCode(shortCode: string) {
	try {
		const prefix = shortCodeToSeriesIdPrefix(shortCode);

		// UUIDs are stored with dashes, but we encoded without them
		// Need to match against the raw UUID format
		const [series] = await db
			.select({ id: boardSeries.id })
			.from(boardSeries)
			.where(
				like(
					sql`REPLACE(${boardSeries.id}, '-', '')`,
					`${prefix}%`,
				),
			)
			.limit(1);

		return series || null;
	} catch {
		// Invalid short code format
		return null;
	}
}
