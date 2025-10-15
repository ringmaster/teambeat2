/**
 * Health Check Survey Question Presets
 *
 * System-defined templates for common survey question sets.
 * These are instantiated when applied to a scene and become independent questions.
 */

export interface HealthQuestionPreset {
  id: string;
  name: string;
  description?: string;
  questions: Array<{
    question: string;
    description?: string;
    questionType: 'boolean' | 'range1to5' | 'agreetodisagree' | 'redyellowgreen';
  }>;
}

/**
 * Gallup Q12 Employee Engagement Survey
 *
 * The Gallup Q12 is a validated 12-question survey measuring employee engagement.
 * Questions focus on fundamental elements of employee engagement including
 * clarity of expectations, resources, recognition, and development opportunities.
 */
const GALLUP_Q12: HealthQuestionPreset = {
  id: 'gallup-q12',
  name: 'Gallup Q12',
  description: 'Employee engagement survey with 12 validated questions',
  questions: [
    {
      question: 'I know what is expected of me at work',
      questionType: 'agreetodisagree'
    },
    {
      question: 'I have the materials and equipment I need to do my work right',
      questionType: 'agreetodisagree'
    },
    {
      question: 'At work, I have the opportunity to do what I do best every day',
      questionType: 'agreetodisagree'
    },
    {
      question: 'In the last seven days, I have received recognition or praise for doing good work',
      questionType: 'agreetodisagree'
    },
    {
      question: 'My supervisor, or someone at work, seems to care about me as a person',
      questionType: 'agreetodisagree'
    },
    {
      question: 'There is someone at work who encourages my development',
      questionType: 'agreetodisagree'
    },
    {
      question: 'At work, my opinions seem to count',
      questionType: 'agreetodisagree'
    },
    {
      question: 'The mission or purpose of my company makes me feel my job is important',
      questionType: 'agreetodisagree'
    },
    {
      question: 'My associates or fellow employees are committed to doing quality work',
      questionType: 'agreetodisagree'
    },
    {
      question: 'I have a best friend at work',
      questionType: 'agreetodisagree'
    },
    {
      question: 'In the last six months, someone at work has talked to me about my progress',
      questionType: 'agreetodisagree'
    },
    {
      question: 'This last year, I have had opportunities at work to learn and grow',
      questionType: 'agreetodisagree'
    }
  ]
};

/**
 * StandOut Team Engagement Survey (Q8)
 *
 * Modern team engagement survey by Marcus Buckingham from "Nine Lies About Work".
 * Focuses on team dynamics, strengths, recognition, and growth.
 */
const STANDOUT_Q8: HealthQuestionPreset = {
  id: 'standout-q8',
  name: 'StandOut Team Engagement (Q8)',
  description: 'Modern team engagement survey by Marcus Buckingham, from "Nine Lies About Work"',
  questions: [
    {
      question: 'I am really enthusiastic about the mission of my company',
      questionType: 'agreetodisagree'
    },
    {
      question: 'At work, I clearly understand what is expected of me',
      questionType: 'agreetodisagree'
    },
    {
      question: 'In my team, I am surrounded by people who share my values',
      questionType: 'agreetodisagree'
    },
    {
      question: 'I have the chance to use my strengths every day at work',
      questionType: 'agreetodisagree'
    },
    {
      question: 'My teammates have my back',
      questionType: 'agreetodisagree'
    },
    {
      question: 'I know I will be recognized for excellent work',
      questionType: 'agreetodisagree'
    },
    {
      question: 'I have great confidence in my company\'s future',
      questionType: 'agreetodisagree'
    },
    {
      question: 'In my work, I am always challenged to grow',
      questionType: 'agreetodisagree'
    }
  ]
};

/**
 * Spotify Squad Health Check
 *
 * Popular agile team health model for software and product teams.
 * Uses red/yellow/green ratings for quick visual assessment.
 */
const SPOTIFY_SQUAD: HealthQuestionPreset = {
  id: 'spotify-squad',
  name: 'Spotify Squad Health Check',
  description: 'Popular agile team health model for software and product teams',
  questions: [
    {
      question: 'Easy to release',
      description: 'Releasing is simple, safe, painless & mostly automated vs. risky, painful, lots of manual work',
      questionType: 'redyellowgreen'
    },
    {
      question: 'Suitable process',
      description: 'Our way of working fits us perfectly vs. our way of working sucks',
      questionType: 'redyellowgreen'
    },
    {
      question: 'Tech quality (code base health)',
      description: 'We\'re proud of the quality of our code vs. our code is a pile of dung',
      questionType: 'redyellowgreen'
    },
    {
      question: 'Value',
      description: 'We deliver great stuff! We\'re proud of it vs. we deliver crap',
      questionType: 'redyellowgreen'
    },
    {
      question: 'Speed',
      description: 'We get stuff done really quickly vs. we never seem to get done with anything',
      questionType: 'redyellowgreen'
    },
    {
      question: 'Mission',
      description: 'We know exactly why we are here, and we are excited about it vs. our mission is unclear and uninspiring',
      questionType: 'redyellowgreen'
    },
    {
      question: 'Fun',
      description: 'We love going to work, and have great fun working together vs. boring',
      questionType: 'redyellowgreen'
    },
    {
      question: 'Learning',
      description: 'We\'re learning lots of interesting stuff all the time vs. we never have time to learn anything',
      questionType: 'redyellowgreen'
    },
    {
      question: 'Support',
      description: 'We always get great support & help when we ask for it vs. we keep getting stuck because we can\'t get support',
      questionType: 'redyellowgreen'
    },
    {
      question: 'Pawns or players',
      description: 'We are in control of our destiny vs. we are just pawns in a game of chess',
      questionType: 'redyellowgreen'
    },
    {
      question: 'Teamwork',
      description: 'We are a great team working well together vs. we struggle to work as a team',
      questionType: 'redyellowgreen'
    }
  ]
};

/**
 * Atlassian Team Health Monitor
 *
 * General-purpose team effectiveness assessment based on Atlassian research.
 * Covers team cohesion, skills, communication, and continuous improvement.
 */
const ATLASSIAN_TEAM: HealthQuestionPreset = {
  id: 'atlassian-team',
  name: 'Atlassian Team Health Monitor',
  description: 'General-purpose team effectiveness assessment based on Atlassian research',
  questions: [
    {
      question: 'Team cohesion',
      description: 'We have mutual trust and respect vs. we lack trust and connection',
      questionType: 'redyellowgreen'
    },
    {
      question: 'Balanced team',
      description: 'We have the right people with the right skills in the right roles vs. we lack key skills or have unclear roles',
      questionType: 'redyellowgreen'
    },
    {
      question: 'Encouraging difference',
      description: 'We seek and voice different viewpoints and work through differences respectfully vs. we avoid diverse perspectives',
      questionType: 'redyellowgreen'
    },
    {
      question: 'Shared understanding',
      description: 'We share understanding of our mission, purpose, and milestones vs. our direction is unclear',
      questionType: 'redyellowgreen'
    },
    {
      question: 'Value and metrics',
      description: 'We understand our value, how it\'s measured, and use metrics to make decisions vs. we lack clarity on value and success',
      questionType: 'redyellowgreen'
    },
    {
      question: 'Suitable ways of working',
      description: 'Our ways of working enable us to do our jobs effectively vs. our processes hinder our work',
      questionType: 'redyellowgreen'
    },
    {
      question: 'Engagement and support',
      description: 'It\'s clear how to engage with us and teams get the support they need vs. engagement with our team is unclear or ineffective',
      questionType: 'redyellowgreen'
    },
    {
      question: 'Continuous improvement',
      description: 'We celebrate successes and act on improvement opportunities with regular feedback loops vs. we don\'t make time for reflection or improvement',
      questionType: 'redyellowgreen'
    }
  ]
};

/**
 * All available health question presets
 */
export const HEALTH_QUESTION_PRESETS: HealthQuestionPreset[] = [
  GALLUP_Q12,
  STANDOUT_Q8,
  SPOTIFY_SQUAD,
  ATLASSIAN_TEAM
];

/**
 * Get a preset by ID
 */
export function getPresetById(id: string): HealthQuestionPreset | undefined {
  return HEALTH_QUESTION_PRESETS.find(preset => preset.id === id);
}

/**
 * Get preset metadata (without full question arrays) for UI display
 */
export function getPresetMetadata() {
  return HEALTH_QUESTION_PRESETS.map(preset => ({
    id: preset.id,
    name: preset.name,
    description: preset.description,
    questionCount: preset.questions.length
  }));
}
