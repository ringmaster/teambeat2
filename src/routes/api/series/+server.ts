import { json } from "@sveltejs/kit";
import { z } from "zod";
import { requireUserForApi } from "$lib/server/auth/index.js";
import {
	createBoardSeries,
	findSeriesWithBoardsByUser,
} from "$lib/server/repositories/board-series.js";
import {
	canCreateResources,
	findUserById,
} from "$lib/server/repositories/user.js";
import type { RequestHandler } from "./$types";

const createSeriesSchema = z.object({
	name: z.string().min(1).max(100),
	slug: z.string().min(1).max(50).optional(),
	description: z.string().max(500).optional(),
});

export const GET: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const series = await findSeriesWithBoardsByUser(user.userId);

		return json({
			success: true,
			series,
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}

		return json(
			{ success: false, error: "Failed to fetch series" },
			{ status: 500 },
		);
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const sessionUser = requireUserForApi(event);
		const body = await event.request.json();
		const data = createSeriesSchema.parse(body);

		// Check email verification status
		const user = await findUserById(sessionUser.userId);
		if (!user) {
			return json({ success: false, error: "User not found" }, { status: 404 });
		}

		if (!canCreateResources(user)) {
			return json(
				{
					success: false,
					error:
						"Email verification required. Please check your email for a verification link.",
				},
				{ status: 403 },
			);
		}

		const series = await createBoardSeries({
			...data,
			creatorId: sessionUser.userId,
		});

		// Return the complete series data with role and boards (empty array for new series)
		const completeSeriesData = {
			...series,
			role: "admin", // Creator is always admin
			boards: [], // New series has no boards yet
		};

		return json({
			success: true,
			series: completeSeriesData,
		});
	} catch (error) {
		console.error("Series creation error:", error);

		if (error instanceof Response) {
			throw error;
		}

		if (error instanceof z.ZodError) {
			return json(
				{ success: false, error: "Invalid input", details: error.errors },
				{ status: 400 },
			);
		}

		return json(
			{ success: false, error: "Failed to create series" },
			{ status: 500 },
		);
	}
};
