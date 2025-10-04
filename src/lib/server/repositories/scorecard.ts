/**
 * Scorecard Repository
 *
 * Data access layer for scorecard operations.
 * Scorecards are series-scoped configurations for data-driven insights.
 */

import { db } from '../db/index.js';
import { scorecards, scorecardDatasources } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export interface CreateScorecardData {
  seriesId: string;
  name: string;
  description?: string;
  createdByUserId: string;
}

export async function createScorecard(data: CreateScorecardData) {
  const id = uuidv4();
  const now = new Date().toISOString();

  await db
    .insert(scorecards)
    .values({
      id,
      seriesId: data.seriesId,
      name: data.name,
      description: data.description || null,
      createdByUserId: data.createdByUserId,
      createdAt: now,
      updatedAt: now
    });

  return await findScorecardById(id);
}

export async function findScorecardById(scorecardId: string) {
  const [scorecard] = await db
    .select({
      id: scorecards.id,
      seriesId: scorecards.seriesId,
      name: scorecards.name,
      description: scorecards.description,
      createdByUserId: scorecards.createdByUserId,
      createdAt: scorecards.createdAt,
      updatedAt: scorecards.updatedAt
    })
    .from(scorecards)
    .where(eq(scorecards.id, scorecardId))
    .limit(1);

  return scorecard;
}

export async function findScorecardsBySeries(seriesId: string) {
  return await db
    .select({
      id: scorecards.id,
      seriesId: scorecards.seriesId,
      name: scorecards.name,
      description: scorecards.description,
      createdByUserId: scorecards.createdByUserId,
      createdAt: scorecards.createdAt,
      updatedAt: scorecards.updatedAt
    })
    .from(scorecards)
    .where(eq(scorecards.seriesId, seriesId))
    .orderBy(scorecards.name);
}

export interface UpdateScorecardData {
  name?: string;
  description?: string;
}

export async function updateScorecard(scorecardId: string, data: UpdateScorecardData) {
  const updateData: any = {
    updatedAt: new Date().toISOString(),
    ...data
  };

  // Only include fields that are provided
  if (data.description !== undefined) {
    updateData.description = data.description || null;
  }

  await db
    .update(scorecards)
    .set(updateData)
    .where(eq(scorecards.id, scorecardId));

  return await findScorecardById(scorecardId);
}

export async function deleteScorecard(scorecardId: string) {
  await db
    .delete(scorecards)
    .where(eq(scorecards.id, scorecardId));
}

/**
 * Get a scorecard with its datasources joined
 */
export async function getScorecardWithDatasources(scorecardId: string) {
  const scorecard = await findScorecardById(scorecardId);
  if (!scorecard) {
    return null;
  }

  const datasources = await db
    .select({
      id: scorecardDatasources.id,
      scorecardId: scorecardDatasources.scorecardId,
      name: scorecardDatasources.name,
      seq: scorecardDatasources.seq,
      sourceType: scorecardDatasources.sourceType,
      apiConfig: scorecardDatasources.apiConfig,
      dataSchema: scorecardDatasources.dataSchema,
      rules: scorecardDatasources.rules,
      createdAt: scorecardDatasources.createdAt,
      updatedAt: scorecardDatasources.updatedAt
    })
    .from(scorecardDatasources)
    .where(eq(scorecardDatasources.scorecardId, scorecardId))
    .orderBy(scorecardDatasources.seq);

  return {
    ...scorecard,
    datasources
  };
}
