import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserForApi } from '$lib/server/auth/index.js';
import { findSceneById } from '$lib/server/repositories/scene.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { getHealthQuestionsByScene } from '$lib/server/repositories/health.js';
import { db } from '$lib/server/db/index.js';
import { healthResponses, healthQuestions, scenes, boards } from '$lib/server/db/schema.js';
import { eq, and, inArray, desc } from 'drizzle-orm';

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

    // Get all questions for this scene
    const questions = await getHealthQuestionsByScene(sceneId);

    if (questions.length === 0) {
      return json({
        success: true,
        results: []
      });
    }

    const questionIds = questions.map(q => q.id);

    // Get all responses for these questions
    const responses = await db
      .select({
        questionId: healthResponses.questionId,
        rating: healthResponses.rating
      })
      .from(healthResponses)
      .where(inArray(healthResponses.questionId, questionIds));

    // Calculate statistics for each question
    const results = questions.map(question => {
      const questionResponses = responses.filter(r => r.questionId === question.id);
      const totalResponses = questionResponses.length;

      let average = 0;
      let distribution: { [key: number]: number } = {};

      if (totalResponses > 0) {
        const sum = questionResponses.reduce((acc, r) => acc + r.rating, 0);
        average = sum / totalResponses;

        // Count distribution
        for (const response of questionResponses) {
          distribution[response.rating] = (distribution[response.rating] || 0) + 1;
        }
      }

      return {
        question: {
          id: question.id,
          question: question.question,
          description: question.description,
          questionType: question.questionType,
          seq: question.seq
        },
        average,
        totalResponses,
        distribution
      };
    });

    // Sort by sequence
    results.sort((a, b) => a.question.seq - b.question.seq);

    return json({
      success: true,
      results
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error('Error getting health results:', error);
    return json(
      {
        success: false,
        error: 'Failed to get health results',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
};
