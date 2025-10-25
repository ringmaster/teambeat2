/**
 * GET /api/admin/performance/timeseries - Time series data for charts
 */

import { error, json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import { metricsPersistence } from "$lib/server/performance/persistence";
import { performanceTracker } from "$lib/server/performance/tracker";
import { getSessionFromCookie } from "$lib/server/repositories/session";
import type { RequestHandler } from "./$types";

async function requireAdmin(cookies: any) {
	const sessionCookie = cookies.get("session");
	if (!sessionCookie) {
		throw error(401, "Unauthorized");
	}

	const session = await getSessionFromCookie(sessionCookie);
	if (!session) {
		throw error(401, "Unauthorized");
	}

	const [user] = await db
		.select({ isAdmin: users.is_admin })
		.from(users)
		.where(eq(users.id, session.userId))
		.limit(1);

	if (!user?.isAdmin) {
		throw error(403, "Admin access required");
	}
}

export const GET: RequestHandler = async ({ cookies, url }) => {
	await requireAdmin(cookies);

	const metric = url.searchParams.get("metric") || "all";
	const range = url.searchParams.get("range") || "1h";

	const now = Date.now();
	const rangeMs =
		range === "5m"
			? 5 * 60 * 1000
			: range === "15m"
				? 15 * 60 * 1000
				: range === "1h"
					? 60 * 60 * 1000
					: range === "1d"
						? 24 * 60 * 60 * 1000
						: range === "1w"
							? 7 * 24 * 60 * 60 * 1000
							: 60 * 60 * 1000; // default 1h
	const cutoff = now - rangeMs;

	let filtered: {
		concurrentUsers: Array<{ timestamp: number; value: number | null }>;
		messagesSent: Array<{ timestamp: number; value: number | null }>;
	};

	// Use in-memory data for short ranges, database for longer ranges
	if (range === "1d" || range === "1w") {
		// Query historical data from database
		const snapshots = await metricsPersistence.getHistoricalMetrics(
			cutoff,
			now,
		);

		// If we have data, use it; otherwise create data points with null to show the full range
		if (snapshots.length > 0) {
			filtered = {
				concurrentUsers: snapshots.map((s) => ({
					timestamp: s.timestamp,
					value: s.concurrent_users,
				})),
				messagesSent: snapshots.map((s) => ({
					timestamp: s.timestamp,
					value: s.messages_sent,
				})),
			};
		} else {
			// No data available, create start and end points with null to show missing data
			filtered = {
				concurrentUsers: [
					{ timestamp: cutoff, value: null },
					{ timestamp: now, value: null },
				],
				messagesSent: [
					{ timestamp: cutoff, value: null },
					{ timestamp: now, value: null },
				],
			};
		}

		// Pad the beginning with null if data doesn't start at cutoff (showing missing data)
		if (
			filtered.concurrentUsers.length > 0 &&
			filtered.concurrentUsers[0].timestamp > cutoff + 60000
		) {
			filtered.concurrentUsers.unshift({ timestamp: cutoff, value: null });
			filtered.messagesSent.unshift({ timestamp: cutoff, value: null });
		}
	} else {
		// Use in-memory time series data
		const timeSeries = performanceTracker.getTimeSeries();

		filtered = {
			concurrentUsers: timeSeries.concurrentUsers.filter(
				(s) => s.timestamp > cutoff,
			),
			messagesSent: timeSeries.messagesSent.filter((s) => s.timestamp > cutoff),
		};
	}

	// Return specific metric or all
	if (metric === "concurrentUsers") {
		return json(filtered.concurrentUsers);
	} else if (metric === "messagesSent") {
		return json(filtered.messagesSent);
	} else {
		return json(filtered);
	}
};
