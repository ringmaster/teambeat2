/**
 * Scorecard Datasource Repository
 *
 * Data access layer for scorecard datasource operations.
 * Datasources define data collection and rules for a scorecard.
 */

import { db } from '../db/index.js';
import { scorecardDatasources } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { ScorecardRule } from '$lib/types/scorecard.js';

export interface CreateDatasourceData {
  scorecardId: string;
  name: string;
  sourceType: 'paste' | 'api';
  dataSchema?: string; // Already a JSON string from the UI
  rules: ScorecardRule[];
  apiConfig?: {
    url: string;
    auth_type: string;
    credentials_encrypted?: string;
  };
}

export async function createDatasource(data: CreateDatasourceData) {
  const id = uuidv4();
  const now = new Date().toISOString();

  // Get current max seq for this scorecard
  const existingDatasources = await db
    .select({ seq: scorecardDatasources.seq })
    .from(scorecardDatasources)
    .where(eq(scorecardDatasources.scorecardId, data.scorecardId))
    .orderBy(scorecardDatasources.seq);

  const maxSeq = existingDatasources.length > 0
    ? Math.max(...existingDatasources.map(d => d.seq))
    : 0;

  await db
    .insert(scorecardDatasources)
    .values({
      id,
      scorecardId: data.scorecardId,
      name: data.name,
      seq: maxSeq + 1,
      sourceType: data.sourceType,
      apiConfig: data.apiConfig ? JSON.stringify(data.apiConfig) : null,
      dataSchema: data.dataSchema || null, // Already a JSON string, don't stringify again
      rules: JSON.stringify(data.rules),
      createdAt: now,
      updatedAt: now
    });

  return await findDatasourceById(id);
}

export async function findDatasourceById(datasourceId: string) {
  const [datasource] = await db
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
    .where(eq(scorecardDatasources.id, datasourceId))
    .limit(1);

  return datasource;
}

export async function findDatasourcesByScorecard(scorecardId: string) {
  return await db
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
}

export interface UpdateDatasourceData {
  name?: string;
  dataSchema?: string; // Already a JSON string from the UI
  rules?: ScorecardRule[];
  apiConfig?: {
    url: string;
    auth_type: string;
    credentials_encrypted?: string;
  };
}

export async function updateDatasource(datasourceId: string, data: UpdateDatasourceData) {
  const updateData: any = {
    updatedAt: new Date().toISOString()
  };

  if (data.name !== undefined) {
    updateData.name = data.name;
  }

  if (data.dataSchema !== undefined) {
    updateData.dataSchema = data.dataSchema || null; // Already a JSON string, don't stringify again
  }

  if (data.rules !== undefined) {
    updateData.rules = JSON.stringify(data.rules);
  }

  if (data.apiConfig !== undefined) {
    updateData.apiConfig = data.apiConfig ? JSON.stringify(data.apiConfig) : null;
  }

  await db
    .update(scorecardDatasources)
    .set(updateData)
    .where(eq(scorecardDatasources.id, datasourceId));

  return await findDatasourceById(datasourceId);
}

export async function deleteDatasource(datasourceId: string) {
  // Get the datasource to know its scorecard and seq
  const datasource = await findDatasourceById(datasourceId);
  if (!datasource) {
    return;
  }

  // Delete the datasource
  await db
    .delete(scorecardDatasources)
    .where(eq(scorecardDatasources.id, datasourceId));

  // Reorder remaining datasources
  const remaining = await findDatasourcesByScorecard(datasource.scorecardId);
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].seq !== i + 1) {
      await db
        .update(scorecardDatasources)
        .set({ seq: i + 1, updatedAt: new Date().toISOString() })
        .where(eq(scorecardDatasources.id, remaining[i].id));
    }
  }
}

/**
 * Reorder datasources by providing an ordered array of IDs
 */
export async function reorderDatasources(scorecardId: string, datasourceIds: string[]) {
  for (let i = 0; i < datasourceIds.length; i++) {
    await db
      .update(scorecardDatasources)
      .set({ seq: i + 1, updatedAt: new Date().toISOString() })
      .where(eq(scorecardDatasources.id, datasourceIds[i]));
  }

  return await findDatasourcesByScorecard(scorecardId);
}
