import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserForApi } from '$lib/server/auth/index.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import {
  updateHealthQuestion,
  deleteHealthQuestion,
  deleteResponsesForScene
} from '$lib/server/repositories/health.js';
import { findSceneById } from '$lib/server/repositories/scene.js';
import { db } from '$lib/server/db/index.js';
import { healthQuestions } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { broadcastSceneUpdated } from '$lib/server/sse/broadcast.js';
import { z } from 'zod';

const updateQuestionSchema = z.object({
  question: z.string().min(1).max(500).optional(),
  description: z.string().max(1000).optional(),
  questionType: z.enum(['boolean', 'range1to5', 'agreetodisagree', 'redyellowgreen']).optional()
});

export const PUT: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const questionId = event.params.questionId;
    const body = await event.request.json();
    const data = updateQuestionSchema.parse(body);

    // Get question to find scene and verify access
    const [question] = await db
      .select()
      .from(healthQuestions)
      .where(eq(healthQuestions.id, questionId))
      .limit(1);

    if (!question) {
      return json(
        { success: false, error: 'Question not found' },
        { status: 404 }
      );
    }

    const scene = await findSceneById(question.sceneId);
    if (!scene) {
      return json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      );
    }

    // Check if user has facilitator/admin access
    const userRole = await getUserRoleInSeries(user.userId, scene.seriesId);
    if (!userRole || !['admin', 'facilitator'].includes(userRole)) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Delete all responses for this scene (data loss on question modification)
    await deleteResponsesForScene(question.sceneId);

    // Update question
    const updatedQuestion = await updateHealthQuestion(questionId, data);

    // Broadcast scene update
    await broadcastSceneUpdated(scene.boardId, question.sceneId);

    return json({
      success: true,
      question: updatedQuestion
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

    console.error('Failed to update health question:', error);
    return json(
      { success: false, error: 'Failed to update health question' },
      { status: 500 }
    );
  }
};

export const DELETE: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const questionId = event.params.questionId;

    // Get question to find scene and verify access
    const [question] = await db
      .select()
      .from(healthQuestions)
      .where(eq(healthQuestions.id, questionId))
      .limit(1);

    if (!question) {
      return json(
        { success: false, error: 'Question not found' },
        { status: 404 }
      );
    }

    const scene = await findSceneById(question.sceneId);
    if (!scene) {
      return json(
        { success: false, error: 'Scene not found' },
        { status: 404 }
      );
    }

    // Check if user has facilitator/admin access
    const userRole = await getUserRoleInSeries(user.userId, scene.seriesId);
    if (!userRole || !['admin', 'facilitator'].includes(userRole)) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Delete all responses for this scene (data loss on question modification)
    await deleteResponsesForScene(question.sceneId);

    // Delete question (cascade will delete associated responses)
    await deleteHealthQuestion(questionId);

    // Broadcast scene update
    await broadcastSceneUpdated(scene.boardId, question.sceneId);

    return json({
      success: true
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error('Failed to delete health question:', error);
    return json(
      { success: false, error: 'Failed to delete health question' },
      { status: 500 }
    );
  }
};
