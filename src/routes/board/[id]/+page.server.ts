import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { boards, boardSeries } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getLastHealthCheckDate } from '$lib/server/repositories/health';
import { getScorecardCountsByBoard } from '$lib/server/repositories/scene-scorecard';

export const load: PageServerLoad = async ({ params }) => {
  try {
    // Get board data with series information
    const boardData = await db
      .select({
        id: boards.id,
        name: boards.name,
        status: boards.status,
        createdAt: boards.createdAt,
        seriesId: boards.seriesId,
        seriesName: boardSeries.name,
        seriesDescription: boardSeries.description
      })
      .from(boards)
      .leftJoin(boardSeries, eq(boards.seriesId, boardSeries.id))
      .where(eq(boards.id, params.id))
      .limit(1);

    if (!boardData.length) {
      throw error(404, 'Board not found');
    }

    const board = boardData[0];

    // Get the most recent health check date if this board is part of a series
    let lastHealthCheckDate: string | null = null;
    if (board.seriesId) {
      lastHealthCheckDate = await getLastHealthCheckDate(board.seriesId);
    }

    // Get scorecard counts by scene for this board
    const scorecardCountsByScene = await getScorecardCountsByBoard(params.id);

    // Create page title
    const pageTitle = board.seriesName
      ? `${board.name} - ${board.seriesName} - TeamBeat`
      : `${board.name} - TeamBeat`;

    // Create description for OpenGraph
    const description = board.seriesDescription ?
      `${board.seriesDescription} - Collaborative team meeting board` :
      'Collaborative team meetings for agile teams';

    return {
      board: {
        id: board.id,
        name: board.name,
        status: board.status,
        createdAt: board.createdAt,
        seriesId: board.seriesId,
        seriesName: board.seriesName,
        seriesDescription: board.seriesDescription
      },
      lastHealthCheckDate,
      scorecardCountsByScene,
      pageTitle,
      description
    };
  } catch (err) {
    console.error('Error loading board:', err);
    throw error(500, 'Failed to load board');
  }
};
