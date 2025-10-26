CREATE TABLE `quadrant_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`user_id` text NOT NULL,
	`scene_id` text NOT NULL,
	`x_value` integer NOT NULL,
	`y_value` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quadrant_positions_scene_idx` ON `quadrant_positions` (`scene_id`);--> statement-breakpoint
CREATE INDEX `quadrant_positions_card_idx` ON `quadrant_positions` (`card_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `quadrant_positions_card_id_user_id_scene_id_unique` ON `quadrant_positions` (`card_id`,`user_id`,`scene_id`);--> statement-breakpoint
ALTER TABLE `cards` ADD `quadrant_metadata` text;--> statement-breakpoint
ALTER TABLE `scenes` ADD `quadrant_config` text;--> statement-breakpoint
ALTER TABLE `scenes` ADD `present_mode_filter` text;--> statement-breakpoint
ALTER TABLE `scenes` ADD `quadrant_phase` text;