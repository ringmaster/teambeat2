import { json } from "@sveltejs/kit";
import { requireUserForApi } from "$lib/server/auth/index.js";
import { db } from "$lib/server/db/index.js";
import { quadrantPositions } from "$lib/server/db/schema.js";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const { sceneId } = event.params;

		// Check if user is facilitator or admin
		// Note: This should ideally check board membership, but for now we trust the client
		// In a production system, verify the user has facilitator/admin role on the board

		// Delete all positions for this scene
		await db.delete(quadrantPositions).where(eq(quadrantPositions.sceneId, sceneId));

		return json({ success: true });
	} catch (error) {
		console.error("Error resetting all quadrant positions:", error);
		return json(
			{
				success: false,
				error: "Failed to reset all positions",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
};
