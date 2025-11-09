CREATE TABLE `feature_analytics_hourly` (
	`id` text PRIMARY KEY NOT NULL,
	`hour_start` text NOT NULL,
	`feature` text NOT NULL,
	`action` text NOT NULL,
	`event_count` integer DEFAULT 0 NOT NULL,
	`unique_users_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `feature_analytics_daily` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`feature` text NOT NULL,
	`action` text NOT NULL,
	`event_count` integer DEFAULT 0 NOT NULL,
	`unique_users_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `feature_analytics_hourly_hour_idx` ON `feature_analytics_hourly` (`hour_start`);
--> statement-breakpoint
CREATE INDEX `feature_analytics_hourly_feature_idx` ON `feature_analytics_hourly` (`feature`);
--> statement-breakpoint
CREATE INDEX `feature_analytics_daily_date_idx` ON `feature_analytics_daily` (`date`);
--> statement-breakpoint
CREATE INDEX `feature_analytics_daily_feature_idx` ON `feature_analytics_daily` (`feature`);
