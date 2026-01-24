/**
 * Server-side authentication check for connections admin page
 */

import { redirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import { getSessionFromCookie } from "$lib/server/repositories/session";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies }) => {
	const sessionCookie = cookies.get("session");
	if (!sessionCookie) {
		throw redirect(302, "/login");
	}

	const session = await getSessionFromCookie(sessionCookie);
	if (!session) {
		throw redirect(302, "/login");
	}

	const [user] = await db
		.select({ isAdmin: users.is_admin })
		.from(users)
		.where(eq(users.id, session.userId))
		.limit(1);

	if (!user?.isAdmin) {
		throw redirect(302, "/");
	}
};
