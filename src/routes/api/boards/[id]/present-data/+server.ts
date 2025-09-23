import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth/index.js';
import { getBoardWithDetails } from '$lib/server/repositories/board.js';
import { getUserRoleInSeries } from '$lib/server/repositories/board-series.js';
import { db } from '$lib/server/db/index.js';
import { cards, columns, votes, scenesColumns, scenes, users } from '$lib/server/db/schema.js';
import { eq, and, inArray, sql } from 'drizzle-orm';

export const GET: RequestHandler = async (event) => {
  try {
    const user = requireUser(event);
    const { id: boardId } = event.params;

    // Get board and verify access
    const board = await getBoardWithDetails(boardId);
    if (!board) {
      return json({ success: false, error: 'Board not found' }, { status: 404 });
    }

    // Check if user has access to this board
    const userRole = await getUserRoleInSeries(user.userId, board.seriesId);
    if (!userRole) {
      return json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Get current scene
    if (!board.currentSceneId) {
      return json({ success: false, error: 'No current scene set for board' }, { status: 404 });
    }

    const [currentScene] = await db
      .select()
      .from(scenes)
      .where(eq(scenes.id, board.currentSceneId));
    if (!currentScene) {
      return json({ success: false, error: 'Scene not found' }, { status: 404 });
    }

    // Get all columns for this board
    const allColumns = await db
      .select({ id: columns.id })
      .from(columns)
      .where(eq(columns.boardId, boardId));

    // Get columns that are explicitly hidden in this scene
    const hiddenColumnSettings = await db
      .select({ columnId: scenesColumns.columnId })
      .from(scenesColumns)
      .where(
        and(
          eq(scenesColumns.sceneId, currentScene.id),
          eq(scenesColumns.state, 'hidden')
        )
      );

    const hiddenColumnIds = hiddenColumnSettings.map(s => s.columnId);
    const visibleColumnIds = allColumns
      .map(c => c.id)
      .filter(id => !hiddenColumnIds.includes(id));

    // Get cards from visible columns, sorted by vote count descending
    let visibleCards = [];
    if (visibleColumnIds.length > 0) {
      const cardsWithVotes = await db
        .select({
          id: cards.id,
          columnId: cards.columnId,
          userId: cards.userId,
          userName: users.name,
          content: cards.content,
          notes: cards.notes,
          groupId: cards.groupId,
          isGroupLead: cards.isGroupLead,
          createdAt: cards.createdAt,
          updatedAt: cards.updatedAt,
          voteCount: sql<number>`COUNT(${votes.id})`.as('vote_count')
        })
        .from(cards)
        .leftJoin(users, eq(users.id, cards.userId))
        .leftJoin(votes, eq(cards.id, votes.cardId))
        .where(inArray(cards.columnId, visibleColumnIds))
        .groupBy(cards.id)
        .orderBy(sql`COUNT(${votes.id}) DESC`);

      // Check if user has voted on each card
      const userVotes = await db
        .select({ cardId: votes.cardId })
        .from(votes)
        .where(
          and(
            eq(votes.userId, user.userId),
            inArray(votes.cardId, cardsWithVotes.map(c => c.id))
          )
        );

      const userVotedCardIds = new Set(userVotes.map(v => v.cardId));

      visibleCards = cardsWithVotes.map((card) => ({
        ...card,
        userVoted: userVotedCardIds.has(card.id)
      }));
    }

    // Get the selected card if any
    let selectedCard = null;
    if (currentScene.selectedCardId) {
      const selectedCardData = visibleCards.find(c => c.id === currentScene.selectedCardId);
      if (selectedCardData) {
        selectedCard = selectedCardData;
      }
    }

    return json({
      success: true,
      visible_cards: visibleCards,
      selected_card: selectedCard,
      current_user_role: userRole,
      scene_permissions: {
        allow_comments: currentScene.allowComments,
        allow_voting: currentScene.allowVoting,
        allow_edit_cards: currentScene.allowEditCards,
        show_votes: currentScene.showVotes,
        show_comments: currentScene.showComments
      }
    });
  } catch (error) {
    console.error('Error fetching present mode data:', error);
    return json(
      {
        success: false,
        error: 'Failed to fetch present mode data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
};
