import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { updatePresence } from '$lib/server/repositories/presence.js';

export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const boardId = event.params.id;

		const board = await getBoardWithDetails(boardId);
		if (!board) {
			return json(
				{ success: false, error: 'Board not found' },
				{ status: 404 }
			);
		}

		// Check if user has access to this board
		const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
		if (!userRole) {
			return json(
				{ success: false, error: 'Access denied' },
				{ status: 403 }
			);
		}

		// Update user presence to refresh their timeout
		await updatePresence(user.userId, boardId, 'pong');

		return json({
			success: true,
			timestamp: Date.now()
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}

		return json(
			{ success: false, error: 'Failed to update presence' },
			{ status: 500 }
		);
	}
};
