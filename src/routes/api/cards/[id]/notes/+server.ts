import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { db } from '$lib/server/db';
import { cards } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { releaseNotesLock } from '$lib/server/notes-lock.js';

export const PUT: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const { id: cardId } = event.params;
    const { content } = await event.request.json();

    // Update the card notes
    const [updated] = await db
      .update(cards)
      .set({ notes: content })
      .where(eq(cards.id, cardId))
      .returning();

    if (!updated) {
      return json({ success: false, error: 'Card not found' }, { status: 404 });
    }

    // Release the lock after saving
    releaseNotesLock(cardId, user.userId);

    // TODO: Broadcast notes updated event if needed

    return json({
      success: true,
      notes: updated.notes
    });
  } catch (error) {
    console.error('Error updating card notes:', error);
    return json(
      {
        success: false,
        error: 'Failed to update notes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
};
