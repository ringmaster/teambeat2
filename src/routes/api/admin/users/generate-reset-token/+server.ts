import { error, json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { generatePasswordResetToken } from "$lib/server/auth/password-reset.js";
import { db } from "$lib/server/db/index.js";
import { users } from "$lib/server/db/schema.js";
import { getSessionFromCookie } from "$lib/server/repositories/session.js";
import { findUserById } from "$lib/server/repositories/user.js";
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

const generateResetTokenSchema = z.object({
	userId: z.string().min(1),
});

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	await requireAdmin(cookies);

	try {
		const body = await request.json();
		const { userId } = generateResetTokenSchema.parse(body);

		// Fetch the user
		const user = await findUserById(userId);
		if (!user) {
			throw error(404, "User not found");
		}

		// Generate the reset token
		const token = generatePasswordResetToken(user.id, user.passwordHash);

		// Build the reset URL
		const origin = url.origin;
		const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;

		return json({ success: true, resetUrl });
	} catch (err) {
		if (err instanceof z.ZodError) {
			throw error(400, "Invalid input");
		}
		throw err;
	}
};
