import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserForApi } from '$lib/server/auth/index.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries, getSeriesMembers } from '$lib/server/repositories/board-series.js';
import { getHealthQuestionsByScene } from '$lib/server/repositories/health.js';
import { getBoardPresence } from '$lib/server/repositories/presence.js';
import { db } from '$lib/server/db/index.js';
import { healthResponses } from '$lib/server/db/schema.js';
import { inArray, and, eq } from 'drizzle-orm';

export const GET: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const boardId = event.params.id;
    const sceneId = event.params.sceneId;

    const board = await getBoardWithDetails(boardId);
    if (!board) {
      return json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      );
    }

    // Check if user has facilitator/admin permission
    const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!userRole || !['admin', 'facilitator'].includes(userRole)) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get all questions for this scene
    const questions = await getHealthQuestionsByScene(sceneId);
    const questionIds = questions.map(q => q.id);

    if (questionIds.length === 0) {
      return json({
        success: true,
        stats: {
          active_users_count: 0,
          active_users_completed: 0,
          total_expected_responses: 0
        }
      });
    }

    // Get active users for this board
    const presenceRecords = await getBoardPresence(boardId);
    const activeUserIds = presenceRecords.map(p => p.userId);

    // Get all series members for total expected responses
    const seriesMembers = await getSeriesMembers(board.seriesId);
    const totalExpectedResponses = seriesMembers.length;

    // For each active user, check if they have answered all questions
    let activeUsersCompleted = 0;

    if (activeUserIds.length > 0) {
      // Get all responses from active users for this scene's questions
      const responses = await db
        .select({
          userId: healthResponses.userId,
          questionId: healthResponses.questionId
        })
        .from(healthResponses)
        .where(
          and(
            inArray(healthResponses.userId, activeUserIds),
            inArray(healthResponses.questionId, questionIds)
          )
        );

      // Group responses by user
      const responsesByUser = new Map<string, Set<string>>();
      for (const response of responses) {
        if (!responsesByUser.has(response.userId)) {
          responsesByUser.set(response.userId, new Set());
        }
        responsesByUser.get(response.userId)!.add(response.questionId);
      }

      // Count users who have answered all questions
      for (const userId of activeUserIds) {
        const userResponses = responsesByUser.get(userId);
        if (userResponses && userResponses.size === questionIds.length) {
          activeUsersCompleted++;
        }
      }
    }

    return json({
      success: true,
      stats: {
        active_users_count: activeUserIds.length,
        active_users_completed: activeUsersCompleted,
        total_expected_responses: totalExpectedResponses
      }
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error('Error getting facilitator stats:', error);
    return json(
      {
        success: false,
        error: 'Failed to get facilitator stats',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
};
