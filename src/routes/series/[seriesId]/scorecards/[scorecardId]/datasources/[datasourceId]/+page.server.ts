import type { PageServerLoad } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
  const user = requireUser(event);
  const seriesId = event.params.seriesId;
  const scorecardId = event.params.scorecardId;
  const datasourceId = event.params.datasourceId;

  // Get user's role in this series
  const userRole = await getUserRoleInSeries(user.userId, seriesId);

  if (!userRole) {
    throw error(403, 'You do not have access to this series');
  }

  // Check if this is a new datasource or editing existing
  const isNew = datasourceId === 'new';

  return {
    seriesId,
    scorecardId,
    datasourceId: isNew ? undefined : datasourceId,
    isNew
  };
};
