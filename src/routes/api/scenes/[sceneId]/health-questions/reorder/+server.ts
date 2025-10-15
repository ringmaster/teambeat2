import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { findSceneById } from '$lib/server/repositories/scene.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import {
  reorderHealthQuestions,
  deleteResponsesForScene
} from '$lib/server/repositories/health.js';
import { broadcastSceneUpdated } from '$lib/server/sse/broadcast.js';
import { z } from 'zod';

const reorderSchema = z.object({
  questionIds: z.array(z.string())
});

export const PUT: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const sceneId = event.params.sceneId;
    const body = await event.request.json();
    const { questionIds } = reorderSchema.parse(body);

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

    // Delete all responses for this scene (data loss on question modification)
    await deleteResponsesForScene(sceneId);

    // Reorder questions
    await reorderHealthQuestions(sceneId, questionIds);

    // Broadcast scene update
    await broadcastSceneUpdated(scene.boardId, sceneId);

    return json({
      success: true
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

    console.error('Failed to reorder health questions:', error);
    return json(
      { success: false, error: 'Failed to reorder health questions' },
      { status: 500 }
    );
  }
};
