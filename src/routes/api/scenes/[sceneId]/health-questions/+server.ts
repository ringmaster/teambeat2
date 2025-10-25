import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserForApi } from '$lib/server/auth/index.js';
import { findSceneById } from '$lib/server/repositories/scene.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import {
  getHealthQuestionsByScene,
  createHealthQuestion,
  deleteResponsesForScene
} from '$lib/server/repositories/health.js';
import { broadcastSceneUpdated } from '$lib/server/sse/broadcast.js';
import { z } from 'zod';

const createQuestionSchema = z.object({
  question: z.string().min(1).max(500),
  description: z.string().max(1000).optional(),
  questionType: z.enum(['boolean', 'range1to5', 'agreetodisagree', 'redyellowgreen'])
});

export const GET: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const sceneId = event.params.sceneId;

    const scene = await findSceneById(sceneId);
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

    const questions = await getHealthQuestionsByScene(sceneId);

    return json({
      success: true,
      questions
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error('Failed to fetch health questions:', error);
    return json(
      { success: false, error: 'Failed to fetch health questions' },
      { status: 500 }
    );
  }
};

export const POST: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const sceneId = event.params.sceneId;
    const body = await event.request.json();
    const data = createQuestionSchema.parse(body);

    const scene = await findSceneById(sceneId);
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

    // Get current questions to determine next seq
    const existingQuestions = await getHealthQuestionsByScene(sceneId);
    const nextSeq = existingQuestions.length > 0
      ? Math.max(...existingQuestions.map(q => q.seq)) + 1
      : 1;

    // Delete all responses for this scene (data loss on question modification)
    await deleteResponsesForScene(sceneId);

    // Create new question
    const question = await createHealthQuestion({
      sceneId,
      question: data.question,
      description: data.description,
      questionType: data.questionType,
      seq: nextSeq
    });

    // Broadcast scene update
    await broadcastSceneUpdated(scene.boardId, sceneId);

    return json({
      success: true,
      question
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

    console.error('Failed to create health question:', error);
    return json(
      { success: false, error: 'Failed to create health question' },
      { status: 500 }
    );
  }
};
