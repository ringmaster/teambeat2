CREATE TABLE "board_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"timestamp" bigint NOT NULL,
	"broadcast_count" integer NOT NULL,
	"avg_broadcast_duration" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_series" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"description" text,
	"created_at" text NOT NULL,
	CONSTRAINT "board_series_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" text PRIMARY KEY NOT NULL,
	"series_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_scene_id" text,
	"blame_free_mode" boolean DEFAULT false NOT NULL,
	"voting_allocation" integer DEFAULT 3 NOT NULL,
	"voting_enabled" boolean DEFAULT true NOT NULL,
	"meeting_date" text,
	"timer_start" text,
	"timer_duration" integer,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"column_id" text NOT NULL,
	"user_id" text,
	"content" text NOT NULL,
	"notes" text,
	"group_id" text,
	"is_group_lead" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "columns" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"seq" integer NOT NULL,
	"default_appearance" text DEFAULT 'shown' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"user_id" text,
	"content" text NOT NULL,
	"is_agreement" boolean DEFAULT false NOT NULL,
	"is_reaction" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"question" text NOT NULL,
	"seq" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_responses" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "health_responses_question_id_user_id_unique" UNIQUE("question_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "metric_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" bigint NOT NULL,
	"concurrent_users" integer NOT NULL,
	"peak_concurrent_users" integer NOT NULL,
	"active_connections" integer NOT NULL,
	"total_operations" integer NOT NULL,
	"broadcast_p95" real NOT NULL,
	"broadcast_p99" real NOT NULL,
	"messages_sent" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presence" (
	"user_id" text NOT NULL,
	"board_id" text NOT NULL,
	"last_seen" bigint NOT NULL,
	"current_activity" text,
	CONSTRAINT "presence_user_id_board_id_pk" PRIMARY KEY("user_id","board_id")
);
--> statement-breakpoint
CREATE TABLE "scenes" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"mode" text NOT NULL,
	"seq" integer NOT NULL,
	"selected_card_id" text,
	"allow_add_cards" boolean DEFAULT true NOT NULL,
	"allow_edit_cards" boolean DEFAULT true NOT NULL,
	"allow_obscure_cards" boolean DEFAULT false NOT NULL,
	"allow_move_cards" boolean DEFAULT true NOT NULL,
	"allow_group_cards" boolean DEFAULT false NOT NULL,
	"show_votes" boolean DEFAULT true NOT NULL,
	"allow_voting" boolean DEFAULT false NOT NULL,
	"show_comments" boolean DEFAULT true NOT NULL,
	"allow_comments" boolean DEFAULT true NOT NULL,
	"multiple_votes_per_card" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenes_columns" (
	"scene_id" text NOT NULL,
	"column_id" text NOT NULL,
	"state" text DEFAULT 'visible' NOT NULL,
	CONSTRAINT "scenes_columns_scene_id_column_id_pk" PRIMARY KEY("scene_id","column_id")
);
--> statement-breakpoint
CREATE TABLE "series_members" (
	"series_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"joined_at" text NOT NULL,
	CONSTRAINT "series_members_series_id_user_id_pk" PRIMARY KEY("series_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "slow_queries" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" bigint NOT NULL,
	"duration" real NOT NULL,
	"query" text NOT NULL,
	"board_id" text
);
--> statement-breakpoint
CREATE TABLE "user_authenticators" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"credential_public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"credential_device_type" text,
	"credential_backed_up" boolean DEFAULT false NOT NULL,
	"transports" text,
	"created_at" text NOT NULL,
	CONSTRAINT "user_authenticators_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password_hash" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_series_id_board_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."board_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_column_id_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."columns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "columns" ADD CONSTRAINT "columns_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_questions" ADD CONSTRAINT "health_questions_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_responses" ADD CONSTRAINT "health_responses_question_id_health_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."health_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_responses" ADD CONSTRAINT "health_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence" ADD CONSTRAINT "presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presence" ADD CONSTRAINT "presence_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_selected_card_id_cards_id_fk" FOREIGN KEY ("selected_card_id") REFERENCES "public"."cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes_columns" ADD CONSTRAINT "scenes_columns_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes_columns" ADD CONSTRAINT "scenes_columns_column_id_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."columns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_members" ADD CONSTRAINT "series_members_series_id_board_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."board_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_members" ADD CONSTRAINT "series_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_authenticators" ADD CONSTRAINT "user_authenticators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_metrics_board_timestamp_idx" ON "board_metrics" USING btree ("board_id","timestamp");--> statement-breakpoint
CREATE INDEX "metric_snapshots_timestamp_idx" ON "metric_snapshots" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "slow_queries_timestamp_idx" ON "slow_queries" USING btree ("timestamp");