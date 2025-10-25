import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUserForApi } from '$lib/server/auth/index.js';
import {
  findAgreementById,
  updateAgreement,
  deleteAgreement
} from '$lib/server/repositories/agreement.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { broadcastAgreementsUpdated } from '$lib/server/sse/broadcast.js';
import { handleApiError } from '$lib/server/api-utils.js';
import { refreshPresenceOnBoardAction } from '$lib/server/middleware/presence.js';
import { buildEnrichedAgreementsData } from '$lib/server/utils/agreements-data.js';
import { z } from 'zod';

const updateAgreementSchema = z.object({
  content: z.string().min(1).max(1000)
});

export const PUT: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const agreementId = event.params.id;
    const body = await event.request.json();
    const data = updateAgreementSchema.parse(body);

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
        { success: false, error: 'Only facilitators and admins can edit agreements' },
        { status: 403 }
      );
    }

    const updatedAgreement = await updateAgreement(agreementId, {
      content: data.content
    });

    // Broadcast updated agreements list to all clients
    const agreements = await buildEnrichedAgreementsData(agreement.boardId, board);
    broadcastAgreementsUpdated(agreement.boardId, agreements);

    return json({
      success: true,
      agreement: updatedAgreement
    });
  } catch (error) {
    return handleApiError(error, 'Failed to update agreement');
  }
};

export const DELETE: RequestHandler = async (event) => {
  try {
    const user = requireUserForApi(event);
    const agreementId = event.params.id;

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
        { success: false, error: 'Only facilitators and admins can delete agreements' },
        { status: 403 }
      );
    }

    await deleteAgreement(agreementId);

    // Broadcast updated agreements list to all clients
    const agreements = await buildEnrichedAgreementsData(agreement.boardId, board);
    broadcastAgreementsUpdated(agreement.boardId, agreements);

    return json({
      success: true
    });
  } catch (error) {
    return handleApiError(error, 'Failed to delete agreement');
  }
};
