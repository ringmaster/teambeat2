import { db } from '../db/index.js';
import { withTransaction } from '../db/transaction.js';
import { healthQuestions, healthResponses } from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export interface CreateHealthQuestionData {
  sceneId: string;
  question: string;
  description?: string;
  questionType: 'boolean' | 'range1to5' | 'agreetodisagree';
  seq: number;
}

export interface UpdateHealthQuestionData {
  question?: string;
  description?: string;
  questionType?: 'boolean' | 'range1to5' | 'agreetodisagree';
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
