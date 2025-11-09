/**
 * GET /api/admin/performance - Current performance metrics
 * POST /api/admin/performance/reset - Reset counters
 */

import { error, json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import { performanceTracker } from "$lib/server/performance/tracker";
import { featureTracker } from "$lib/server/analytics/feature-tracker";
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

	return session;
}

export const GET: RequestHandler = async ({ cookies, url }) => {
	await requireAdmin(cookies);

	// Parse time range parameter
	const range = url.searchParams.get("range") || "1h";
	const hours = (() => {
		switch (range) {
			case "5m":
				return 5 / 60;
			case "15m":
				return 15 / 60;
			case "1h":
				return 1;
			case "1d":
				return 24;
			case "1w":
				return 24 * 7;
			default:
				return 1;
		}
	})();

	const stats = performanceTracker.getStats();
	const featureStats = {
		overview: featureTracker.getStats(),
		recentActivity: featureTracker.getRecentEvents(50),
		usageByPeriod: featureTracker.getUsageByPeriod(hours),
		topUsers: featureTracker.getMostActiveUsers(10),
	};

	return json({
		...stats,
		featureAnalytics: featureStats,
		timeRange: range,
	});
};

export const POST: RequestHandler = async ({ cookies, request }) => {
	await requireAdmin(cookies);

	const { action } = await request.json();

	if (action === "reset") {
		performanceTracker.reset();
		featureTracker.reset();
		return json({ success: true });
	}

	throw error(400, "Invalid action");
};
