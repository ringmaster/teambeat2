import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries, findSeriesByUser } from '$lib/server/repositories/board-series.js';
import { handleApiError } from '$lib/server/api-utils.js';
import { db } from '$lib/server/db/index.js';
import { boards, boardSeries } from '$lib/server/db/schema.js';
import { eq, and, or, inArray } from 'drizzle-orm';

export const GET: RequestHandler = async (event) => {
    try {
        const user = requireUser(event);
        const boardId = event.params.id;
        
        // Get current board to determine its series
        const currentBoard = await getBoardWithDetails(boardId);
        if (!currentBoard) {
            return json(
                { success: false, error: 'Board not found' },
                { status: 404 }
            );
        }
        
        // Check user has access to current board
        const userRole = await getUserRoleInSeries(user.userId, currentBoard.seriesId);
        if (!userRole) {
            return json(
                { success: false, error: 'Access denied' },
                { status: 403 }
            );
        }
        
        // Get all series the user has access to
        const userSeries = await findSeriesByUser(user.userId);
        const seriesIds = userSeries.map(s => s.id);
        
        // Get boards from current series (all statuses)
        const currentSeriesBoards = await db
            .select({
                id: boards.id,
                name: boards.name,
                status: boards.status,
                meetingDate: boards.meetingDate,
                createdAt: boards.createdAt,
                seriesName: boardSeries.name
            })
            .from(boards)
            .innerJoin(boardSeries, eq(boards.seriesId, boardSeries.id))
            .where(and(
                eq(boards.seriesId, currentBoard.seriesId),
                or(
                    eq(boards.status, 'completed'),
                    eq(boards.status, 'active'),
                    eq(boards.status, 'draft')
                )
            ))
            .orderBy(boards.createdAt);
        
        // Get latest active or completed board from each other series
        const otherSeriesBoards = await db
            .select({
                id: boards.id,
                name: boards.name,
                status: boards.status,
                meetingDate: boards.meetingDate,
                createdAt: boards.createdAt,
                seriesName: boardSeries.name,
                seriesId: boards.seriesId
            })
            .from(boards)
            .innerJoin(boardSeries, eq(boards.seriesId, boardSeries.id))
            .where(and(
                inArray(boards.seriesId, seriesIds),
                or(
                    eq(boards.status, 'completed'),
                    eq(boards.status, 'active')
                )
            ))
            .orderBy(boards.createdAt);
        
        // Filter to get latest board from each series (excluding current series)
        const latestFromOtherSeries = new Map();
        
        otherSeriesBoards.forEach(board => {
            if (board.seriesId !== currentBoard.seriesId) {
                const existing = latestFromOtherSeries.get(board.seriesId);
                if (!existing || new Date(board.createdAt) > new Date(existing.createdAt)) {
                    latestFromOtherSeries.set(board.seriesId, board);
                }
            }
        });
        
        // Filter out current board from current series boards
        const filteredCurrentSeriesBoards = currentSeriesBoards.filter(board => board.id !== boardId);
        
        return json({
            success: true,
            data: {
                currentSeries: filteredCurrentSeriesBoards,
                otherSeries: Array.from(latestFromOtherSeries.values())
            }
        });
    } catch (error) {
        return handleApiError(error, 'Failed to fetch clone sources');
    }
};