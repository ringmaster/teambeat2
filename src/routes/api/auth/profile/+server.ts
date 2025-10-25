import { json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "$lib/server/db";
import { users } from "$lib/server/db/schema";
import { getSessionFromCookie } from "$lib/server/repositories/session";
import type { RequestHandler } from "./$types";

const updateProfileSchema = z.object({
	name: z.string().optional(),
});

export const PATCH: RequestHandler = async ({ request, cookies }) => {
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
		const { name } = updateProfileSchema.parse(body);

		const updates: any = {};
		if (name !== undefined) {
			updates.name = name;
		}

		const [updatedUser] = await db
			.update(users)
			.set(updates)
			.where(eq(users.id, session.userId))
			.returning();

		return json({
			user: {
				id: updatedUser.id,
				email: updatedUser.email,
				name: updatedUser.name,
				role: updatedUser.role,
				isAdmin: updatedUser.is_admin || false,
				emailVerified: updatedUser.emailVerified || false,
			},
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return json({ error: "Invalid input" }, { status: 400 });
		}
		console.error("Failed to update profile:", error);
		return json({ error: "Failed to update profile" }, { status: 500 });
	}
};
