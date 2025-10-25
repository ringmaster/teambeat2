import { redirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import { getSessionFromCookie } from "$lib/server/repositories/session";
import { countUsers, searchUsers } from "$lib/server/repositories/user";
import type { PageServerLoad } from "./$types";

const ADMIN_USERS_PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ cookies, url }) => {
	// Get session
	const sessionCookie = cookies.get("session");
	if (!sessionCookie) {
		throw redirect(302, "/login");
	}

	const session = await getSessionFromCookie(sessionCookie);
	if (!session) {
		throw redirect(302, "/login");
	}

	// Check if user is admin
	const [user] = await db
		.select({ isAdmin: users.is_admin })
		.from(users)
		.where(eq(users.id, session.userId))
		.limit(1);

	if (!user?.isAdmin) {
		throw redirect(302, "/" as any);
	}

	// Parse query parameters
	const page = parseInt(url.searchParams.get("page") || "1", 10);
	const search = url.searchParams.get("search") || "";

	// Fetch users
	const usersList = await searchUsers(search, page, ADMIN_USERS_PAGE_SIZE);
	const totalCount = await countUsers(search);

	return {
		users: usersList,
		totalCount,
		page,
		pageSize: ADMIN_USERS_PAGE_SIZE,
		search,
	};
};
