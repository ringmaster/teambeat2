import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { acquireNotesLock } from '$lib/server/notes-lock.js';

export const POST: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const { id: cardId } = event.params;

    const result = acquireNotesLock(cardId, user.userId, user.name || user.email);

    if (result.success) {
      return json({ success: true });
    } else {
      return json({
        success: false,
        locked_by: result.lockedBy,
        expires_at: result.expiresAt
      });
    }
  } catch (error) {
    console.error('Error acquiring notes lock:', error);
    return json(
      {
        success: false,
        error: 'Failed to acquire notes lock',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
};

export const DELETE: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const { id: cardId } = event.params;

    const { releaseNotesLock } = await import('$lib/server/notes-lock.js');
    const released = releaseNotesLock(cardId, user.userId);

    return json({ success: released });
  } catch (error) {
    console.error('Error releasing notes lock:', error);
    return json(
      {
        success: false,
        error: 'Failed to release notes lock',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
};
