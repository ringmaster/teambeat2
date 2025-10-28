import { buildAllCardsData } from "../utils/cards-data.js";
import { buildPresenceData } from "../utils/presence-data.js";
import { buildVotingStatsUpdatedMessage } from "../utils/voting-data.js";
import type { SSEMessage } from "./manager.js";
import { sseManager } from "./manager.js";

export function broadcastToBoardUsers(boardId: string, message: SSEMessage) {
  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastCardCreated(boardId: string, card: any) {
  const message: SSEMessage = {
    type: "card_created",
    board_id: boardId,
    card,
    timestamp: Date.now(),
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastCardUpdated(boardId: string, card: any) {
  const message: SSEMessage = {
    type: "card_updated",
    board_id: boardId,
    card,
    timestamp: Date.now(),
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastCardDeleted(boardId: string, cardId: string) {
  const message: SSEMessage = {
    type: "card_deleted",
    board_id: boardId,
    card_id: cardId,
    timestamp: Date.now(),
  };

  sseManager.broadcastToBoard(boardId, message);
}

export async function broadcastVoteChanged(
  boardId: string,
  cardId: string,
  voteCount: number,
  _userId?: string,
) {
  try {
    const message: SSEMessage = {
      type: "vote_changed",
      board_id: boardId,
      card_id: cardId,
      vote_count: voteCount,
      timestamp: Date.now(),
    };
    sseManager.broadcastToBoard(boardId, message);
  } catch (error) {
    console.error("Failed to broadcast vote changed:", error);
    throw error;
  }
}

export async function broadcastVoteChangedToUser(
  boardId: string,
  cardId: string,
  voteCount: number,
  userId: string,
) {
  try {
    const message: SSEMessage = {
      type: "vote_changed",
      board_id: boardId,
      card_id: cardId,
      vote_count: voteCount,
      user_id: userId,
      timestamp: Date.now(),
    };
    sseManager.broadcastToUser(boardId, userId, message);
  } catch (error) {
    console.error("Failed to broadcast vote changed to user:", error);
    throw error;
  }
}

export function broadcastCommentAdded(boardId: string, comment: any) {
  const message: SSEMessage = {
    type: "comment_added",
    board_id: boardId,
    comment,
    timestamp: Date.now(),
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastBoardUpdated(boardId: string, board: any) {
  const message: SSEMessage = {
    type: "board_updated",
    board_id: boardId,
    board,
    timestamp: Date.now(),
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastColumnsUpdated(boardId: string, columns: any[]) {
  const message: SSEMessage = {
    type: "columns_updated",
    board_id: boardId,
    columns,
    timestamp: Date.now(),
  };

  sseManager.broadcastToBoard(boardId, message);
}

export async function broadcastSceneChanged(boardId: string, sceneData: any) {
  try {
    // If switching to present mode, send user-specific data
    if (sceneData.mode === "present") {
      const connectedUsers = sseManager.getConnectedUsers(boardId);
      const { buildPresentModeData } = await import(
        "../utils/present-mode-data.js"
      );

      // Send messages to each user as soon as their data is ready
      connectedUsers.forEach(async ({ userId }) => {
        try {
          const presentModeData = await buildPresentModeData(boardId, userId);
          const message = {
            type: "scene_changed",
            board_id: boardId,
            scene: sceneData,
            timestamp: Date.now(),
            present_mode_data: presentModeData,
          };
          sseManager.broadcastToUser(boardId, userId, message);
        } catch (error) {
          console.error(
            `Failed to build present mode data for user ${userId}:`,
            error,
          );
          const fallbackMessage = {
            type: "scene_changed",
            board_id: boardId,
            scene: sceneData,
            timestamp: Date.now(),
          };
          sseManager.broadcastToUser(boardId, userId, fallbackMessage);
        }
      });
    } else {
      // If switching from present mode to another mode, include all cards
      const message: any = {
        type: "scene_changed",
        board_id: boardId,
        scene: sceneData,
        timestamp: Date.now(),
      };

      try {
        const allCards = await buildAllCardsData(boardId);
        message.all_cards = allCards;
      } catch (error) {
        console.error("Failed to build cards data for scene change:", error);
        // Continue without cards data - client will fallback to API call
      }

      sseManager.broadcastToBoard(boardId, message);
    }
  } catch (error) {
    console.error("Failed to broadcast scene changed:", error);
    // Fallback to simple broadcast
    const message: SSEMessage = {
      type: "scene_changed",
      board_id: boardId,
      scene: sceneData,
      timestamp: Date.now(),
    };
    sseManager.broadcastToBoard(boardId, message);
  }
}

export function broadcastSceneCreated(boardId: string, scene: any) {
  const message: SSEMessage = {
    type: "scene_created",
    board_id: boardId,
    scene,
    timestamp: Date.now(),
  };

  sseManager.broadcastToBoard(boardId, message);
}

export async function broadcastUserJoined(boardId: string, userId: string) {
  try {
    const presenceData = await buildPresenceData(boardId);

    const message: any = {
      type: "user_joined",
      board_id: boardId,
      user_id: userId,
      timestamp: Date.now(),
      presence_data: presenceData,
    };

    sseManager.broadcastToBoard(boardId, message);
  } catch (error) {
    console.error("Failed to build presence data for user joined:", error);
    // Fallback to simple broadcast
    const message: SSEMessage = {
      type: "user_joined",
      board_id: boardId,
      user_id: userId,
      timestamp: Date.now(),
    };
    sseManager.broadcastToBoard(boardId, message);
  }
}

export async function broadcastUserLeft(boardId: string, userId: string) {
  try {
    const presenceData = await buildPresenceData(boardId);

    const message: any = {
      type: "user_left",
      board_id: boardId,
      user_id: userId,
      timestamp: Date.now(),
      presence_data: presenceData,
    };

    sseManager.broadcastToBoard(boardId, message);
  } catch (error) {
    console.error("Failed to build presence data for user left:", error);
    // Fallback to simple broadcast
    const message: SSEMessage = {
      type: "user_left",
      board_id: boardId,
      user_id: userId,
      timestamp: Date.now(),
    };
    sseManager.broadcastToBoard(boardId, message);
  }
}

export async function broadcastPresenceUpdate(
  boardId: string,
  userId: string,
  activity: any,
) {
  try {
    const presenceData = await buildPresenceData(boardId);

    const message: any = {
      type: "presence_update",
      board_id: boardId,
      user_id: userId,
      activity,
      timestamp: Date.now(),
      presence_data: presenceData,
    };

    sseManager.broadcastToBoard(boardId, message);
  } catch (error) {
    console.error("Failed to build presence data for presence update:", error);
    // Fallback to simple broadcast
    const message: SSEMessage = {
      type: "presence_update",
      board_id: boardId,
      user_id: userId,
      activity,
      timestamp: Date.now(),
    };
    sseManager.broadcastToBoard(boardId, message);
  }
}

export async function broadcastUpdatePresentation(
  boardId: string,
  updateData: {
    card_id?: string | null;
    comment_id?: string;
    is_agreement?: boolean;
  },
) {
  try {
    // Get all connected users for this board to send user-specific data
    const connectedUsers = sseManager.getConnectedUsers(boardId);
    const { buildPresentModeData } = await import(
      "../utils/present-mode-data.js"
    );

    // Send messages to each user as soon as their data is ready
    connectedUsers.forEach(async ({ userId }) => {
      try {
        const presentModeData = await buildPresentModeData(boardId, userId);
        const message = {
          type: "update_presentation",
          board_id: boardId,
          timestamp: Date.now(),
          present_mode_data: presentModeData,
          ...updateData,
        };
        sseManager.broadcastToUser(boardId, userId, message);
      } catch (error) {
        console.error(
          `Failed to build present mode data for user ${userId}:`,
          error,
        );
        const fallbackMessage = {
          type: "update_presentation",
          board_id: boardId,
          timestamp: Date.now(),
          ...updateData,
        };
        sseManager.broadcastToUser(boardId, userId, fallbackMessage);
      }
    });
  } catch (error) {
    console.error(
      "Failed to broadcast presentation update with user-specific data:",
      error,
    );
    // Fallback to simple broadcast
    const message: SSEMessage = {
      type: "update_presentation",
      board_id: boardId,
      timestamp: Date.now(),
      ...updateData,
    };
    sseManager.broadcastToBoard(boardId, message);
  }
}

export async function broadcastVotingStatsUpdate(
  boardId: string,
  votingStats?: any,
) {
  try {
    const message = await buildVotingStatsUpdatedMessage(boardId, votingStats);
    sseManager.broadcastToBoard(boardId, message);
  } catch (error) {
    console.error("Failed to broadcast voting stats update:", error);
    throw error;
  }
}

export async function broadcastVotingStatsUpdateExcludingUser(
  boardId: string,
  excludeUserId: string,
  votingStats?: any,
) {
  try {
    const message = await buildVotingStatsUpdatedMessage(boardId, votingStats);
    sseManager.broadcastToBoard(boardId, message, excludeUserId);
  } catch (error) {
    console.error(
      "Failed to broadcast voting stats update excluding user:",
      error,
    );
    throw error;
  }
}

/**
 * Broadcasts vote-related updates based on scene settings
 * This is a reusable function that handles all vote broadcasting logic
 * @param boardId - The board ID
 * @param currentScene - The current scene with showVotes and allowVoting settings
 * @param triggeringUserId - Optional user ID who triggered the change (for exclusion in some broadcasts)
 * @param votesCleared - If true, includes a signal that all votes have been cleared
 */
export async function broadcastVoteUpdatesBasedOnScene(
  boardId: string,
  currentScene: { showVotes?: boolean; allowVoting?: boolean } | null,
  triggeringUserId?: string,
  votesCleared?: boolean,
  voteCountsByCard?: Record<string, number>,
  votingStats?: any,
) {
  try {
    if (!currentScene) return;

    if (currentScene.showVotes) {
      // If "show votes" is enabled, broadcast all vote totals to all users
      let allVoteCountsByCard = voteCountsByCard;

      // Only fetch if not provided
      if (!allVoteCountsByCard) {
        const { getAllUsersVotesForBoard } = await import(
          "../repositories/vote.js"
        );
        const allVotes = await getAllUsersVotesForBoard(boardId);

        // Build vote counts by card
        allVoteCountsByCard = {};
        allVotes.forEach((vote) => {
          allVoteCountsByCard![vote.cardId] =
            (allVoteCountsByCard![vote.cardId] || 0) + 1;
        });
      }

      // Also get voting stats if not provided
      let stats = votingStats;
      if (!stats) {
        const statsMessage = await buildVotingStatsUpdatedMessage(boardId);
        stats = statsMessage.voting_stats;
      }

      // Broadcast all vote counts and stats to all users
      const allVotesMessage: SSEMessage = {
        type: "all_votes_updated",
        board_id: boardId,
        all_votes_by_card: allVoteCountsByCard,
        voting_stats: stats,
        votes_cleared: votesCleared,
        timestamp: Date.now(),
      };

      sseManager.broadcastToBoard(boardId, allVotesMessage);
    } else if (currentScene.allowVoting) {
      // If only "allow voting" is enabled, broadcast aggregate voting stats
      // Include votes_cleared flag if votes were cleared
      if (votesCleared) {
        const statsMessage = await buildVotingStatsUpdatedMessage(
          boardId,
          votingStats,
        );
        (statsMessage as any).votes_cleared = true;
        sseManager.broadcastToBoard(boardId, statsMessage);
      } else if (triggeringUserId) {
        await broadcastVotingStatsUpdateExcludingUser(
          boardId,
          triggeringUserId,
          votingStats,
        );
      } else {
        await broadcastVotingStatsUpdate(boardId, votingStats);
      }
    }
  } catch (error) {
    console.error("Failed to broadcast vote updates based on scene:", error);
    throw error;
  }
}

export function broadcastAgreementsUpdated(boardId: string, agreements: any) {
  const message: SSEMessage = {
    type: "agreements_updated",
    board_id: boardId,
    agreements,
    timestamp: Date.now(),
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastScorecardAttached(
  boardId: string,
  sceneScorecard: any,
) {
  const message: SSEMessage = {
    type: "scorecard_attached",
    board_id: boardId,
    scene_scorecard: sceneScorecard,
    timestamp: Date.now(),
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastScorecardDetached(
  boardId: string,
  sceneScorecardId: string,
) {
  const message: SSEMessage = {
    type: "scorecard_detached",
    board_id: boardId,
    scene_scorecard_id: sceneScorecardId,
    timestamp: Date.now(),
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastScorecardDataCollected(
  boardId: string,
  sceneScorecardId: string,
  processedAt: string,
  resultCount: number,
) {
  const message: SSEMessage = {
    type: "scorecard_data_collected",
    board_id: boardId,
    scene_scorecard_id: sceneScorecardId,
    processed_at: processedAt,
    result_count: resultCount,
    timestamp: Date.now(),
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastScorecardResultFlagged(
  boardId: string,
  resultId: string,
  cardId: string,
) {
  const message: SSEMessage = {
    type: "scorecard_result_flagged",
    board_id: boardId,
    result_id: resultId,
    card_id: cardId,
    timestamp: Date.now(),
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastSceneUpdated(boardId: string, sceneId: string) {
  const message: SSEMessage = {
    type: "scene_updated",
    board_id: boardId,
    scene_id: sceneId,
    timestamp: Date.now(),
  };

  sseManager.broadcastToBoard(boardId, message);
}

// Quadrant scene broadcasts

export function broadcastQuadrantPhaseChanged(
  boardId: string,
  sceneId: string,
  phase: "input" | "results",
) {
  const message: SSEMessage = {
    type: "quadrant_phase_changed",
    board_id: boardId,
    scene_id: sceneId,
    phase,
    timestamp: Date.now(),
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastQuadrantResultsCalculated(
  boardId: string,
  sceneId: string,
  cardPositions: any[],
) {
  const message: SSEMessage = {
    type: "quadrant_results_calculated",
    board_id: boardId,
    scene_id: sceneId,
    card_positions: cardPositions,
    timestamp: Date.now(),
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastCardQuadrantAdjusted(
  boardId: string,
  cardId: string,
  sceneId: string,
  facilitatorX: number,
  facilitatorY: number,
  quadrantLabel: string,
) {
  const message: SSEMessage = {
    type: "card_quadrant_adjusted",
    board_id: boardId,
    card_id: cardId,
    scene_id: sceneId,
    facilitator_x: facilitatorX,
    facilitator_y: facilitatorY,
    quadrant_label: quadrantLabel,
    timestamp: Date.now(),
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastQuadrantFacilitatorPositionUpdated(
  boardId: string,
  sceneId: string,
  cardId: string,
  facilitatorX: number,
  facilitatorY: number,
) {
  const message: SSEMessage = {
    type: "quadrant_facilitator_position_updated",
    board_id: boardId,
    scene_id: sceneId,
    card_id: cardId,
    facilitator_x: facilitatorX,
    facilitator_y: facilitatorY,
    timestamp: Date.now(),
  };

  sseManager.broadcastToBoard(boardId, message);
}

export function broadcastPresentFilterChanged(
  boardId: string,
  sceneId: string,
  filter: any,
) {
  const message: SSEMessage = {
    type: "present_filter_changed",
    board_id: boardId,
    scene_id: sceneId,
    filter,
    timestamp: Date.now(),
  };

  sseManager.broadcastToBoard(boardId, message);
}
