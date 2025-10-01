import { db } from '../db/index.js';
import { cards, columns, votes, scenesColumns, scenes, users, comments } from '../db/schema.js';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { getBoardWithDetails } from '../repositories/board.js';
import { getUserDisplayName } from '../../utils/animalNames.js';

export interface PresentModeCard {
  id: string;
  columnId: string;
  userId: string | null;
  userName: string | null;
  content: string;
  notes: string | null;
  groupId: string | null;
  isGroupLead: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
  voteCount: number;
  userVoted: boolean;
}

export interface PresentModeComment {
  id: string;
  cardId: string;
  userId: string | null;
  userName: string | null;
  content: string;
  isAgreement: boolean | null;
  createdAt: string | null;
}

export interface PresentModeData {
  visible_cards: PresentModeCard[];
  selected_card: PresentModeCard | null;
  comments: PresentModeComment[];
  agreements: PresentModeComment[];
  scene_permissions: {
    allow_comments: boolean | null;
    allow_voting: boolean | null;
    allow_edit_cards: boolean | null;
    show_votes: boolean | null;
    show_comments: boolean | null;
  };
  notes_lock: {
    locked: boolean;
    locked_by: string | null;
  } | null;
}

/**
 * Builds complete present mode data including visible cards and selected card
 * This function is used by both API endpoints and SSE broadcasts
 */
export async function buildPresentModeData(
  boardId: string,
  userId: string
): Promise<PresentModeData> {
  // Get board and verify it exists
  const board = await getBoardWithDetails(boardId);
  if (!board) {
    throw new Error('Board not found');
  }

  // Get current scene
  if (!board.currentSceneId) {
    throw new Error('No current scene set for board');
  }

  const [currentScene] = await db
    .select()
    .from(scenes)
    .where(eq(scenes.id, board.currentSceneId));

  if (!currentScene) {
    throw new Error('Scene not found');
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
  let visibleCards: PresentModeCard[] = [];
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
      .groupBy(cards.id, cards.columnId, cards.userId, cards.content, cards.notes, cards.groupId, cards.isGroupLead, cards.createdAt, cards.updatedAt, users.name)
      .orderBy(sql`COUNT(${votes.id}) DESC`);

    // Check if user has voted on each card
    const userVotes = await db
      .select({ cardId: votes.cardId })
      .from(votes)
      .where(
        and(
          eq(votes.userId, userId),
          inArray(votes.cardId, cardsWithVotes.map(c => c.id))
        )
      );

    const userVotedCardIds = new Set(userVotes.map(v => v.cardId));

    const cardsWithUserVotes = cardsWithVotes.map((card) => ({
      ...card,
      userVoted: userVotedCardIds.has(card.id)
    }));

    // Group cards so child cards appear immediately after their lead cards
    visibleCards = [];
    const processedCardIds = new Set<string>();

    for (const card of cardsWithUserVotes) {
      if (processedCardIds.has(card.id)) continue;

      // Add the card (whether it's a lead card or ungrouped card)
      visibleCards.push(card);
      processedCardIds.add(card.id);

      // If this is a lead card, add its child cards immediately after it
      if (card.isGroupLead && card.groupId) {
        const childCards = cardsWithUserVotes.filter(
          c => c.groupId === card.groupId && !c.isGroupLead && !processedCardIds.has(c.id)
        );

        for (const childCard of childCards) {
          visibleCards.push(childCard);
          processedCardIds.add(childCard.id);
        }
      }
    }
  }

  // Get the selected card if any
  let selectedCard: PresentModeCard | null = null;
  if (currentScene.selectedCardId) {
    const selectedCardData = visibleCards.find(c => c.id === currentScene.selectedCardId);
    if (selectedCardData) {
      selectedCard = selectedCardData;

    }
  }

  // Get comments for selected card
  let cardComments: PresentModeComment[] = [];
  let cardAgreements: PresentModeComment[] = [];

  if (selectedCard) {
    const allComments = await db
      .select({
        id: comments.id,
        cardId: comments.cardId,
        userId: comments.userId,
        userName: users.name,
        content: comments.content,
        isAgreement: comments.isAgreement,
        createdAt: comments.createdAt
      })
      .from(comments)
      .leftJoin(users, eq(users.id, comments.userId))
      .where(eq(comments.cardId, selectedCard.id))
      .orderBy(sql`${comments.createdAt} DESC`);

    // Separate comments and agreements, applying blame-free mode if needed
    const blameFreeMode = board.blameFreeMode || false;

    cardComments = allComments
      .filter(c => !c.isAgreement)
      .map(c => ({
        ...c,
        userName: getUserDisplayName(
          c.userName || 'Anonymous',
          boardId,
          blameFreeMode
        )
      }));

    cardAgreements = allComments
      .filter(c => c.isAgreement)
      .map(c => ({
        ...c,
        userName: getUserDisplayName(
          c.userName || 'Anonymous',
          boardId,
          blameFreeMode
        )
      }));
  }

  // Get notes lock status for selected card if any
  let notesLock = null;
  if (selectedCard) {
    const { getNotesLock } = await import('../notes-lock.js');
    const lock = getNotesLock(selectedCard.id);
    if (lock) {
      notesLock = {
        locked: true,
        locked_by: lock.userName
      };

    } else {
      notesLock = {
        locked: false,
        locked_by: null
      };

    }
  }

  const result = {
    visible_cards: visibleCards,
    selected_card: selectedCard,
    comments: cardComments,
    agreements: cardAgreements,
    scene_permissions: {
      allow_comments: currentScene.allowComments || false,
      allow_voting: currentScene.allowVoting || false,
      allow_edit_cards: currentScene.allowEditCards || false,
      show_votes: currentScene.showVotes || false,
      show_comments: currentScene.showComments || false
    },
    notes_lock: notesLock
  };

  return result;
}
