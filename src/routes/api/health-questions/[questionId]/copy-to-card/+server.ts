import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { createCard } from '$lib/server/repositories/card.js';
import { broadcastCardCreated } from '$lib/server/sse/broadcast.js';
import { db } from '$lib/server/db/index.js';
import { healthQuestions, healthResponses, scenes, boards, columns } from '$lib/server/db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

const copyToCardSchema = z.object({
  column_id: z.string()
});

export const POST: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const questionId = event.params.questionId;
    const body = await event.request.json();
    const data = copyToCardSchema.parse(body);

    // Get question with scene and board info
    const questionData = await db
      .select({
        question: healthQuestions,
        boardId: boards.id,
        seriesId: boards.seriesId
      })
      .from(healthQuestions)
      .innerJoin(scenes, eq(healthQuestions.sceneId, scenes.id))
      .innerJoin(boards, eq(scenes.boardId, boards.id))
      .where(eq(healthQuestions.id, questionId))
      .limit(1);

    if (questionData.length === 0) {
      return json(
        { success: false, error: 'Question not found' },
        { status: 404 }
      );
    }

    const { question, boardId, seriesId } = questionData[0];

    // Check if user has facilitator/admin permission
    const userRole = await getUserRoleInSeries(user.userId, seriesId);
    if (!userRole || !['admin', 'facilitator'].includes(userRole)) {
      return json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Verify column belongs to the same board
    const [column] = await db
      .select()
      .from(columns)
      .where(eq(columns.id, data.column_id))
      .limit(1);

    if (!column) {
      return json(
        { success: false, error: 'Column not found' },
        { status: 404 }
      );
    }

    if (column.boardId !== boardId) {
      return json(
        { success: false, error: 'Column does not belong to this board' },
        { status: 400 }
      );
    }

    // Get responses for this question
    const responses = await db
      .select({
        rating: healthResponses.rating
      })
      .from(healthResponses)
      .where(eq(healthResponses.questionId, questionId));

    // Calculate statistics
    const totalResponses = responses.length;
    let average = 0;
    let distribution: { [key: number]: number } = {};

    if (totalResponses > 0) {
      const sum = responses.reduce((acc, r) => acc + r.rating, 0);
      average = sum / totalResponses;

      // Count distribution
      for (const response of responses) {
        distribution[response.rating] = (distribution[response.rating] || 0) + 1;
      }
    }

    // Format card content based on question type
    let distributionText = '';
    if (question.questionType === 'redyellowgreen') {
      const red = distribution[1] || 0;
      const yellow = distribution[3] || 0;
      const green = distribution[5] || 0;
      distributionText = `🔴 Red: ${red} | 🟡 Yellow: ${yellow} | 🟢 Green: ${green}`;
    } else if (question.questionType === 'boolean') {
      const no = distribution[0] || 0;
      const yes = distribution[1] || 0;
      distributionText = `No: ${no} | Yes: ${yes}`;
    } else if (question.questionType === 'agreetodisagree') {
      distributionText = Object.keys(distribution)
        .sort()
        .map(rating => `${rating}: ${distribution[Number(rating)]}`)
        .join(' | ');
    } else {
      // range1to5
      distributionText = Object.keys(distribution)
        .sort()
        .map(rating => `${rating}: ${distribution[Number(rating)]}`)
        .join(' | ');
    }

    const cardContent = `**${question.question}**

${question.description ? `_${question.description}_\n\n` : ''}**Average:** ${average.toFixed(2)} (${totalResponses} response${totalResponses !== 1 ? 's' : ''})

**Distribution:** ${distributionText}`;

    // Create the card
    const card = await createCard({
      columnId: data.column_id,
      userId: user.userId,
      content: cardContent
    });

    // Broadcast card creation
    await broadcastCardCreated(boardId, card);

    return json({
      success: true,
      card
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    if (error instanceof z.ZodError) {
      return json(
        { success: false, error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error copying question to card:', error);
    return json(
      {
        success: false,
        error: 'Failed to copy question to card',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
};
