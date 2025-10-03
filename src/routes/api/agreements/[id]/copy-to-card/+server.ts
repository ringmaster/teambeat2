import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { findAgreementById } from '$lib/server/repositories/agreement.js';
import { createCard } from '$lib/server/repositories/card.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { broadcastCardCreated } from '$lib/server/sse/broadcast.js';
import { handleApiError } from '$lib/server/api-utils.js';
import { refreshPresenceOnBoardAction } from '$lib/server/middleware/presence.js';
import { enrichCardWithCounts } from '$lib/server/utils/cards-data.js';
import { z } from 'zod';

const copyToCardSchema = z.object({
  column_id: z.string().uuid()
});

export const POST: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const agreementId = event.params.id;
    const body = await event.request.json();
    const data = copyToCardSchema.parse(body);

    const agreement = await findAgreementById(agreementId);
    if (!agreement) {
      return json(
        { success: false, error: 'Agreement not found' },
        { status: 404 }
      );
    }

    await refreshPresenceOnBoardAction(event);

    const board = await getBoardWithDetails(agreement.boardId);
    if (!board) {
      return json(
        { success: false, error: 'Board not found' },
        { status: 404 }
      );
    }

    const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!userRole || (userRole !== 'admin' && userRole !== 'facilitator')) {
      return json(
        { success: false, error: 'Only facilitators and admins can copy agreements to cards' },
        { status: 403 }
      );
    }

    // Verify the column is visible in the current scene
    const currentScene = board.scenes.find(s => s.id === board.currentSceneId);
    if (!currentScene) {
      return json(
        { success: false, error: 'No active scene' },
        { status: 400 }
      );
    }

    const hiddenColumnIds = board.hiddenColumnsByScene?.[currentScene.id] || [];
    const visibleColumns = board.columns.filter(c => !hiddenColumnIds.includes(c.id)).map(c => c.id);

    if (!visibleColumns.includes(data.column_id)) {
      return json(
        { success: false, error: 'Column must be visible in current scene' },
        { status: 400 }
      );
    }

    // Create the card with agreement content
    const card = await createCard({
      columnId: data.column_id,
      userId: user.userId,
      content: agreement.content
    });

    const enrichedCard = await enrichCardWithCounts(card);

    // Broadcast the new card to all clients
    broadcastCardCreated(agreement.boardId, enrichedCard);

    return json({
      success: true,
      card: enrichedCard
    });
  } catch (error) {
    return handleApiError(error, 'Failed to copy agreement to card');
  }
};
