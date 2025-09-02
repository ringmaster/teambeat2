export const BOARD_TEMPLATES = {
  basic: {
    id: 'basic',
    name: 'Basic Retrospective',
    description: 'A simple retrospective with what went well, what could be improved, and action items.',
    columns: [
      { title: 'What went well?', seq: 1 },
      { title: 'What could be improved?', seq: 2 },
      { title: 'Action items', seq: 3 }
    ],
    scenes: [
      {
        title: 'Add Cards',
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
        title: 'Discuss & Vote',
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
        title: 'Review Results',
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
        title: 'Vote',
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
        allowComments: false
      },
      {
        title: 'Discuss',
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
        allowComments: true
      },
      {
        title: 'Review',
        mode: 'review' as const,
        seq: 5,
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
  startstop: {
    id: 'startstop',
    name: 'Start, Stop, Continue',
    description: 'Focus on behaviors to start, stop, and continue for the next iteration.',
    columns: [
      { title: 'Start (What should we begin doing?)', seq: 1 },
      { title: 'Stop (What should we cease doing?)', seq: 2 },
      { title: 'Continue (What should we keep doing?)', seq: 3 }
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
      { title: 'Mad (What frustrated us?)', seq: 1 },
      { title: 'Sad (What disappointed us?)', seq: 2 },
      { title: 'Glad (What made us happy?)', seq: 3 }
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
      { title: 'Liked (What did we enjoy?)', seq: 1 },
      { title: 'Learned (What did we discover?)', seq: 2 },
      { title: 'Lacked (What was missing?)', seq: 3 },
      { title: 'Longed for (What did we wish for?)', seq: 4 }
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
  leancoffee: {
    id: 'leancoffee',
    name: 'Lean Coffee',
    description: 'A democratic discussion format where topics are proposed, voted on, and discussed.',
    columns: [
      { title: 'Topics to Discuss', seq: 1 },
      { title: 'Currently Discussing', seq: 2 },
      { title: 'Discussed', seq: 3 }
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
        allowComments: false
      },
      {
        title: 'Vote on Topics',
        mode: 'present' as const,
        seq: 2,
        allowAddCards: false,
        allowEditCards: false,
        allowObscureCards: false,
        allowMoveCards: false,
        allowGroupCards: false,
        showVotes: true,
        allowVoting: true,
        showComments: false,
        allowComments: false
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
  }
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
export function getTemplate(templateId: string) {
  return BOARD_TEMPLATES[templateId as keyof typeof BOARD_TEMPLATES] || BOARD_TEMPLATES.basic;
}
