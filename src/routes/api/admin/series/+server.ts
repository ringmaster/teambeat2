import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllSeriesStats, deleteSeries, toggleAdminMembership } from '$lib/server/repositories/board-series';
import { getSessionFromCookie } from '$lib/server/repositories/session';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

async function requireAdmin(cookies: any) {
  const sessionCookie = cookies.get('session');
  if (!sessionCookie) {
    throw error(401, 'Unauthorized');
  }

  const session = await getSessionFromCookie(sessionCookie);
  if (!session) {
    throw error(401, 'Unauthorized');
  }

  const [user] = await db
    .select({ id: users.id, isAdmin: users.is_admin })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user?.isAdmin) {
    throw error(403, 'Admin access required');
  }

  return { session, userId: user.id };
}

export const GET: RequestHandler = async ({ cookies, url }) => {
  const { userId } = await requireAdmin(cookies);

  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') || '50', 10);

  const result = await getAllSeriesStats(userId, page, pageSize);
  return json(result);
};

export const DELETE: RequestHandler = async ({ cookies, request }) => {
  await requireAdmin(cookies);

  const { seriesId } = await request.json();

  if (!seriesId) {
    throw error(400, 'Series ID is required');
  }

  await deleteSeries(seriesId);

  return json({ success: true });
};

export const POST: RequestHandler = async ({ cookies, request }) => {
  const { userId } = await requireAdmin(cookies);

  const { action, seriesId } = await request.json();

  if (action === 'toggle_membership') {
    if (!seriesId) {
      throw error(400, 'Series ID is required');
    }

    const isMember = await toggleAdminMembership(seriesId, userId);

    return json({ success: true, isMember });
  }

  throw error(400, 'Invalid action');
};
