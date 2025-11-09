-- Add feature analytics tables for persistent storage

-- Hourly rollups
CREATE TABLE "feature_analytics_hourly" (
	"id" text PRIMARY KEY NOT NULL,
	"hour_start" text NOT NULL,
	"feature" text NOT NULL,
	"action" text NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"unique_users_count" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL
);

-- Daily rollups
CREATE TABLE "feature_analytics_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"feature" text NOT NULL,
	"action" text NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"unique_users_count" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL
);

-- Add indexes for efficient querying
CREATE INDEX "feature_analytics_hourly_hour_idx" ON "feature_analytics_hourly" ("hour_start");
CREATE INDEX "feature_analytics_hourly_feature_idx" ON "feature_analytics_hourly" ("feature");
CREATE INDEX "feature_analytics_daily_date_idx" ON "feature_analytics_daily" ("date");
CREATE INDEX "feature_analytics_daily_feature_idx" ON "feature_analytics_daily" ("feature");
