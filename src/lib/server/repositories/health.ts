import { db } from '../db/index.js';
import { withTransaction } from '../db/transaction.js';
import { healthQuestions, healthResponses, scenes, boards } from '../db/schema.js';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getPresetById } from '$lib/presets/health-question-sets';

export interface CreateHealthQuestionData {
  sceneId: string;
  question: string;
  description?: string;
  questionType: 'boolean' | 'range1to5' | 'agreetodisagree' | 'redyellowgreen';
  seq: number;
}

export interface UpdateHealthQuestionData {
  question?: string;
  description?: string;
  questionType?: 'boolean' | 'range1to5' | 'agreetodisagree' | 'redyellowgreen';
}

export interface CreateHealthResponseData {
  questionId: string;
  userId: string;
  rating: number;
}

export async function createHealthQuestion(data: CreateHealthQuestionData) {
  const id = uuidv4();

  const [question] = await db
    .insert(healthQuestions)
    .values({
      id,
      ...data
    })
    .returning();

  return question;
}

export async function updateHealthQuestion(questionId: string, data: UpdateHealthQuestionData) {
  const [question] = await db
    .update(healthQuestions)
    .set(data)
    .where(eq(healthQuestions.id, questionId))
    .returning();

  return question;
}

export async function deleteHealthQuestion(questionId: string) {
  await db
    .delete(healthQuestions)
    .where(eq(healthQuestions.id, questionId));
}

export async function getHealthQuestionsByScene(sceneId: string) {
  const questions = await db
    .select()
    .from(healthQuestions)
    .where(eq(healthQuestions.sceneId, sceneId))
    .orderBy(healthQuestions.seq);

  return questions;
}

export async function reorderHealthQuestions(sceneId: string, questionIds: string[]) {
  return await withTransaction(async (tx) => {
    for (let i = 0; i < questionIds.length; i++) {
      await tx
        .update(healthQuestions)
        .set({ seq: i + 1 })
        .where(and(
          eq(healthQuestions.id, questionIds[i]),
          eq(healthQuestions.sceneId, sceneId)
        ));
    }
    return { success: true };
  });
}

export async function deleteResponsesForScene(sceneId: string) {
  // Get all question IDs for this scene
  const questions = await db
    .select({ id: healthQuestions.id })
    .from(healthQuestions)
    .where(eq(healthQuestions.sceneId, sceneId));

  if (questions.length === 0) {
    return;
  }

  const questionIds = questions.map(q => q.id);

  // Delete all responses for these questions
  await db
    .delete(healthResponses)
    .where(inArray(healthResponses.questionId, questionIds));
}

export async function createOrUpdateHealthResponse(data: CreateHealthResponseData) {
  const id = uuidv4();

  // Try to insert, if conflict on unique constraint (questionId, userId), update instead
  const [response] = await db
    .insert(healthResponses)
    .values({
      id,
      ...data
    })
    .onConflictDoUpdate({
      target: [healthResponses.questionId, healthResponses.userId],
      set: {
        rating: data.rating
      }
    })
    .returning();

  return response;
}

export async function getHealthResponsesByUserAndScene(userId: string, sceneId: string) {
  const responses = await db
    .select({
      id: healthResponses.id,
      questionId: healthResponses.questionId,
      userId: healthResponses.userId,
      rating: healthResponses.rating,
      createdAt: healthResponses.createdAt
    })
    .from(healthResponses)
    .innerJoin(healthQuestions, eq(healthResponses.questionId, healthQuestions.id))
    .where(and(
      eq(healthResponses.userId, userId),
      eq(healthQuestions.sceneId, sceneId)
    ));

  return responses;
}

/**
 * Apply a preset question set to a scene
 * Creates all questions from the preset and appends them to existing questions
 */
export async function applyHealthQuestionPreset(sceneId: string, presetId: string) {
  const preset = getPresetById(presetId);

  if (!preset) {
    throw new Error(`Preset not found: ${presetId}`);
  }

  return await withTransaction(async (tx) => {
    // Get existing questions to find the next seq value
    const existingQuestions = await tx
      .select()
      .from(healthQuestions)
      .where(eq(healthQuestions.sceneId, sceneId))
      .orderBy(healthQuestions.seq);

    const nextSeq = existingQuestions.length > 0
      ? Math.max(...existingQuestions.map(q => q.seq)) + 1
      : 1;

    // Create all questions from preset
    const createdQuestions = [];
    for (let i = 0; i < preset.questions.length; i++) {
      const presetQuestion = preset.questions[i];
      const id = uuidv4();

      const [question] = await tx
        .insert(healthQuestions)
        .values({
          id,
          sceneId,
          question: presetQuestion.question,
          description: presetQuestion.description,
          questionType: presetQuestion.questionType,
          seq: nextSeq + i
        })
        .returning();

      createdQuestions.push(question);
    }

    return createdQuestions;
  });
}

/**
 * Get the most recent health check timestamp for a series
 * Returns just the createdAt timestamp string, not full records
 */
export async function getLastHealthCheckDate(seriesId: string): Promise<string | null> {
  const result = await db
    .select({
      createdAt: healthResponses.createdAt
    })
    .from(healthResponses)
    .innerJoin(healthQuestions, eq(healthResponses.questionId, healthQuestions.id))
    .innerJoin(scenes, eq(healthQuestions.sceneId, scenes.id))
    .innerJoin(boards, eq(scenes.boardId, boards.id))
    .where(eq(boards.seriesId, seriesId))
    .orderBy(desc(healthResponses.createdAt))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return result[0].createdAt;
}
