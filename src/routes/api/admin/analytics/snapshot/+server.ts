import { error, json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import { featureTracker } from "$lib/server/analytics/feature-tracker.js";
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

/**
 * Manually trigger a feature analytics snapshot
 * This is safe to call multiple times - it only persists events that haven't been persisted yet
 */
export const POST: RequestHandler = async ({ cookies }) => {
	try {
		await requireAdmin(cookies);

		// Trigger snapshot
		await featureTracker.persistHourlyAggregates();

		return json({
			success: true,
			message: "Snapshot completed successfully",
		});
	} catch (error) {
		console.error("Failed to trigger snapshot:", error);
		return json(
			{
				success: false,
				error: "Failed to trigger snapshot",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
};
