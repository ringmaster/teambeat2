import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { createTimer, getTimer, deleteTimer, getRemainingTime, castExtensionVote, getExtensionVoteCounts } from '$lib/server/repositories/timer.js';
import { broadcastTimerUpdate } from '$lib/server/websockets/broadcast.js';
import { z } from 'zod';

const createTimerSchema = z.object({
	durationSeconds: z.number().int().min(60).max(7200) // 1 minute to 2 hours
});

const extensionVoteSchema = z.object({
	vote: z.enum(['done', 'more_time'])
});

export const GET: RequestHandler = async (event) => {
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
		
		const timer = await getRemainingTime(boardId);
		const extensionVotes = timer ? await getExtensionVoteCounts(boardId) : null;
		
		return json({
			success: true,
			timer,
			extensionVotes
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}
		
		return json(
			{ success: false, error: 'Failed to fetch timer' },
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const boardId = event.params.id;
		const body = await event.request.json();
		
		// Check if this is an extension vote
		if ('vote' in body) {
			const voteData = extensionVoteSchema.parse(body);
			
			const board = await getBoardWithDetails(boardId);
			if (!board) {
				return json(
					{ success: false, error: 'Board not found' },
					{ status: 404 }
				);
			}
			
			const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
			if (!userRole) {
				return json(
					{ success: false, error: 'Access denied' },
					{ status: 403 }
				);
			}
			
			await castExtensionVote(boardId, user.userId, voteData.vote);
			
			const timer = await getRemainingTime(boardId);
			const extensionVotes = await getExtensionVoteCounts(boardId);
			
			// Broadcast timer update with extension votes
			broadcastTimerUpdate(boardId, { timer, extensionVotes });
			
			return json({
				success: true,
				timer,
				extensionVotes
			});
		}
		
		// Otherwise, this is creating a new timer
		const data = createTimerSchema.parse(body);
		
		const board = await getBoardWithDetails(boardId);
		if (!board) {
			return json(
				{ success: false, error: 'Board not found' },
				{ status: 404 }
			);
		}
		
		// Check if user has permission to start timers
		const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
		if (!userRole || !['admin', 'facilitator'].includes(userRole)) {
			return json(
				{ success: false, error: 'Access denied' },
				{ status: 403 }
			);
		}
		
		const timer = await createTimer({
			boardId,
			durationSeconds: data.durationSeconds
		});
		
		const timerWithRemaining = await getRemainingTime(boardId);
		
		// Broadcast timer start to all clients
		broadcastTimerUpdate(boardId, { timer: timerWithRemaining, extensionVotes: { done: 0, moreTime: 0 } });
		
		return json({
			success: true,
			timer: timerWithRemaining
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}
		
		if (error instanceof z.ZodError) {
			return json(
				{ success: false, error: 'Invalid input', details: error.errors },
				{ status: 400 }
			);
		}
		
		return json(
			{ success: false, error: 'Failed to manage timer' },
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async (event) => {
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
		
		// Check if user has permission to stop timers
		const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
		if (!userRole || !['admin', 'facilitator'].includes(userRole)) {
			return json(
				{ success: false, error: 'Access denied' },
				{ status: 403 }
			);
		}
		
		await deleteTimer(boardId);
		
		// Broadcast timer stop to all clients
		broadcastTimerUpdate(boardId, { timer: null, extensionVotes: null });
		
		return json({
			success: true
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}
		
		return json(
			{ success: false, error: 'Failed to stop timer' },
			{ status: 500 }
		);
	}
};