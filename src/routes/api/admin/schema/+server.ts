import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkSchemaConformance } from '$lib/server/db/schema-introspection';
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
    .select({ isAdmin: users.is_admin })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user?.isAdmin) {
    throw error(403, 'Admin access required');
  }

  return session;
}

export const GET: RequestHandler = async ({ cookies }) => {
  await requireAdmin(cookies);

  const result = await checkSchemaConformance();
  return json(result);
};
