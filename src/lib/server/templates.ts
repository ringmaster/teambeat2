/**
 * Template system for board creation
 *
 * Templates can include:
 * - Static column descriptions
 * - Dynamic column descriptions via getDescription() function
 * - Default appearance settings for columns
 * - Scene configurations
 */

import { COLUMN_PRESETS } from '$lib/data/column-presets';

/**
 * Get a random description for a column from the presets
 * @param columnTitle The title of the column to get a description for
 * @returns A random description from the preset list, or empty string if no presets available
 */
function getRandomColumnDescription(columnTitle: string): string {
  const presets = COLUMN_PRESETS[columnTitle];
  if (!presets || presets.length === 0) {
    return '';
  }
  return presets[Math.floor(Math.random() * presets.length)];
}

// Type definitions for template structure
interface TemplateColumn {
  title: string;
  description?: string;  // Static description
  seq: number;
  default_appearance?: string;
  getDescription?: () => string;  // Dynamic description function (overrides static description)
}

interface TemplateScene {
  title: string;
  mode: 'columns' | 'present' | 'review' | 'agreements' | 'scorecard';
  seq: number;
  allowAddCards: boolean;
  allowEditCards: boolean;
  allowObscureCards: boolean;
  allowMoveCards: boolean;
  allowGroupCards: boolean;
  showVotes: boolean;
  allowVoting: boolean;
  showComments: boolean;
  allowComments: boolean;
  visibleColumns?: string[];  // Optional array of column titles that should be visible (if omitted, all columns are visible)
}

interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  columns: TemplateColumn[];
  scenes: TemplateScene[];
}

export const BOARD_TEMPLATES: Record<string, BoardTemplate> = {
  kafe: {
    id: 'kafe',
    name: 'KAFE (Kvetches, Appreciations, Flaws, Experiments)',
    description: 'A "KAFE" retrospective is a structured approach used in project management and team-building to reflect on the past and plan for the future.',
    columns: [
      { title: 'Kvetches', description: 'What really bothered you?', seq: 1 },
      { title: 'Appreciations', description: 'What/Who really pleased you?', seq: 2 },
      { title: 'Flaws', description: 'What could be improved?', seq: 3 },
      { title: 'Experiments', description: 'What should we try differently?', seq: 4 }
    ],
    scenes: [
      {
        title: 'Gather',
        mode: 'columns' as const,
        seq: 1,
        allowAddCards: true,
        allowEditCards: true,
        allowObscureCards: true,
        allowMoveCards: true,
        allowGroupCards: false,
        showVotes: false,
        allowVoting: false,
        showComments: false,
        allowComments: false
      },
      {
        title: 'Group',
        mode: 'columns' as const,
        seq: 2,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: true,
        allowGroupCards: true,
        showVotes: false,
        allowVoting: false,
        showComments: true,
        allowComments: true
      },
      {
        title: 'Kvetch',
        mode: 'present' as const,
        seq: 3,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: false,
        allowVoting: false,
        showComments: true,
        allowComments: true,
        visibleColumns: ['Kvetches']
      },
      {
        title: 'Vote',
        mode: 'columns' as const,
        seq: 4,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: false,
        allowVoting: true,
        showComments: true,
        allowComments: true,
        visibleColumns: ['Flaws', 'Experiments']
      },
      {
        title: 'Discuss',
        mode: 'present' as const,
        seq: 5,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: true,
        allowVoting: false,
        showComments: true,
        allowComments: true,
        visibleColumns: ['Flaws', 'Experiments']
      },
      {
        title: 'Appreciate',
        mode: 'present' as const,
        seq: 6,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: false,
        allowVoting: false,
        showComments: true,
        allowComments: true,
        visibleColumns: ['Appreciations']
      },
      {
        title: 'Review',
        mode: 'review' as const,
        seq: 7,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: true,
        allowVoting: false,
        showComments: false,
        allowComments: false
      }
    ]
  },
  leancoffee: {
    id: 'leancoffee',
    name: 'Lean Coffee',
    description: 'A democratic discussion format where topics are proposed, discussed, and decided on.',
    columns: [
      {
        title: 'Icebreaker',
        seq: 1,
        default_appearance: 'locked',
        getDescription: () => getRandomColumnDescription('Icebreaker')
      },
      { title: 'Issues to Discuss', seq: 2, default_appearance: 'spread' }
    ],
    scenes: [
      {
        title: 'Propose Topics',
        mode: 'columns' as const,
        seq: 1,
        allowAddCards: true,
        allowEditCards: true,
        allowObscureCards: false,
        allowMoveCards: true,
        allowGroupCards: false,
        showVotes: false,
        allowVoting: false,
        showComments: true,
        allowComments: true
      },
      {
        title: 'Review Last Time',
        mode: 'agreements' as const,
        seq: 2,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: false,
        allowVoting: false,
        showComments: false,
        allowComments: false,
        visibleColumns: ['Issues to Discuss']
      },
      {
        title: 'Vote on Topics',
        mode: 'columns' as const,
        seq: 3,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: false,
        allowVoting: true,
        showComments: true,
        allowComments: true,
        visibleColumns: ['Issues to Discuss']
      },
      {
        title: 'Discuss Topics',
        mode: 'present' as const,
        seq: 4,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: true,
        allowVoting: false,
        showComments: true,
        allowComments: true,
        visibleColumns: ['Issues to Discuss']
      },
      {
        title: 'Review Topics',
        mode: 'review' as const,
        seq: 5,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: true,
        allowVoting: false,
        showComments: true,
        allowComments: false
      }
    ]
  },
  traction: {
    id: 'traction',
    name: 'Traction Touchbase',
    description: 'A structured meeting format to discuss key issues and plan actions.',
    columns: [
      { title: 'Issues List', seq: 1 }
    ],
    scenes: [
      {
        title: 'To-Do List',
        mode: 'agreements' as const,
        seq: 1,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: false,
        allowVoting: false,
        showComments: true,
        allowComments: true
      },
      {
        title: 'Scorecard',
        mode: 'scorecard' as const,
        seq: 2,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: false,
        allowVoting: false,
        showComments: false,
        allowComments: false,
        visibleColumns: []
      },
      {
        title: 'Issue List',
        mode: 'columns' as const,
        seq: 3,
        allowAddCards: true,
        allowEditCards: true,
        allowObscureCards: false,
        allowMoveCards: true,
        allowGroupCards: true,
        showVotes: false,
        allowVoting: false,
        showComments: true,
        allowComments: true
      },
      {
        title: 'Identify, Discuss, Solve (IDS)',
        mode: 'present' as const,
        seq: 4,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: false,
        allowVoting: false,
        showComments: true,
        allowComments: true
      },
      {
        title: 'Close',
        mode: 'review' as const,
        seq: 5,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: false,
        allowVoting: false,
        showComments: true,
        allowComments: true
      }
    ]
  },
  startstop: {
    id: 'startstop',
    name: 'Start, Stop, Continue',
    description: 'Focus on behaviors to start, stop, and continue for the next iteration.',
    columns: [
      { title: 'Start', description: '(What should we begin doing?)', seq: 1 },
      { title: 'Stop', description: '(What should we cease doing?)', seq: 2 },
      { title: 'Continue', description: '(What should we keep doing?)', seq: 3 }
    ],
    scenes: [
      {
        title: 'Brainstorm',
        mode: 'columns' as const,
        seq: 1,
        allowAddCards: true,
        allowEditCards: true,
        allowObscureCards: false,
        allowMoveCards: true,
        allowGroupCards: true,
        showVotes: false,
        allowVoting: false,
        showComments: true,
        allowComments: false
      },
      {
        title: 'Prioritize',
        mode: 'columns' as const,
        seq: 2,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: true,
        showVotes: false,
        allowVoting: true,
        showComments: true,
        allowComments: true
      },
      {
        title: 'Discuss',
        mode: 'present' as const,
        seq: 3,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: true,
        allowVoting: false,
        showComments: true,
        allowComments: true
      },
      {
        title: 'Plan Actions',
        mode: 'review' as const,
        seq: 4,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: true,
        allowVoting: false,
        showComments: true,
        allowComments: false
      }
    ]
  },
  madsadglad: {
    id: 'madsadglad',
    name: 'Mad, Sad, Glad',
    description: 'An emotional retrospective focusing on feelings and reactions.',
    columns: [
      { title: 'Mad', description: '(What frustrated us?)', seq: 1 },
      { title: 'Sad', description: '(What disappointed us?)', seq: 2 },
      { title: 'Glad', description: '(What made us happy?)', seq: 3 }
    ],
    scenes: [
      {
        title: 'Share Feelings',
        mode: 'columns' as const,
        seq: 1,
        allowAddCards: true,
        allowEditCards: true,
        allowObscureCards: false,
        allowMoveCards: true,
        allowGroupCards: true,
        showVotes: false,
        allowVoting: false,
        showComments: true,
        allowComments: false
      },
      {
        title: 'Prioritize',
        mode: 'columns' as const,
        seq: 2,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: true,
        showVotes: false,
        allowVoting: true,
        showComments: true,
        allowComments: true
      },
      {
        title: 'Explore Together',
        mode: 'present' as const,
        seq: 3,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: true,
        allowVoting: false,
        showComments: true,
        allowComments: true
      },
      {
        title: 'Find Solutions',
        mode: 'review' as const,
        seq: 4,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: true,
        allowVoting: false,
        showComments: true,
        allowComments: false
      }
    ]
  },
  fourls: {
    id: 'fourls',
    name: "4 L's (Liked, Learned, Lacked, Longed for)",
    description: 'A comprehensive reflection on the four L\'s of team experience.',
    columns: [
      { title: 'Liked', description: '(What did we enjoy?)', seq: 1 },
      { title: 'Learned', description: '(What did we discover?)', seq: 2 },
      { title: 'Lacked', description: '(What was missing?)', seq: 3 },
      { title: 'Longed for', description: '(What did we wish for?)', seq: 4 }
    ],
    scenes: [
      {
        title: 'Reflect',
        mode: 'columns' as const,
        seq: 1,
        allowAddCards: true,
        allowEditCards: true,
        allowObscureCards: false,
        allowMoveCards: true,
        allowGroupCards: false,
        showVotes: true,
        allowVoting: false,
        showComments: true,
        allowComments: false
      },
      {
        title: 'Share Insights',
        mode: 'present' as const,
        seq: 2,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: false,
        allowVoting: false,
        showComments: true,
        allowComments: true
      },
      {
        title: 'Prioritize Improvements',
        mode: 'present' as const,
        seq: 3,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: true,
        allowVoting: true,
        showComments: true,
        allowComments: true
      },
      {
        title: 'Create Action Plan',
        mode: 'review' as const,
        seq: 4,
        allowAddCards: true,
        allowEditCards: true,
        allowObscureCards: false,
        allowMoveCards: true,
        allowGroupCards: true,
        showVotes: true,
        allowVoting: false,
        showComments: true,
        allowComments: true
      }
    ]
  },
} as const;

// Helper function to get template list for the templates API
export function getTemplateList() {
  return Object.values(BOARD_TEMPLATES).map(template => ({
    id: template.id,
    name: template.name,
    description: template.description,
    columns: template.columns.map(col => col.title),
    scenes: template.scenes.length
  }));
}

// Helper function to get full template data for setup
export function getTemplate(templateId: string): BoardTemplate {
  return BOARD_TEMPLATES[templateId] || BOARD_TEMPLATES.kafe;
}
