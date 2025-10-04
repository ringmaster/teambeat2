/**
 * Scene Scorecard Repository
 *
 * Data access layer for scene scorecard operations.
 * Handles scorecard instances attached to scenes, data collection, and results.
 */

import { db } from '../db/index.js';
import { sceneScorecards, sceneScorecardResults, scorecardDatasources, cards, scorecards } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { ScorecardRule, ProcessedResult } from '$lib/types/scorecard.js';
import { processAllRules, type ProcessingError } from '../utils/scorecard-processor.js';

/**
 * Attach a scorecard to a scene
 */
export async function attachScorecardToScene(sceneId: string, scorecardId: string) {
  const id = uuidv4();
  const now = new Date().toISOString();

  await db
    .insert(sceneScorecards)
    .values({
      id,
      sceneId,
      scorecardId,
      collectedData: null,
      processedAt: null,
      createdAt: now
    });

  return await findSceneScorecardById(id);
}

/**
 * Find a scene scorecard by ID
 */
export async function findSceneScorecardById(sceneScorecardId: string) {
  const [sceneScorecard] = await db
    .select({
      id: sceneScorecards.id,
      sceneId: sceneScorecards.sceneId,
      scorecardId: sceneScorecards.scorecardId,
      collectedData: sceneScorecards.collectedData,
      processedAt: sceneScorecards.processedAt,
      createdAt: sceneScorecards.createdAt
    })
    .from(sceneScorecards)
    .where(eq(sceneScorecards.id, sceneScorecardId))
    .limit(1);

  return sceneScorecard;
}

/**
 * Find all scene scorecards for a scene
 */
export async function findSceneScorecardsByScene(sceneId: string) {
  const results = await db
    .select({
      id: sceneScorecards.id,
      sceneId: sceneScorecards.sceneId,
      scorecardId: sceneScorecards.scorecardId,
      collectedData: sceneScorecards.collectedData,
      processedAt: sceneScorecards.processedAt,
      createdAt: sceneScorecards.createdAt,
      scorecard: {
        id: scorecards.id,
        name: scorecards.name,
        description: scorecards.description
      }
    })
    .from(sceneScorecards)
    .innerJoin(scorecards, eq(sceneScorecards.scorecardId, scorecards.id))
    .where(eq(sceneScorecards.sceneId, sceneId));

  // Load datasources for each scorecard
  const sceneScorecardWithDatasources = await Promise.all(
    results.map(async (sceneScorecard) => {
      const datasources = await db
        .select({
          id: scorecardDatasources.id,
          scorecardId: scorecardDatasources.scorecardId,
          name: scorecardDatasources.name,
          sourceType: scorecardDatasources.sourceType,
          dataSchema: scorecardDatasources.dataSchema,
          rules: scorecardDatasources.rules,
          seq: scorecardDatasources.seq
        })
        .from(scorecardDatasources)
        .where(eq(scorecardDatasources.scorecardId, sceneScorecard.scorecardId))
        .orderBy(scorecardDatasources.seq);

      return {
        ...sceneScorecard,
        datasources
      };
    })
  );

  return sceneScorecardWithDatasources;
}

/**
 * Detach a scorecard from a scene
 */
export async function detachScorecardFromScene(sceneScorecardId: string) {
  // Delete results first (cascades via DB, but explicit is clearer)
  await db
    .delete(sceneScorecardResults)
    .where(eq(sceneScorecardResults.sceneScorecardId, sceneScorecardId));

  // Delete scene scorecard
  await db
    .delete(sceneScorecards)
    .where(eq(sceneScorecards.id, sceneScorecardId));
}

/**
 * Collect data for a scene scorecard and process rules
 */
export async function collectDataAndProcess(
  sceneScorecardId: string,
  datasourceData: Record<string, any>
) {
  const sceneScorecard = await findSceneScorecardById(sceneScorecardId);
  if (!sceneScorecard) {
    throw new Error('Scene scorecard not found');
  }

  // Get all datasources for this scorecard
  const datasources = await db
    .select({
      id: scorecardDatasources.id,
      name: scorecardDatasources.name,
      rules: scorecardDatasources.rules
    })
    .from(scorecardDatasources)
    .where(eq(scorecardDatasources.scorecardId, sceneScorecard.scorecardId))
    .orderBy(scorecardDatasources.seq);

  // Store collected data
  await db
    .update(sceneScorecards)
    .set({
      collectedData: JSON.stringify(datasourceData),
      processedAt: null // Clear processed timestamp until processing completes
    })
    .where(eq(sceneScorecards.id, sceneScorecardId));

  // Delete existing results
  await db
    .delete(sceneScorecardResults)
    .where(eq(sceneScorecardResults.sceneScorecardId, sceneScorecardId));

  // Process each datasource
  const allResults: ProcessedResult[] = [];
  const allErrors: Array<ProcessingError & { datasourceName: string }> = [];

  for (const datasource of datasources) {
    const data = datasourceData[datasource.id];
    if (!data) {
      console.warn(`No data provided for datasource ${datasource.id}`);
      continue;
    }

    // Parse rules
    const rules: ScorecardRule[] = JSON.parse(datasource.rules);

    // Process rules
    const { results, errors } = processAllRules(rules, data, datasource.id);
    allResults.push(...results.map(r => ({ ...r, datasourceId: datasource.id })));
    allErrors.push(...errors.map(e => ({ ...e, datasourceName: datasource.name })));
  }

  // Insert results into database
  for (const result of allResults) {
    await db
      .insert(sceneScorecardResults)
      .values({
        id: uuidv4(),
        sceneScorecardId,
        datasourceId: result.datasourceId!,
        section: result.section,
        title: result.title,
        primaryValue: result.primaryValue || null,
        secondaryValues: result.secondaryValues ? JSON.stringify(result.secondaryValues) : null,
        severity: result.severity,
        sourceData: result.sourceData ? JSON.stringify(result.sourceData) : null,
        seq: result.seq
      });
  }

  // Update processed timestamp
  const processedAt = new Date().toISOString();
  await db
    .update(sceneScorecards)
    .set({ processedAt })
    .where(eq(sceneScorecards.id, sceneScorecardId));

  return {
    processedAt,
    resultCount: allResults.length,
    errors: allErrors
  };
}

/**
 * Get results for a scene scorecard
 */
export async function getSceneScorecardResults(sceneScorecardId: string) {
  return await db
    .select({
      id: sceneScorecardResults.id,
      sceneScorecardId: sceneScorecardResults.sceneScorecardId,
      datasourceId: sceneScorecardResults.datasourceId,
      section: sceneScorecardResults.section,
      title: sceneScorecardResults.title,
      primaryValue: sceneScorecardResults.primaryValue,
      secondaryValues: sceneScorecardResults.secondaryValues,
      severity: sceneScorecardResults.severity,
      sourceData: sceneScorecardResults.sourceData,
      seq: sceneScorecardResults.seq
    })
    .from(sceneScorecardResults)
    .where(eq(sceneScorecardResults.sceneScorecardId, sceneScorecardId))
    .orderBy(sceneScorecardResults.section, sceneScorecardResults.seq);
}

/**
 * Flag a result for discussion by creating a card
 */
export async function flagResultForDiscussion(
  resultId: string,
  columnId: string,
  userId: string
) {
  // Get the result
  const [result] = await db
    .select({
      title: sceneScorecardResults.title,
      primaryValue: sceneScorecardResults.primaryValue,
      sourceData: sceneScorecardResults.sourceData
    })
    .from(sceneScorecardResults)
    .where(eq(sceneScorecardResults.id, resultId))
    .limit(1);

  if (!result) {
    throw new Error('Result not found');
  }

  // Create card content
  const cardContent = result.primaryValue
    ? `${result.title}\n${result.primaryValue}`
    : result.title;

  // Create the card
  const cardId = uuidv4();
  const now = new Date().toISOString();

  await db
    .insert(cards)
    .values({
      id: cardId,
      columnId,
      userId,
      content: cardContent,
      notes: result.sourceData || null,
      groupId: null,
      isGroupLead: false,
      createdAt: now,
      updatedAt: now
    });

  return { cardId, content: cardContent };
}
