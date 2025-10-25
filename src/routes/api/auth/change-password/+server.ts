import { json } from "@sveltejs/kit";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import { getSessionFromCookie } from "$lib/server/repositories/session";
import type { RequestHandler } from "./$types";

const changePasswordSchema = z.object({
	currentPassword: z.string().min(1),
	newPassword: z.string().min(8),
});

export const POST: RequestHandler = async ({ request, cookies }) => {
	const sessionCookie = cookies.get("session");
	if (!sessionCookie) {
		return json({ error: "Unauthorized" }, { status: 401 });
	}

	const session = await getSessionFromCookie(sessionCookie);
	if (!session) {
		return json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { currentPassword, newPassword } = changePasswordSchema.parse(body);

		// Get current user
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, session.userId))
			.limit(1);

		if (!user) {
			return json({ error: "User not found" }, { status: 404 });
		}

		// Verify current password
		const validPassword = await bcrypt.compare(
			currentPassword,
			user.passwordHash,
		);
		if (!validPassword) {
			return json({ error: "Current password is incorrect" }, { status: 400 });
		}

		// Hash new password
		const passwordHash = await bcrypt.hash(newPassword, 10);

		// Update password
		await db
			.update(users)
			.set({ passwordHash })
			.where(eq(users.id, session.userId));

		return json({ success: true });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return json({ error: "Invalid input" }, { status: 400 });
		}
		console.error("Failed to change password:", error);
		return json({ error: "Failed to change password" }, { status: 500 });
	}
};
