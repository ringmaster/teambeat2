import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { findSeriesById, getUserRoleInSeries, getSeriesMembers } from '$lib/server/repositories/board-series.js';
import { db } from '$lib/server/db/index.js';
import { boardSeries, seriesMembers, boards, columns, scenes, cards, votes, comments } from '$lib/server/db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export const GET: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const seriesId = event.params.id;
		
		const [series, userRole, members] = await Promise.all([
			findSeriesById(seriesId),
			getUserRoleInSeries(user.userId, seriesId),
			getSeriesMembers(seriesId)
		]);
		
		if (!series) {
			return json(
				{ success: false, error: 'Series not found' },
				{ status: 404 }
			);
		}
		
		if (!userRole) {
			return json(
				{ success: false, error: 'Access denied' },
				{ status: 403 }
			);
		}
		
		return json({
			success: true,
			series,
			userRole,
			members
		});
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}
		
		return json(
			{ success: false, error: 'Failed to fetch series details' },
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const user = requireUser(event);
		const seriesId = event.params.id;
		
		console.log(`Attempting to delete series: ${seriesId} by user: ${user.userId}`);
		
		// Check if user has admin role for this series
		const userRole = await getUserRoleInSeries(user.userId, seriesId);
		console.log(`User role in series: ${userRole}`);
		
		if (userRole !== 'admin') {
			return json(
				{ success: false, error: 'Only series administrators can delete series' },
				{ status: 403 }
			);
		}
		
		// Delete everything in a transaction to ensure data consistency
		await db.transaction((tx) => {
			console.log('Starting database transaction for series deletion');
			// Get all boards in this series
			const seriesBoards = tx
				.select({ id: boards.id })
				.from(boards)
				.where(eq(boards.seriesId, seriesId))
				.all();
			
			const boardIds = seriesBoards.map(b => b.id);
			console.log(`Found ${boardIds.length} boards to delete: ${boardIds}`);
			
			if (boardIds.length > 0) {
				// Get all columns for all boards
				const boardColumns = tx
					.select({ id: columns.id })
					.from(columns)
					.where(inArray(columns.boardId, boardIds))
					.all();
				
				const columnIds = boardColumns.map(c => c.id);
				
				if (columnIds.length > 0) {
					// Get all cards for all columns
					const boardCards = tx
						.select({ id: cards.id })
						.from(cards)
						.where(inArray(cards.columnId, columnIds))
						.all();
					
					const cardIds = boardCards.map(c => c.id);
					
					if (cardIds.length > 0) {
						// Delete votes for all cards
						tx.delete(votes).where(inArray(votes.cardId, cardIds)).run();
						
						// Delete comments for all cards
						tx.delete(comments).where(inArray(comments.cardId, cardIds)).run();
						
						// Delete all cards
						tx.delete(cards).where(inArray(cards.id, cardIds)).run();
					}
					
					// Delete all columns
					tx.delete(columns).where(inArray(columns.id, columnIds)).run();
				}
				
				// Delete all scenes for all boards
				tx.delete(scenes).where(inArray(scenes.boardId, boardIds)).run();
				
				// Delete all boards
				tx.delete(boards).where(inArray(boards.id, boardIds)).run();
			}
			
			// Delete series members
			tx.delete(seriesMembers).where(eq(seriesMembers.seriesId, seriesId)).run();
			
			// Delete the series itself
			tx.delete(boardSeries).where(eq(boardSeries.id, seriesId)).run();
		});
		
		console.log('Series deletion transaction completed successfully');
		return json({ success: true });
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}
		
		console.error('Failed to delete series:', error);
		
		// Provide detailed error information
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		const errorStack = error instanceof Error ? error.stack : 'No stack trace';
		
		console.error('Detailed error info:', {
			message: errorMessage,
			stack: errorStack,
			error: error
		});
		
		return json(
			{ 
				success: false, 
				error: 'Failed to delete series',
				details: errorMessage,
				type: error?.constructor?.name || 'Unknown'
			},
			{ status: 500 }
		);
	}
};