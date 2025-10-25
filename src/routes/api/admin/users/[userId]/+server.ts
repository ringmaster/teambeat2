import { error, json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "$lib/server/db/index.js";
import { users } from "$lib/server/db/schema.js";
import { getSessionFromCookie } from "$lib/server/repositories/session.js";
import { deleteUserById, findUserById } from "$lib/server/repositories/user.js";
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
		.select({ id: users.id, isAdmin: users.is_admin })
		.from(users)
		.where(eq(users.id, session.userId))
		.limit(1);

	if (!user?.isAdmin) {
		throw error(403, "Admin access required");
	}

	return { session, userId: user.id };
}

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const { userId: currentUserId } = await requireAdmin(cookies);
	const { userId } = params;

	if (!userId) {
		throw error(400, "User ID is required");
	}

	// Prevent self-deletion
	if (userId === currentUserId) {
		throw error(400, "Cannot delete your own account");
	}

	// Check if target user exists and is admin
	const targetUser = await findUserById(userId);
	if (!targetUser) {
		throw error(404, "User not found");
	}

	// Prevent deletion of other admin users
	if (targetUser.is_admin) {
		throw error(400, "Cannot delete admin users");
	}

	// Delete the user
	await deleteUserById(userId);

	return json({ success: true });
};
