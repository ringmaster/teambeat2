import { sqliteTable, text as sqliteText, integer as sqliteInteger, primaryKey as sqlitePrimaryKey, unique as sqliteUnique } from 'drizzle-orm/sqlite-core';
import { pgTable, text as pgText, integer as pgInteger, boolean as pgBoolean, primaryKey as pgPrimaryKey, unique as pgUnique } from 'drizzle-orm/pg-core';

// Detect database type from environment variable at module load time
const DATABASE_URL = process.env.DATABASE_URL || './teambeat.db';
const isPostgres = DATABASE_URL.startsWith('postgres://') || DATABASE_URL.startsWith('postgresql://');

// Choose appropriate builders based on database type
const table = isPostgres ? pgTable : sqliteTable;
const text = isPostgres ? pgText : sqliteText;
const integer = isPostgres ? pgInteger : sqliteInteger;
const primaryKey = isPostgres ? pgPrimaryKey : sqlitePrimaryKey;
const unique = isPostgres ? pgUnique : sqliteUnique;

// Helper for boolean fields - use native boolean for Postgres, integer mode for SQLite
const booleanField = (name: string) => isPostgres
  ? pgBoolean(name)
  : sqliteInteger(name, { mode: 'boolean' });

export const users = table('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString())
});

export const boardSeries = table('board_series', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  description: text('description'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString())
});

export const seriesMembers = table('series_members', {
  seriesId: text('series_id').notNull().references(() => boardSeries.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().$type<'admin' | 'facilitator' | 'member'>(),
  joinedAt: text('joined_at').notNull().$defaultFn(() => new Date().toISOString())
}, (table) => ({
  pk: primaryKey({ columns: [table.seriesId, table.userId] })
}));

export const boards = table('boards', {
  id: text('id').primaryKey(),
  seriesId: text('series_id').notNull().references(() => boardSeries.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft').$type<'draft' | 'active' | 'completed' | 'archived'>(),
  currentSceneId: text('current_scene_id'),
  blameFreeMode: booleanField('blame_free_mode').notNull().default(false),
  votingAllocation: integer('voting_allocation').notNull().default(3),
  votingEnabled: booleanField('voting_enabled').notNull().default(true),
  meetingDate: text('meeting_date'),
  timerStart: text('timer_start'), // datetime when timer was started
  timerDuration: integer('timer_duration'), // duration in seconds
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString())
});

export const columns = table('columns', {
  id: text('id').primaryKey(),
  boardId: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  seq: integer('seq').notNull(),
  defaultAppearance: text('default_appearance').notNull().default('shown'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString())
});

export const scenes = table('scenes', {
  id: text('id').primaryKey(),
  boardId: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  mode: text('mode').notNull().$type<'columns' | 'present' | 'review'>(),
  seq: integer('seq').notNull(),
  selectedCardId: text('selected_card_id').references(() => cards.id, { onDelete: 'set null' }),
  // Permission fields
  allowAddCards: booleanField('allow_add_cards').notNull().default(true),
  allowEditCards: booleanField('allow_edit_cards').notNull().default(true),
  allowObscureCards: booleanField('allow_obscure_cards').notNull().default(false),
  allowMoveCards: booleanField('allow_move_cards').notNull().default(true),
  allowGroupCards: booleanField('allow_group_cards').notNull().default(false),
  showVotes: booleanField('show_votes').notNull().default(true),
  allowVoting: booleanField('allow_voting').notNull().default(false),
  showComments: booleanField('show_comments').notNull().default(true),
  allowComments: booleanField('allow_comments').notNull().default(true),
  multipleVotesPerCard: booleanField('multiple_votes_per_card').notNull().default(true),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString())
});

export const scenesColumns = table('scenes_columns', {
  sceneId: text('scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
  columnId: text('column_id').notNull().references(() => columns.id, { onDelete: 'cascade' }),
  state: text('state').notNull().$type<'visible' | 'hidden'>().default('visible')
}, (table) => ({
  pk: primaryKey({ columns: [table.sceneId, table.columnId] })
}));

export const cards = table('cards', {
  id: text('id').primaryKey(),
  columnId: text('column_id').notNull().references(() => columns.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id),
  content: text('content').notNull(),
  notes: text('notes'),
  groupId: text('group_id'),
  isGroupLead: booleanField('is_group_lead').notNull().default(false),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString())
});

export const votes = table('votes', {
  id: text('id').primaryKey(),
  cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString())
});

export const comments = table('comments', {
  id: text('id').primaryKey(),
  cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id),
  content: text('content').notNull(),
  isAgreement: booleanField('is_agreement').notNull().default(false),
  isReaction: booleanField('is_reaction').notNull().default(false),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString())
});



export const healthQuestions = table('health_questions', {
  id: text('id').primaryKey(),
  boardId: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  seq: integer('seq').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString())
});

export const healthResponses = table('health_responses', {
  id: text('id').primaryKey(),
  questionId: text('question_id').notNull().references(() => healthQuestions.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString())
}, (table) => ({
  uniqueResponse: unique().on(table.questionId, table.userId)
}));

export const presence = table('presence', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  boardId: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  lastSeen: integer('last_seen').notNull(),
  currentActivity: text('current_activity')
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.boardId] })
}));

// Timer fields moved to boards table (timerStart, timerDuration)

// Timer extension votes removed - handled in client state

export const userAuthenticators = table('user_authenticators', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  credentialId: text('credential_id').notNull().unique(),
  credentialPublicKey: text('credential_public_key', { mode: 'text' }).notNull(),
  counter: integer('counter').notNull().default(0),
  credentialDeviceType: text('credential_device_type'),
  credentialBackedUp: booleanField('credential_backed_up').notNull().default(false),
  transports: text('transports'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString())
});
