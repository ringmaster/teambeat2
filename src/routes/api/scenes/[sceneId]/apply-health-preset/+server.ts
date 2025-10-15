import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { findSceneById } from '$lib/server/repositories/scene.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import {
  applyHealthQuestionPreset,
  deleteResponsesForScene
} from '$lib/server/repositories/health.js';
import { broadcastSceneUpdated } from '$lib/server/sse/broadcast.js';
import { z } from 'zod';

const applyPresetSchema = z.object({
  presetId: z.string()
});

export const POST: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const sceneId = event.params.sceneId;
    const body = await event.request.json();
    const data = applyPresetSchema.parse(body);

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

    // Apply preset to create questions
    const questions = await applyHealthQuestionPreset(sceneId, data.presetId);

    // Broadcast scene update
    await broadcastSceneUpdated(scene.boardId, sceneId);

    return json({
      success: true,
      questions
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

    console.error('Failed to apply health question preset:', error);
    return json(
      { success: false, error: 'Failed to apply health question preset' },
      { status: 500 }
    );
  }
};
