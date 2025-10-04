/**
 * Template system for board creation
 *
 * Templates can include:
 * - Static column descriptions
 * - Dynamic column descriptions via getDescription() function
 * - Default appearance settings for columns
 * - Scene configurations
 */

// Icebreaker questions for Lean Coffee
const ICEBREAKER_QUESTIONS = [
  "What's the best piece of advice you've ever received?",
  "If you could instantly become an expert in something, what would it be?",
  "What's the most interesting thing you've learned this week?",
  "What's your go-to productivity hack that works best for you?",
  "If you could have dinner with any historical figure, who would it be and why?",
  "What's one skill you wish they taught in school?",
  "What's the best compliment you've ever received?",
  "If you could solve one world problem, what would it be?",
  "What's your favorite way to unwind after a challenging day?",
  "What's one thing that always makes you smile?",
  "If you could live in any decade, what would it be?",
  "What's the most useful app on your phone?",
  "What's one book that changed your perspective?",
  "If you could master any language overnight, which would you choose?",
  "What's your favorite tradition or ritual?",
  "What's the best gift you've ever given someone?",
  "If you could have any superpower for a day, what would it be?",
  "What's one thing you're grateful for today?",
  "What's your favorite way to learn new things?",
  "If you could ask your future self one question, what would it be?",
  "What's the most beautiful place you've ever seen?",
  "What's one habit you're proud of developing?",
  "If you could attend any event in history, what would it be?",
  "What's your favorite quote or saying?",
  "What's one thing that always motivates you?"
];

function getRandomIcebreakerQuestion(): string {
  return ICEBREAKER_QUESTIONS[Math.floor(Math.random() * ICEBREAKER_QUESTIONS.length)];
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
        allowComments: false,
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
        allowComments: true
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
        getDescription: getRandomIcebreakerQuestion
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
        showVotes: true,
        allowVoting: false,
        showComments: true,
        allowComments: true
      },
      {
        title: 'Vote on Topics',
        mode: 'columns' as const,
        seq: 2,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: false,
        allowVoting: true,
        showComments: true,
        allowComments: true
      },
      {
        title: 'Discuss Topics',
        mode: 'present' as const,
        seq: 3,
        allowAddCards: false,
        allowEditCards: true,
        allowObscureCards: false,
        allowMoveCards: true,
        allowGroupCards: false,
        showVotes: true,
        allowVoting: false,
        showComments: true,
        allowComments: true
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
        mode: 'columns' as const,
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
        allowGroupCards: false,
        showVotes: true,
        allowVoting: false,
        showComments: true,
        allowComments: false
      },
      {
        title: 'Discuss',
        mode: 'present' as const,
        seq: 2,
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
        title: 'Plan Actions',
        mode: 'review' as const,
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
        allowGroupCards: false,
        showVotes: true,
        allowVoting: false,
        showComments: true,
        allowComments: false
      },
      {
        title: 'Explore Together',
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
        title: 'Find Solutions',
        mode: 'review' as const,
        seq: 3,
        allowAddCards: true,
        allowEditCards: true,
        allowObscureCards: false,
        allowMoveCards: true,
        allowGroupCards: true,
        showVotes: true,
        allowVoting: true,
        showComments: true,
        allowComments: true
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
