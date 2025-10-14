import type { Scene } from '$lib/types';

/**
 * Capability system for scene options.
 *
 * This function filters scene options based on board status. When a board is
 * completed or archived, editing capabilities are disabled regardless of scene settings.
 *
 * Non-editing capabilities (view-only options) are always returned as-is:
 * - showVotes
 * - showComments
 * - allowObscureCards
 *
 * Editing capabilities are filtered by board status:
 * - allowAddCards
 * - allowEditCards
 * - allowMoveCards
 * - allowGroupCards
 * - allowVoting
 * - allowComments
 */

export type SceneCapability =
  | 'allowAddCards'
  | 'allowEditCards'
  | 'allowMoveCards'
  | 'allowGroupCards'
  | 'allowVoting'
  | 'allowComments'
  | 'allowObscureCards'
  | 'showVotes'
  | 'showComments';

export type BoardStatus = 'draft' | 'active' | 'completed' | 'archived';

// View-only capabilities that should always work regardless of board status
const VIEW_ONLY_CAPABILITIES: SceneCapability[] = ['showVotes', 'showComments', 'allowObscureCards'];

/**
 * Get the effective capability value based on scene settings and board status.
 *
 * @param scene - The scene object containing capability settings
 * @param boardStatus - The current status of the board
 * @param capability - The capability to check
 * @returns The effective capability value (true/false)
 */
export function getSceneCapability(
  scene: Scene | undefined,
  boardStatus: BoardStatus,
  capability: SceneCapability
): boolean {
  // If scene doesn't exist or capability is explicitly false, return false
  if (!scene || !scene[capability]) {
    return false;
  }

  // View-only capabilities are always returned as-is
  if (VIEW_ONLY_CAPABILITIES.includes(capability)) {
    return scene[capability] ?? false;
  }

  // For editing capabilities, check board status
  const isBoardEditable = boardStatus !== 'completed' && boardStatus !== 'archived';
  return (scene[capability] ?? false) && isBoardEditable;
}

/**
 * Helper to get current scene from board data
 */
export function getCurrentScene(
  scenes: Scene[] | undefined,
  currentSceneId: string | undefined
): Scene | undefined {
  if (!scenes || !currentSceneId) {
    return undefined;
  }
  return scenes.find((s) => s.id === currentSceneId);
}
