import { sqliteTable, text as sqliteText, integer as sqliteInteger, real as sqliteReal, index as sqliteIndex, primaryKey as sqlitePrimaryKey, unique as sqliteUnique } from 'drizzle-orm/sqlite-core';
import { pgTable, text as pgText, integer as pgInteger, serial as pgSerial, real as pgReal, bigint as pgBigint, boolean as pgBoolean, index as pgIndex, primaryKey as pgPrimaryKey, unique as pgUnique } from 'drizzle-orm/pg-core';

// Detect database type from environment variable at module load time
const DATABASE_URL = process.env.DATABASE_URL || './teambeat.db';
const isPostgres = DATABASE_URL.startsWith('postgres://') || DATABASE_URL.startsWith('postgresql://');

// Choose appropriate builders based on database type
const table = isPostgres ? pgTable : sqliteTable;
const text = isPostgres ? pgText : sqliteText;
const integer = isPostgres ? pgInteger : sqliteInteger;
const realField = isPostgres ? pgReal : sqliteReal;
const indexField = isPostgres ? pgIndex : sqliteIndex;
const primaryKey = isPostgres ? pgPrimaryKey : sqlitePrimaryKey;
const unique = isPostgres ? pgUnique : sqliteUnique;

// Helper for auto-increment ID - use generated identity for Postgres, integer with autoIncrement for SQLite
const autoIncrementId = (name: string) => isPostgres
  ? pgInteger(name).primaryKey().generatedAlwaysAsIdentity()
  : sqliteInteger(name).primaryKey({ autoIncrement: true });

// Helper for boolean fields - use native boolean for Postgres, integer mode for SQLite
const booleanField = (name: string) => isPostgres
  ? pgBoolean(name)
  : sqliteInteger(name, { mode: 'boolean' });

// Helper for bigint fields - use bigint for Postgres, integer for SQLite (SQLite stores all numbers as 64-bit)
const bigintField = (name: string) => isPostgres
  ? pgBigint(name, { mode: 'number' })
  : sqliteInteger(name);

export const users = table('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  passwordHash: text('password_hash').notNull(),
  is_admin: booleanField('is_admin').notNull().default(false),
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
  mode: text('mode').notNull().$type<'columns' | 'present' | 'review' | 'agreements' | 'scorecard'>(),
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
  completed: booleanField('completed').notNull().default(false),
  completedByUserId: text('completed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString())
}, (table) => ({
  agreementCompletedIdx: indexField('comments_agreement_completed_idx').on(table.cardId, table.isAgreement, table.completed)
}));

export const agreements = table('agreements', {
  id: text('id').primaryKey(),
  boardId: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  content: text('content').notNull(),
  completed: booleanField('completed').notNull().default(false),
  completedByUserId: text('completed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  completedAt: text('completed_at'),
  sourceAgreementId: text('source_agreement_id').references((): any => agreements.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString())
}, (table) => ({
  boardIdIdx: indexField('agreements_board_id_idx').on(table.boardId),
  completedIdx: indexField('agreements_completed_idx').on(table.boardId, table.completed)
}));

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
  lastSeen: bigintField('last_seen').notNull(),
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

// Performance monitoring tables - using text IDs like other tables for consistency
// Note: Using direct imports instead of helpers to avoid Drizzle Kit introspection issues
const perfReal = isPostgres ? pgReal : sqliteReal;
const perfBigint = isPostgres ? pgBigint : sqliteInteger;
const perfIndex = isPostgres ? pgIndex : sqliteIndex;

export const metricSnapshots = table('metric_snapshots', {
  id: text('id').primaryKey(),
  timestamp: perfBigint('timestamp', { mode: 'number' }).notNull(),
  concurrent_users: integer('concurrent_users').notNull(),
  peak_concurrent_users: integer('peak_concurrent_users').notNull(),
  active_connections: integer('active_connections').notNull(),
  total_operations: integer('total_operations').notNull(),
  broadcast_p95: perfReal('broadcast_p95').notNull(),
  broadcast_p99: perfReal('broadcast_p99').notNull(),
  messages_sent: integer('messages_sent').notNull()
}, (table) => ({
  timestampIdx: perfIndex('metric_snapshots_timestamp_idx').on(table.timestamp)
}));

export const boardMetrics = table('board_metrics', {
  id: text('id').primaryKey(),
  board_id: text('board_id').notNull(),
  timestamp: perfBigint('timestamp', { mode: 'number' }).notNull(),
  broadcast_count: integer('broadcast_count').notNull(),
  avg_broadcast_duration: perfReal('avg_broadcast_duration').notNull()
}, (table) => ({
  boardTimestampIdx: perfIndex('board_metrics_board_timestamp_idx').on(table.board_id, table.timestamp)
}));

export const slowQueries = table('slow_queries', {
  id: text('id').primaryKey(),
  timestamp: perfBigint('timestamp', { mode: 'number' }).notNull(),
  duration: perfReal('duration').notNull(),
  query: text('query').notNull(),
  board_id: text('board_id')
}, (table) => ({
  timestampIdx: perfIndex('slow_queries_timestamp_idx').on(table.timestamp)
}));

// Scorecard tables - for data-driven meeting insights
export const scorecards = table('scorecards', {
  id: text('id').primaryKey(),
  seriesId: text('series_id').notNull().references(() => boardSeries.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  createdByUserId: text('created_by_user_id').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString())
}, (table) => ({
  seriesIdx: indexField('scorecards_series_idx').on(table.seriesId)
}));

export const scorecardDatasources = table('scorecard_datasources', {
  id: text('id').primaryKey(),
  scorecardId: text('scorecard_id').notNull().references(() => scorecards.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  seq: integer('seq').notNull(),
  sourceType: text('source_type').notNull().$type<'paste' | 'api'>(),
  apiConfig: text('api_config'), // JSON: {url, auth_type, credentials_encrypted}
  dataSchema: text('data_schema'), // JSON: describes expected data shape
  rules: text('rules').notNull(), // JSON: array of rule objects
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString())
}, (table) => ({
  scorecardIdx: indexField('scorecard_datasources_scorecard_idx').on(table.scorecardId)
}));

export const sceneScorecards = table('scene_scorecards', {
  id: text('id').primaryKey(),
  sceneId: text('scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
  scorecardId: text('scorecard_id').notNull().references(() => scorecards.id, { onDelete: 'cascade' }),
  collectedData: text('collected_data'), // JSON: all datasource data combined
  processedAt: text('processed_at'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString())
}, (table) => ({
  sceneIdx: indexField('scene_scorecards_scene_idx').on(table.sceneId),
  scorecardIdx: indexField('scene_scorecards_scorecard_idx').on(table.scorecardId)
}));

export const sceneScorecardResults = table('scene_scorecard_results', {
  id: text('id').primaryKey(),
  sceneScorecardId: text('scene_scorecard_id').notNull().references(() => sceneScorecards.id, { onDelete: 'cascade' }),
  datasourceId: text('datasource_id').notNull().references(() => scorecardDatasources.id),
  section: text('section').notNull(),
  title: text('title').notNull(),
  primaryValue: text('primary_value'),
  secondaryValues: text('secondary_values'), // JSON: additional fields
  severity: text('severity').notNull().$type<'info' | 'warning' | 'critical'>(),
  sourceData: text('source_data'), // JSON: full original record
  seq: integer('seq').notNull()
}, (table) => ({
  sceneScorecardIdx: indexField('scene_scorecard_results_scene_scorecard_idx').on(table.sceneScorecardId)
}));
