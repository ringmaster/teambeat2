import { json } from "@sveltejs/kit";
import { z } from "zod";
import { requireUserForApi } from "$lib/server/auth/index.js";
import {
	createBoard,
	findBoardsByUser,
} from "$lib/server/repositories/board.js";
import {
	addUserToSeries,
	getUserRoleInSeries,
} from "$lib/server/repositories/board-series.js";
import {
	canCreateResources,
	findUserById,
} from "$lib/server/repositories/user.js";
import type { RequestHandler } from "./$types";

const createBoardSchema = z.object({
	name: z.string().min(1).max(100),
	seriesId: z.string().uuid(),
	meetingDate: z.string().optional(),
	blameFreeMode: z.boolean().optional(),
	votingAllocation: z.number().int().min(0).max(10).optional(),
});

export const GET: RequestHandler = async (event) => {
	try {
		const user = requireUserForApi(event);
		const boards = await findBoardsByUser(user.userId);

		return json({
			success: true,
			boards,
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}

		return json(
			{ success: false, error: "Failed to fetch boards" },
			{ status: 500 },
		);
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const sessionUser = requireUserForApi(event);
		const body = await event.request.json();
		const data = createBoardSchema.parse(body);

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

		// Check if user has access to this series, auto-add if not
		let userRole = await getUserRoleInSeries(sessionUser.userId, data.seriesId);
		if (!userRole) {
			// Auto-add user as member when they create a board in a series
			await addUserToSeries(data.seriesId, sessionUser.userId, "member");
			userRole = "member";
		}

		const board = await createBoard(data);

		return json({
			success: true,
			board,
		});
	} catch (error) {
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
			{ success: false, error: "Failed to create board" },
			{ status: 500 },
		);
	}
};
