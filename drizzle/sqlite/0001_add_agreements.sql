CREATE TABLE `agreements` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`user_id` text,
	`content` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`completed_by_user_id` text,
	`completed_at` text,
	`source_agreement_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`completed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_agreement_id`) REFERENCES `agreements`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `agreements_board_id_idx` ON `agreements` (`board_id`);--> statement-breakpoint
CREATE INDEX `agreements_completed_idx` ON `agreements` (`board_id`,`completed`);--> statement-breakpoint
CREATE TABLE `board_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`timestamp` integer NOT NULL,
	`broadcast_count` integer NOT NULL,
	`avg_broadcast_duration` real NOT NULL
);
--> statement-breakpoint
CREATE INDEX `board_metrics_board_timestamp_idx` ON `board_metrics` (`board_id`,`timestamp`);--> statement-breakpoint
CREATE TABLE `metric_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` integer NOT NULL,
	`concurrent_users` integer NOT NULL,
	`peak_concurrent_users` integer NOT NULL,
	`active_connections` integer NOT NULL,
	`total_operations` integer NOT NULL,
	`broadcast_p95` real NOT NULL,
	`broadcast_p99` real NOT NULL,
	`messages_sent` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `metric_snapshots_timestamp_idx` ON `metric_snapshots` (`timestamp`);--> statement-breakpoint
CREATE TABLE `slow_queries` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` integer NOT NULL,
	`duration` real NOT NULL,
	`query` text NOT NULL,
	`board_id` text
);
--> statement-breakpoint
CREATE INDEX `slow_queries_timestamp_idx` ON `slow_queries` (`timestamp`);--> statement-breakpoint
ALTER TABLE `comments` ADD `completed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `comments` ADD `completed_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `comments` ADD `completed_at` text;--> statement-breakpoint
CREATE INDEX `comments_agreement_completed_idx` ON `comments` (`card_id`,`is_agreement`,`completed`);--> statement-breakpoint
ALTER TABLE `users` ADD `is_admin` integer DEFAULT false NOT NULL;