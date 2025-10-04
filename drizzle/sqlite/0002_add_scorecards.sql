CREATE TABLE `scorecards` (
	`id` text PRIMARY KEY NOT NULL,
	`series_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_by_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`series_id`) REFERENCES `board_series`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scorecards_series_idx` ON `scorecards` (`series_id`);--> statement-breakpoint
CREATE TABLE `scorecard_datasources` (
	`id` text PRIMARY KEY NOT NULL,
	`scorecard_id` text NOT NULL,
	`name` text NOT NULL,
	`seq` integer NOT NULL,
	`source_type` text NOT NULL,
	`api_config` text,
	`data_schema` text,
	`rules` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`scorecard_id`) REFERENCES `scorecards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scorecard_datasources_scorecard_idx` ON `scorecard_datasources` (`scorecard_id`);--> statement-breakpoint
CREATE TABLE `scene_scorecards` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`scorecard_id` text NOT NULL,
	`collected_data` text,
	`processed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scorecard_id`) REFERENCES `scorecards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scene_scorecards_scene_idx` ON `scene_scorecards` (`scene_id`);--> statement-breakpoint
CREATE INDEX `scene_scorecards_scorecard_idx` ON `scene_scorecards` (`scorecard_id`);--> statement-breakpoint
CREATE TABLE `scene_scorecard_results` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_scorecard_id` text NOT NULL,
	`datasource_id` text NOT NULL,
	`section` text NOT NULL,
	`title` text NOT NULL,
	`primary_value` text,
	`secondary_values` text,
	`severity` text NOT NULL,
	`source_data` text,
	`seq` integer NOT NULL,
	FOREIGN KEY (`scene_scorecard_id`) REFERENCES `scene_scorecards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`datasource_id`) REFERENCES `scorecard_datasources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scene_scorecard_results_scene_scorecard_idx` ON `scene_scorecard_results` (`scene_scorecard_id`);
