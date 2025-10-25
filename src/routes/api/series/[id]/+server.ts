import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserForApi } from '$lib/server/auth/index.js';
import { findSeriesById, getUserRoleInSeries, getSeriesMembers } from '$lib/server/repositories/board-series.js';
import { db } from '$lib/server/db/index.js';
import { boardSeries, seriesMembers, boards, columns, scenes, cards, votes, comments } from '$lib/server/db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export const GET: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const seriesId = event.params.id;

    const [series, userRole, members] = await Promise.all([
      findSeriesById(seriesId),
      getUserRoleInSeries(user.userId, seriesId),
      getSeriesMembers(seriesId)
    ]);

    if (!series) {
      return json(
        { success: false, error: 'Series not found' },
        { status: 404 }
      );
    }

    if (!userRole) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    return json({
      success: true,
      series,
      userRole,
      members
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    return json(
      { success: false, error: 'Failed to fetch series details' },
      { status: 500 }
    );
  }
};

export const PUT: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const seriesId = event.params.id;
    const { name } = await event.request.json();

    // Validate name
    if (!name || typeof name !== 'string') {
      return json(
        { success: false, error: 'Series name is required' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      return json(
        { success: false, error: 'Series name must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Check if user has admin role for this series
    const userRole = await getUserRoleInSeries(user.userId, seriesId);

    if (userRole !== 'admin') {
      return json(
        { success: false, error: 'Only series administrators can rename series' },
        { status: 403 }
      );
    }

    // Update series name
    await db
      .update(boardSeries)
      .set({ name: trimmedName, updatedAt: new Date() })
      .where(eq(boardSeries.id, seriesId));

    return json({ success: true, name: trimmedName });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error('Failed to rename series:', error);

    return json(
      { success: false, error: 'Failed to rename series' },
      { status: 500 }
    );
  }
};

export const DELETE: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const seriesId = event.params.id;

    console.log(`Attempting to delete series: ${seriesId} by user: ${user.userId}`);

    // Check if user has admin role for this series
    const userRole = await getUserRoleInSeries(user.userId, seriesId);
    console.log(`User role in series: ${userRole}`);

    if (userRole !== 'admin') {
      return json(
        { success: false, error: 'Only series administrators can delete series' },
        { status: 403 }
      );
    }

    // Delete series - CASCADE DELETE handles all related records
    console.log('Deleting series and all related data via CASCADE DELETE');
    await db.delete(boardSeries).where(eq(boardSeries.id, seriesId));
    console.log('Series deletion completed successfully');
    return json({ success: true });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error('Failed to delete series:', error);

    // Provide detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';

    console.error('Detailed error info:', {
      message: errorMessage,
      stack: errorStack,
      error: error
    });

    return json(
      {
        success: false,
        error: 'Failed to delete series',
        details: errorMessage,
        type: error?.constructor?.name || 'Unknown'
      },
      { status: 500 }
    );
  }
};
