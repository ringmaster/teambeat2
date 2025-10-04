-- Add scorecards table
CREATE TABLE IF NOT EXISTS "scorecards" (
	"id" text PRIMARY KEY NOT NULL,
	"series_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_by_user_id" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "scorecards_series_id_board_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "board_series"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "scorecards_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "scorecards_series_idx" ON "scorecards" ("series_id");

-- Add scorecard_datasources table
CREATE TABLE IF NOT EXISTS "scorecard_datasources" (
	"id" text PRIMARY KEY NOT NULL,
	"scorecard_id" text NOT NULL,
	"name" text NOT NULL,
	"seq" integer NOT NULL,
	"source_type" text NOT NULL,
	"api_config" text,
	"data_schema" text,
	"rules" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "scorecard_datasources_scorecard_id_scorecards_id_fk" FOREIGN KEY ("scorecard_id") REFERENCES "scorecards"("id") ON DELETE cascade ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "scorecard_datasources_scorecard_idx" ON "scorecard_datasources" ("scorecard_id");

-- Add scene_scorecards table
CREATE TABLE IF NOT EXISTS "scene_scorecards" (
	"id" text PRIMARY KEY NOT NULL,
	"scene_id" text NOT NULL,
	"scorecard_id" text NOT NULL,
	"collected_data" text,
	"processed_at" text,
	"created_at" text NOT NULL,
	CONSTRAINT "scene_scorecards_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "scene_scorecards_scorecard_id_scorecards_id_fk" FOREIGN KEY ("scorecard_id") REFERENCES "scorecards"("id") ON DELETE cascade ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "scene_scorecards_scene_idx" ON "scene_scorecards" ("scene_id");
CREATE INDEX IF NOT EXISTS "scene_scorecards_scorecard_idx" ON "scene_scorecards" ("scorecard_id");

-- Add scene_scorecard_results table
CREATE TABLE IF NOT EXISTS "scene_scorecard_results" (
	"id" text PRIMARY KEY NOT NULL,
	"scene_scorecard_id" text NOT NULL,
	"datasource_id" text NOT NULL,
	"section" text NOT NULL,
	"title" text NOT NULL,
	"primary_value" text,
	"secondary_values" text,
	"severity" text NOT NULL,
	"source_data" text,
	"seq" integer NOT NULL,
	CONSTRAINT "scene_scorecard_results_scene_scorecard_id_scene_scorecards_id_fk" FOREIGN KEY ("scene_scorecard_id") REFERENCES "scene_scorecards"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "scene_scorecard_results_datasource_id_scorecard_datasources_id_fk" FOREIGN KEY ("datasource_id") REFERENCES "scorecard_datasources"("id") ON DELETE no action ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "scene_scorecard_results_scene_scorecard_idx" ON "scene_scorecard_results" ("scene_scorecard_id");
