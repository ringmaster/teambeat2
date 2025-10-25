import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { boards } from '$lib/server/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { COLUMN_PRESETS } from '$lib/data/column-presets';
import { requireUserForApi } from '$lib/server/auth/index.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { handleApiError } from '$lib/server/api-utils.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
    try {
        const user = requireUserForApi(event);
        const boardId = event.params.id;

        // Get the board to find its series
        const board = await db.query.boards.findFirst({
            where: eq(boards.id, boardId)
        });

        if (!board) {
            return json({ error: 'Board not found' }, { status: 404 });
        }

        // Check if user is facilitator or admin
        const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
        if (!userRole || !['admin', 'facilitator'].includes(userRole)) {
            return json({ error: 'Forbidden - Admin or Facilitator access required' }, { status: 403 });
        }

        // Get all column descriptions from boards in the same series (excluding current board)
        const seriesBoards = await db.query.boards.findMany({
            where: and(
                eq(boards.seriesId, board.seriesId),
                ne(boards.id, boardId)
            ),
            with: {
                columns: true
            }
        });

        // Collect used descriptions
        const usedDescriptions = new Set<string>();
        for (const seriesBoard of seriesBoards) {
            for (const column of seriesBoard.columns) {
                if (column.description) {
                    usedDescriptions.add(column.description);
                }
            }
        }

        // Get Icebreaker presets and mark which are used
        const icebreakers = COLUMN_PRESETS['Icebreaker'] || [];
        const presetsWithUsage = icebreakers.map(preset => ({
            value: preset,
            used: usedDescriptions.has(preset)
        }));

        return json({ presets: presetsWithUsage });
    } catch (error) {
        return handleApiError(error, 'Failed to fetch column presets');
    }
};
