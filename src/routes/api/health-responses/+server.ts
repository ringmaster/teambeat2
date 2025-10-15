import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { createOrUpdateHealthResponse } from '$lib/server/repositories/health.js';
import { findSceneById } from '$lib/server/repositories/scene.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { db } from '$lib/server/db/index.js';
import { healthQuestions, scenes } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const createResponseSchema = z.object({
  questionId: z.string(),
  rating: z.number().int().min(0).max(5)
});

export const POST: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const body = await event.request.json();
    const data = createResponseSchema.parse(body);

    // Get question and scene to verify access and check display mode
    const result = await db
      .select({
        question: healthQuestions,
        sceneDisplayMode: scenes.displayMode
      })
      .from(healthQuestions)
      .innerJoin(scenes, eq(healthQuestions.sceneId, scenes.id))
      .where(eq(healthQuestions.id, data.questionId))
      .limit(1);

    if (result.length === 0) {
      return json(
        { success: false, error: 'Question not found' },
        { status: 404 }
      );
    }

    const { question, sceneDisplayMode } = result[0];

    // Check if scene is in results mode - if so, reject new responses
    if (sceneDisplayMode === 'results') {
      return json(
        { success: false, error: 'Survey is in results mode, responses are locked' },
        { status: 403 }
      );
    }

    const scene = await findSceneById(question.sceneId);
    if (!scene) {
      return json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      );
    }

    // Check if user has access to the series
    const userRole = await getUserRoleInSeries(user.userId, scene.seriesId);
    if (!userRole) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Check that board is in draft or active state
    const board = await getBoardWithDetails(scene.boardId);
    if (!board || !['draft', 'active'].includes(board.status)) {
      return json(
        { success: false, error: 'Responses can only be submitted when board is draft or active' },
        { status: 400 }
      );
    }

    // Validate rating is appropriate for question type
    if (question.questionType === 'boolean' && ![0, 1].includes(data.rating)) {
      return json(
        { success: false, error: 'Boolean questions require rating of 0 or 1' },
        { status: 400 }
      );
    }

    if ((question.questionType === 'range1to5' || question.questionType === 'agreetodisagree') &&
        (data.rating < 1 || data.rating > 5)) {
      return json(
        { success: false, error: 'Range questions require rating between 1 and 5' },
        { status: 400 }
      );
    }

    if (question.questionType === 'redyellowgreen' && ![1, 3, 5].includes(data.rating)) {
      return json(
        { success: false, error: 'Red/Yellow/Green questions require rating of 1, 3, or 5' },
        { status: 400 }
      );
    }

    // Create or update response
    const response = await createOrUpdateHealthResponse({
      questionId: data.questionId,
      userId: user.userId,
      rating: data.rating
    });

    return json({
      success: true,
      response
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

    console.error('Failed to create health response:', error);
    return json(
      { success: false, error: 'Failed to create health response' },
      { status: 500 }
    );
  }
};
