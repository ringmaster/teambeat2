import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { findSceneById } from '$lib/server/repositories/scene.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { getHealthResponsesByUserAndScene } from '$lib/server/repositories/health.js';

export const GET: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
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

    const responses = await getHealthResponsesByUserAndScene(user.userId, sceneId);

    return json({
      success: true,
      responses
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error('Failed to fetch health responses:', error);
    return json(
      { success: false, error: 'Failed to fetch health responses' },
      { status: 500 }
    );
  }
};
