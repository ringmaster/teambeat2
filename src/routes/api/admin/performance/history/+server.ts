/**
 * GET /api/admin/performance/history - Historical metrics from database
 */

import { error, json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import { metricsPersistence } from "$lib/server/performance/persistence";
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

	const startTime = parseInt(url.searchParams.get("start") || "0");
	const endTime = parseInt(url.searchParams.get("end") || String(Date.now()));

	const metrics = await metricsPersistence.getHistoricalMetrics(
		startTime,
		endTime,
	);
	return json(metrics);
};
