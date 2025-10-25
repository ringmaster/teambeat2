import { json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import {
	cards,
	comments,
	seriesMembers,
	users,
	votes,
} from "$lib/server/db/schema";
import { getSessionFromCookie } from "$lib/server/repositories/session";
import type { RequestHandler } from "./$types";

export const DELETE: RequestHandler = async ({ cookies }) => {
	const sessionCookie = cookies.get("session");
	if (!sessionCookie) {
		return json({ error: "Unauthorized" }, { status: 401 });
	}

	const session = await getSessionFromCookie(sessionCookie);
	if (!session) {
		return json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		// Delete user - CASCADE DELETE handles votes, comments, cards, and series memberships
		await db.delete(users).where(eq(users.id, session.userId));

		// Clear the session cookie
		cookies.delete("session", { path: "/" });

		return json({ success: true });
	} catch (error) {
		console.error("Failed to delete account:", error);
		return json({ error: "Failed to delete account" }, { status: 500 });
	}
};
