import { sqliteTable, text, integer, primaryKey, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	name: text('name'),
	passwordHash: text('password_hash').notNull(),
	createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

export const boardSeries = sqliteTable('board_series', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	slug: text('slug').unique(),
	description: text('description'),
	createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});

export const seriesMembers = sqliteTable('series_members', {
	seriesId: text('series_id').notNull().references(() => boardSeries.id, { onDelete: 'cascade' }),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	role: text('role').notNull().$type<'admin' | 'facilitator' | 'member'>(),
	joinedAt: text('joined_at').default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	pk: primaryKey({ columns: [table.seriesId, table.userId] })
}));

export const boards = sqliteTable('boards', {
	id: text('id').primaryKey(),
	seriesId: text('series_id').notNull().references(() => boardSeries.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	status: text('status').notNull().default('draft').$type<'draft' | 'active' | 'completed' | 'archived'>(),
	currentSceneId: text('current_scene_id'),
	blameFreeMode: integer('blame_free_mode', { mode: 'boolean' }).default(false),
	votingAllocation: integer('voting_allocation').default(3),
	votingEnabled: integer('voting_enabled', { mode: 'boolean' }).default(true),
	meetingDate: text('meeting_date'),
	createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

export const columns = sqliteTable('columns', {
	id: text('id').primaryKey(),
	boardId: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	description: text('description'),
	seq: integer('seq').notNull(),
	defaultAppearance: text('default_appearance').notNull().default('shown').$type<'shown' | 'hidden' | 'fixed'>(),
	createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});

export const scenes = sqliteTable('scenes', {
	id: text('id').primaryKey(),
	boardId: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	description: text('description'),
	mode: text('mode').notNull().$type<'columns' | 'present' | 'review'>(),
	seq: integer('seq').notNull(),
	// Permission fields
	allowAddCards: integer('allow_add_cards', { mode: 'boolean' }).default(true),
	allowEditCards: integer('allow_edit_cards', { mode: 'boolean' }).default(true),
	allowObscureCards: integer('allow_obscure_cards', { mode: 'boolean' }).default(false),
	allowMoveCards: integer('allow_move_cards', { mode: 'boolean' }).default(true),
	allowGroupCards: integer('allow_group_cards', { mode: 'boolean' }).default(false),
	showVotes: integer('show_votes', { mode: 'boolean' }).default(true),
	allowVoting: integer('allow_voting', { mode: 'boolean' }).default(false),
	showComments: integer('show_comments', { mode: 'boolean' }).default(true),
	allowComments: integer('allow_comments', { mode: 'boolean' }).default(true),
	// Legacy field for backward compatibility
	multipleVotesPerCard: integer('multiple_votes_per_card', { mode: 'boolean' }).default(false),
	createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});

export const scenesColumns = sqliteTable('scenes_columns', {
	sceneId: text('scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
	columnId: text('column_id').notNull().references(() => columns.id, { onDelete: 'cascade' }),
	state: text('state').notNull().$type<'visible' | 'hidden'>().default('visible')
}, (table) => ({
	pk: primaryKey({ columns: [table.sceneId, table.columnId] })
}));

export const cards = sqliteTable('cards', {
	id: text('id').primaryKey(),
	columnId: text('column_id').notNull().references(() => columns.id, { onDelete: 'cascade' }),
	userId: text('user_id').references(() => users.id),
	content: text('content').notNull(),
	groupId: text('group_id'),
	isGroupLead: integer('is_group_lead', { mode: 'boolean' }).default(false),
	createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

export const votes = sqliteTable('votes', {
	id: text('id').primaryKey(),
	cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});

export const comments = sqliteTable('comments', {
	id: text('id').primaryKey(),
	cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
	userId: text('user_id').references(() => users.id),
	content: text('content').notNull(),
	isActionItem: integer('is_action_item', { mode: 'boolean' }).default(false),
	createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

export const actionItemAssignments = sqliteTable('action_item_assignments', {
	commentId: text('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' })
}, (table) => ({
	pk: primaryKey({ columns: [table.commentId, table.userId] })
}));

export const actionItemStatus = sqliteTable('action_item_status', {
	commentId: text('comment_id').primaryKey().references(() => comments.id, { onDelete: 'cascade' }),
	status: text('status').notNull().default('open').$type<'open' | 'in_progress' | 'completed' | 'cancelled'>(),
	dueDate: text('due_date'),
	updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

export const healthQuestions = sqliteTable('health_questions', {
	id: text('id').primaryKey(),
	boardId: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
	question: text('question').notNull(),
	seq: integer('seq').notNull(),
	createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});

export const healthResponses = sqliteTable('health_responses', {
	id: text('id').primaryKey(),
	questionId: text('question_id').notNull().references(() => healthQuestions.id, { onDelete: 'cascade' }),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	rating: integer('rating').notNull(),
	createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	uniqueResponse: unique().on(table.questionId, table.userId)
}));

export const presence = sqliteTable('presence', {
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	boardId: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
	lastSeen: integer('last_seen').notNull(),
	currentActivity: text('current_activity')
}, (table) => ({
	pk: primaryKey({ columns: [table.userId, table.boardId] })
}));

export const boardTimers = sqliteTable('board_timers', {
	boardId: text('board_id').primaryKey().references(() => boards.id, { onDelete: 'cascade' }),
	durationSeconds: integer('duration_seconds').notNull(),
	startedAt: integer('started_at').notNull(),
	updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

export const timerExtensionVotes = sqliteTable('timer_extension_votes', {
	boardId: text('board_id').notNull().references(() => boardTimers.boardId, { onDelete: 'cascade' }),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	vote: text('vote').notNull().$type<'done' | 'more_time'>(),
	createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
	pk: primaryKey({ columns: [table.boardId, table.userId] })
}));

