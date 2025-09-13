import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getUserAuthenticators } from '$lib/server/auth/webauthn.js';

export const GET: RequestHandler = async ({ cookies }) => {
  try {
    // Require authenticated user
    const sessionUser = requireUser({ cookies } as any);

    if (!sessionUser) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's authenticators
    const passkeys = await getUserAuthenticators(sessionUser.userId);

    return json({ passkeys });
  } catch (error) {
    console.error('Failed to get user passkeys:', error);
    return json({ error: 'Failed to get passkeys' }, { status: 500 });
  }
};
