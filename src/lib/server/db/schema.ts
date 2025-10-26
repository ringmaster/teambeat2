import { relations } from "drizzle-orm";
import {
	bigint as pgBigint,
	boolean as pgBoolean,
	index as pgIndex,
	integer as pgInteger,
	primaryKey as pgPrimaryKey,
	real as pgReal,
	serial as pgSerial,
	pgTable,
	text as pgText,
	unique as pgUnique,
} from "drizzle-orm/pg-core";
import {
	index as sqliteIndex,
	integer as sqliteInteger,
	primaryKey as sqlitePrimaryKey,
	real as sqliteReal,
	sqliteTable,
	text as sqliteText,
	unique as sqliteUnique,
} from "drizzle-orm/sqlite-core";

// Detect database type from environment variable at module load time
const DATABASE_URL = process.env.DATABASE_URL || "./teambeat.db";
const isPostgres =
	DATABASE_URL.startsWith("postgres://") ||
	DATABASE_URL.startsWith("postgresql://");

// Choose appropriate builders based on database type
const table = isPostgres ? pgTable : sqliteTable;
const text = isPostgres ? pgText : sqliteText;
const integer = isPostgres ? pgInteger : sqliteInteger;
const realField = isPostgres ? pgReal : sqliteReal;
const indexField = isPostgres ? pgIndex : sqliteIndex;
const primaryKey = isPostgres ? pgPrimaryKey : sqlitePrimaryKey;
const unique = isPostgres ? pgUnique : sqliteUnique;

// Helper for auto-increment ID - use generated identity for Postgres, integer with autoIncrement for SQLite
const autoIncrementId = (name: string) =>
	isPostgres
		? pgInteger(name).primaryKey().generatedAlwaysAsIdentity()
		: sqliteInteger(name).primaryKey({ autoIncrement: true });

// Helper for boolean fields - use native boolean for Postgres, integer mode for SQLite
const booleanField = (name: string) =>
	isPostgres ? pgBoolean(name) : sqliteInteger(name, { mode: "boolean" });

// Helper for bigint fields - use bigint for Postgres, integer for SQLite (SQLite stores all numbers as 64-bit)
const bigintField = (name: string) =>
	isPostgres ? pgBigint(name, { mode: "number" }) : sqliteInteger(name);

export const users = table("users", {
	id: text("id").primaryKey(),
	email: text("email").notNull().unique(),
	name: text("name"),
	passwordHash: text("password_hash").notNull(),
	emailVerified: booleanField("email_verified").notNull().default(false),
	emailVerificationSecret: text("email_verification_secret"),
	is_admin: booleanField("is_admin").notNull().default(false),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text("updated_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const boardSeries = table("board_series", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	slug: text("slug").unique(),
	description: text("description"),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const seriesMembers = table(
	"series_members",
	{
		seriesId: text("series_id")
			.notNull()
			.references(() => boardSeries.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		role: text("role").notNull().$type<"admin" | "facilitator" | "member">(),
		joinedAt: text("joined_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.seriesId, table.userId] }),
	}),
);

export const boards = table("boards", {
	id: text("id").primaryKey(),
	seriesId: text("series_id")
		.notNull()
		.references(() => boardSeries.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	status: text("status")
		.notNull()
		.default("draft")
		.$type<"draft" | "active" | "completed" | "archived">(),
	currentSceneId: text("current_scene_id"),
	cloneOf: text("clone_of").references(() => boards.id, {
		onDelete: "set null",
	}),
	blameFreeMode: booleanField("blame_free_mode").notNull().default(false),
	votingAllocation: integer("voting_allocation").notNull().default(3),
	votingEnabled: booleanField("voting_enabled").notNull().default(true),
	meetingDate: text("meeting_date"),
	timerStart: text("timer_start"), // datetime when timer was started
	timerDuration: integer("timer_duration"), // duration in seconds
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text("updated_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const columns = table("columns", {
	id: text("id").primaryKey(),
	boardId: text("board_id")
		.notNull()
		.references(() => boards.id, { onDelete: "cascade" }),
	title: text("title").notNull(),
	description: text("description"),
	seq: integer("seq").notNull(),
	defaultAppearance: text("default_appearance").notNull().default("shown"),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const scenes = table("scenes", {
	id: text("id").primaryKey(),
	boardId: text("board_id")
		.notNull()
		.references(() => boards.id, { onDelete: "cascade" }),
	title: text("title").notNull(),
	description: text("description"),
	mode: text("mode")
		.notNull()
		.$type<
			| "columns"
			| "present"
			| "review"
			| "agreements"
			| "scorecard"
			| "static"
			| "survey"
			| "quadrant"
		>(),
	seq: integer("seq").notNull(),
	selectedCardId: text("selected_card_id").references(() => cards.id, {
		onDelete: "set null",
	}),
	displayRule: text("display_rule"), // RPN rule to determine if scene should be displayed
	// Survey scene display mode
	displayMode: text("display_mode")
		.notNull()
		.default("collecting")
		.$type<"collecting" | "results">(),
	focusedQuestionId: text("focused_question_id").references(
		(): any => healthQuestions.id,
		{ onDelete: "set null" },
	),
	// Quadrant scene configuration
	quadrantConfig: text("quadrant_config"), // JSON: {grid_size, x_axis_label, y_axis_label, x_axis_values, y_axis_values, template_id}
	presentModeFilter: text("present_mode_filter"), // JSON: {type, scene_id?, quadrant_label?}
	quadrantPhase: text("quadrant_phase").$type<"input" | "results">(), // Current phase for quadrant scenes
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const scenesColumns = table(
	"scenes_columns",
	{
		sceneId: text("scene_id")
			.notNull()
			.references(() => scenes.id, { onDelete: "cascade" }),
		columnId: text("column_id")
			.notNull()
			.references(() => columns.id, { onDelete: "cascade" }),
		state: text("state")
			.notNull()
			.$type<"visible" | "hidden">()
			.default("visible"),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.sceneId, table.columnId] }),
	}),
);

export const sceneFlags = table(
	"scene_flags",
	{
		sceneId: text("scene_id")
			.notNull()
			.references(() => scenes.id, { onDelete: "cascade" }),
		flag: text("flag").notNull(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.sceneId, table.flag] }),
	}),
);

export const cards = table("cards", {
	id: text("id").primaryKey(),
	columnId: text("column_id")
		.notNull()
		.references(() => columns.id, { onDelete: "cascade" }),
	userId: text("user_id").references(() => users.id),
	content: text("content").notNull(),
	notes: text("notes"),
	groupId: text("group_id"),
	isGroupLead: booleanField("is_group_lead").notNull().default(false),
	seq: integer("seq").default(0),
	quadrantMetadata: text("quadrant_metadata"), // JSON array: [{scene_id, consensus_x, consensus_y, facilitator_x, facilitator_y, mode_quadrant, quadrant_label, participant_count, timestamp}]
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text("updated_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const quadrantPositions = table(
	"quadrant_positions",
	{
		id: text("id").primaryKey(),
		cardId: text("card_id")
			.notNull()
			.references(() => cards.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		sceneId: text("scene_id")
			.notNull()
			.references(() => scenes.id, { onDelete: "cascade" }),
		xValue: integer("x_value").notNull(), // 1-96 range
		yValue: integer("y_value").notNull(), // 1-96 range
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		updatedAt: text("updated_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => ({
		pk: unique().on(table.cardId, table.userId, table.sceneId),
		sceneIdx: indexField("quadrant_positions_scene_idx").on(table.sceneId),
		cardIdx: indexField("quadrant_positions_card_idx").on(table.cardId),
	}),
);

export const votes = table("votes", {
	id: text("id").primaryKey(),
	cardId: text("card_id")
		.notNull()
		.references(() => cards.id, { onDelete: "cascade" }),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

export const comments = table(
	"comments",
	{
		id: text("id").primaryKey(),
		cardId: text("card_id")
			.notNull()
			.references(() => cards.id, { onDelete: "cascade" }),
		userId: text("user_id").references(() => users.id),
		content: text("content").notNull(),
		isAgreement: booleanField("is_agreement").notNull().default(false),
		isReaction: booleanField("is_reaction").notNull().default(false),
		completed: booleanField("completed").notNull().default(false),
		completedByUserId: text("completed_by_user_id").references(() => users.id, {
			onDelete: "set null",
		}),
		completedAt: text("completed_at"),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		updatedAt: text("updated_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => ({
		agreementCompletedIdx: indexField("comments_agreement_completed_idx").on(
			table.cardId,
			table.isAgreement,
			table.completed,
		),
	}),
);

export const agreements = table(
	"agreements",
	{
		id: text("id").primaryKey(),
		boardId: text("board_id")
			.notNull()
			.references(() => boards.id, { onDelete: "cascade" }),
		userId: text("user_id").references(() => users.id, {
			onDelete: "set null",
		}),
		content: text("content").notNull(),
		completed: booleanField("completed").notNull().default(false),
		completedByUserId: text("completed_by_user_id").references(() => users.id, {
			onDelete: "set null",
		}),
		completedAt: text("completed_at"),
		sourceAgreementId: text("source_agreement_id").references(
			(): any => agreements.id,
			{ onDelete: "set null" },
		),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		updatedAt: text("updated_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => ({
		boardIdIdx: indexField("agreements_board_id_idx").on(table.boardId),
		completedIdx: indexField("agreements_completed_idx").on(
			table.boardId,
			table.completed,
		),
	}),
);

export const healthQuestions = table(
	"health_questions",
	{
		id: text("id").primaryKey(),
		threadId: text("thread_id").notNull(),
		sceneId: text("scene_id")
			.notNull()
			.references(() => scenes.id, { onDelete: "cascade" }),
		question: text("question").notNull(),
		description: text("description"),
		questionType: text("question_type")
			.notNull()
			.$type<"boolean" | "range1to5" | "agreetodisagree" | "redyellowgreen">(),
		seq: integer("seq").notNull(),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => ({
		threadIdx: indexField("health_questions_thread_id_idx").on(table.threadId),
	}),
);

export const healthResponses = table(
	"health_responses",
	{
		id: text("id").primaryKey(),
		questionId: text("question_id")
			.notNull()
			.references(() => healthQuestions.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		rating: integer("rating").notNull(),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => ({
		uniqueResponse: unique().on(table.questionId, table.userId),
	}),
);

export const presence = table(
	"presence",
	{
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		boardId: text("board_id")
			.notNull()
			.references(() => boards.id, { onDelete: "cascade" }),
		lastSeen: bigintField("last_seen").notNull(),
		currentActivity: text("current_activity"),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.userId, table.boardId] }),
	}),
);

// Timer fields moved to boards table (timerStart, timerDuration)

// Timer extension votes removed - handled in client state

export const userAuthenticators = table("user_authenticators", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	credentialId: text("credential_id").notNull().unique(),
	credentialPublicKey: text("credential_public_key", {
		mode: "text",
	}).notNull(),
	counter: integer("counter").notNull().default(0),
	credentialDeviceType: text("credential_device_type"),
	credentialBackedUp: booleanField("credential_backed_up")
		.notNull()
		.default(false),
	transports: text("transports"),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// Performance monitoring tables - using text IDs like other tables for consistency
// Note: Using direct imports instead of helpers to avoid Drizzle Kit introspection issues
const perfReal = isPostgres ? pgReal : sqliteReal;
const perfBigint = isPostgres ? pgBigint : sqliteInteger;
const perfIndex = isPostgres ? pgIndex : sqliteIndex;

export const metricSnapshots = table(
	"metric_snapshots",
	{
		id: text("id").primaryKey(),
		timestamp: perfBigint("timestamp", { mode: "number" }).notNull(),
		concurrent_users: integer("concurrent_users").notNull(),
		peak_concurrent_users: integer("peak_concurrent_users").notNull(),
		active_connections: integer("active_connections").notNull(),
		total_operations: integer("total_operations").notNull(),
		broadcast_p95: perfReal("broadcast_p95").notNull(),
		broadcast_p99: perfReal("broadcast_p99").notNull(),
		messages_sent: integer("messages_sent").notNull(),
	},
	(table) => ({
		timestampIdx: perfIndex("metric_snapshots_timestamp_idx").on(
			table.timestamp,
		),
	}),
);

export const boardMetrics = table(
	"board_metrics",
	{
		id: text("id").primaryKey(),
		board_id: text("board_id").notNull(),
		timestamp: perfBigint("timestamp", { mode: "number" }).notNull(),
		broadcast_count: integer("broadcast_count").notNull(),
		avg_broadcast_duration: perfReal("avg_broadcast_duration").notNull(),
	},
	(table) => ({
		boardTimestampIdx: perfIndex("board_metrics_board_timestamp_idx").on(
			table.board_id,
			table.timestamp,
		),
	}),
);

export const slowQueries = table(
	"slow_queries",
	{
		id: text("id").primaryKey(),
		timestamp: perfBigint("timestamp", { mode: "number" }).notNull(),
		duration: perfReal("duration").notNull(),
		query: text("query").notNull(),
		board_id: text("board_id"),
	},
	(table) => ({
		timestampIdx: perfIndex("slow_queries_timestamp_idx").on(table.timestamp),
	}),
);

// Scorecard tables - for data-driven meeting insights
export const scorecards = table(
	"scorecards",
	{
		id: text("id").primaryKey(),
		seriesId: text("series_id")
			.notNull()
			.references(() => boardSeries.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => users.id),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		updatedAt: text("updated_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => ({
		seriesIdx: indexField("scorecards_series_idx").on(table.seriesId),
	}),
);

export const scorecardDatasources = table(
	"scorecard_datasources",
	{
		id: text("id").primaryKey(),
		scorecardId: text("scorecard_id")
			.notNull()
			.references(() => scorecards.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		seq: integer("seq").notNull(),
		sourceType: text("source_type").notNull().$type<"paste" | "api">(),
		apiConfig: text("api_config"), // JSON: {url, auth_type, credentials_encrypted}
		dataSchema: text("data_schema"), // JSON: describes expected data shape
		rules: text("rules").notNull(), // JSON: array of rule objects
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
		updatedAt: text("updated_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => ({
		scorecardIdx: indexField("scorecard_datasources_scorecard_idx").on(
			table.scorecardId,
		),
	}),
);

export const sceneScorecards = table(
	"scene_scorecards",
	{
		id: text("id").primaryKey(),
		sceneId: text("scene_id")
			.notNull()
			.references(() => scenes.id, { onDelete: "cascade" }),
		scorecardId: text("scorecard_id")
			.notNull()
			.references(() => scorecards.id, { onDelete: "cascade" }),
		collectedData: text("collected_data"), // JSON: all datasource data combined
		processedAt: text("processed_at"),
		createdAt: text("created_at")
			.notNull()
			.$defaultFn(() => new Date().toISOString()),
	},
	(table) => ({
		sceneIdx: indexField("scene_scorecards_scene_idx").on(table.sceneId),
		scorecardIdx: indexField("scene_scorecards_scorecard_idx").on(
			table.scorecardId,
		),
	}),
);

export const sceneScorecardResults = table(
	"scene_scorecard_results",
	{
		id: text("id").primaryKey(),
		sceneScorecardId: text("scene_scorecard_id")
			.notNull()
			.references(() => sceneScorecards.id, { onDelete: "cascade" }),
		datasourceId: text("datasource_id")
			.notNull()
			.references(() => scorecardDatasources.id),
		section: text("section").notNull(),
		title: text("title").notNull(),
		primaryValue: text("primary_value"),
		secondaryValues: text("secondary_values"), // JSON: additional fields
		severity: text("severity")
			.notNull()
			.$type<"info" | "warning" | "critical">(),
		sourceData: text("source_data"), // JSON: full original record
		seq: integer("seq").notNull(),
	},
	(table) => ({
		sceneScorecardIdx: indexField(
			"scene_scorecard_results_scene_scorecard_idx",
		).on(table.sceneScorecardId),
	}),
);

// Drizzle ORM Relations - required for relational queries with .query API
export const boardsRelations = relations(boards, ({ one, many }) => ({
	series: one(boardSeries, {
		fields: [boards.seriesId],
		references: [boardSeries.id],
	}),
	columns: many(columns),
	scenes: many(scenes),
	agreements: many(agreements),
	presence: many(presence),
}));

export const columnsRelations = relations(columns, ({ one, many }) => ({
	board: one(boards, {
		fields: [columns.boardId],
		references: [boards.id],
	}),
	cards: many(cards),
	scenesColumns: many(scenesColumns),
}));

export const boardSeriesRelations = relations(boardSeries, ({ many }) => ({
	boards: many(boards),
	members: many(seriesMembers),
	scorecards: many(scorecards),
}));

export const seriesMembersRelations = relations(seriesMembers, ({ one }) => ({
	series: one(boardSeries, {
		fields: [seriesMembers.seriesId],
		references: [boardSeries.id],
	}),
	user: one(users, {
		fields: [seriesMembers.userId],
		references: [users.id],
	}),
}));

export const scenesRelations = relations(scenes, ({ one, many }) => ({
	board: one(boards, {
		fields: [scenes.boardId],
		references: [boards.id],
	}),
	selectedCard: one(cards, {
		fields: [scenes.selectedCardId],
		references: [cards.id],
	}),
	focusedQuestion: one(healthQuestions, {
		fields: [scenes.focusedQuestionId],
		references: [healthQuestions.id],
	}),
	scenesColumns: many(scenesColumns),
	sceneFlags: many(sceneFlags),
	healthQuestions: many(healthQuestions),
	sceneScorecards: many(sceneScorecards),
	quadrantPositions: many(quadrantPositions),
}));

export const scenesColumnsRelations = relations(scenesColumns, ({ one }) => ({
	scene: one(scenes, {
		fields: [scenesColumns.sceneId],
		references: [scenes.id],
	}),
	column: one(columns, {
		fields: [scenesColumns.columnId],
		references: [columns.id],
	}),
}));

export const sceneFlagsRelations = relations(sceneFlags, ({ one }) => ({
	scene: one(scenes, {
		fields: [sceneFlags.sceneId],
		references: [scenes.id],
	}),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
	column: one(columns, {
		fields: [cards.columnId],
		references: [columns.id],
	}),
	user: one(users, {
		fields: [cards.userId],
		references: [users.id],
	}),
	votes: many(votes),
	comments: many(comments),
	quadrantPositions: many(quadrantPositions),
}));

export const quadrantPositionsRelations = relations(
	quadrantPositions,
	({ one }) => ({
		card: one(cards, {
			fields: [quadrantPositions.cardId],
			references: [cards.id],
		}),
		user: one(users, {
			fields: [quadrantPositions.userId],
			references: [users.id],
		}),
		scene: one(scenes, {
			fields: [quadrantPositions.sceneId],
			references: [scenes.id],
		}),
	}),
);

export const votesRelations = relations(votes, ({ one }) => ({
	card: one(cards, {
		fields: [votes.cardId],
		references: [cards.id],
	}),
	user: one(users, {
		fields: [votes.userId],
		references: [users.id],
	}),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
	card: one(cards, {
		fields: [comments.cardId],
		references: [cards.id],
	}),
	user: one(users, {
		fields: [comments.userId],
		references: [users.id],
		relationName: "commentAuthor",
	}),
	completedBy: one(users, {
		fields: [comments.completedByUserId],
		references: [users.id],
		relationName: "commentCompleter",
	}),
}));

export const agreementsRelations = relations(agreements, ({ one }) => ({
	board: one(boards, {
		fields: [agreements.boardId],
		references: [boards.id],
	}),
	user: one(users, {
		fields: [agreements.userId],
		references: [users.id],
		relationName: "agreementAuthor",
	}),
	completedBy: one(users, {
		fields: [agreements.completedByUserId],
		references: [users.id],
		relationName: "agreementCompleter",
	}),
	sourceAgreement: one(agreements, {
		fields: [agreements.sourceAgreementId],
		references: [agreements.id],
	}),
}));

export const healthQuestionsRelations = relations(
	healthQuestions,
	({ one, many }) => ({
		scene: one(scenes, {
			fields: [healthQuestions.sceneId],
			references: [scenes.id],
		}),
		responses: many(healthResponses),
	}),
);

export const healthResponsesRelations = relations(
	healthResponses,
	({ one }) => ({
		question: one(healthQuestions, {
			fields: [healthResponses.questionId],
			references: [healthQuestions.id],
		}),
		user: one(users, {
			fields: [healthResponses.userId],
			references: [users.id],
		}),
	}),
);

export const presenceRelations = relations(presence, ({ one }) => ({
	user: one(users, {
		fields: [presence.userId],
		references: [users.id],
	}),
	board: one(boards, {
		fields: [presence.boardId],
		references: [boards.id],
	}),
}));

export const usersRelations = relations(users, ({ many }) => ({
	seriesMembers: many(seriesMembers),
	cards: many(cards),
	votes: many(votes),
	authoredComments: many(comments, { relationName: "commentAuthor" }),
	completedComments: many(comments, { relationName: "commentCompleter" }),
	authoredAgreements: many(agreements, { relationName: "agreementAuthor" }),
	completedAgreements: many(agreements, { relationName: "agreementCompleter" }),
	healthResponses: many(healthResponses),
	presence: many(presence),
	authenticators: many(userAuthenticators),
	quadrantPositions: many(quadrantPositions),
}));

export const userAuthenticatorsRelations = relations(
	userAuthenticators,
	({ one }) => ({
		user: one(users, {
			fields: [userAuthenticators.userId],
			references: [users.id],
		}),
	}),
);

export const scorecardsRelations = relations(scorecards, ({ one, many }) => ({
	series: one(boardSeries, {
		fields: [scorecards.seriesId],
		references: [boardSeries.id],
	}),
	createdBy: one(users, {
		fields: [scorecards.createdByUserId],
		references: [users.id],
	}),
	datasources: many(scorecardDatasources),
	sceneScorecards: many(sceneScorecards),
}));

export const scorecardDatasourcesRelations = relations(
	scorecardDatasources,
	({ one, many }) => ({
		scorecard: one(scorecards, {
			fields: [scorecardDatasources.scorecardId],
			references: [scorecards.id],
		}),
		results: many(sceneScorecardResults),
	}),
);

export const sceneScorecardsRelations = relations(
	sceneScorecards,
	({ one, many }) => ({
		scene: one(scenes, {
			fields: [sceneScorecards.sceneId],
			references: [scenes.id],
		}),
		scorecard: one(scorecards, {
			fields: [sceneScorecards.scorecardId],
			references: [scorecards.id],
		}),
		results: many(sceneScorecardResults),
	}),
);

export const sceneScorecardResultsRelations = relations(
	sceneScorecardResults,
	({ one }) => ({
		sceneScorecard: one(sceneScorecards, {
			fields: [sceneScorecardResults.sceneScorecardId],
			references: [sceneScorecards.id],
		}),
		datasource: one(scorecardDatasources, {
			fields: [sceneScorecardResults.datasourceId],
			references: [scorecardDatasources.id],
		}),
	}),
);
