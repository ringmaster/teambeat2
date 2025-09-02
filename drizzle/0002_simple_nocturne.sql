PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_scene_column_settings` (
	`scene_id` text NOT NULL,
	`column_id` text NOT NULL,
	`display` text DEFAULT 'show' NOT NULL,
	PRIMARY KEY(`scene_id`, `column_id`),
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`column_id`) REFERENCES `columns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_scene_column_settings`("scene_id", "column_id", "display") SELECT "scene_id", "column_id", "appearance" FROM `scene_column_settings`;--> statement-breakpoint
DROP TABLE `scene_column_settings`;--> statement-breakpoint
ALTER TABLE `__new_scene_column_settings` RENAME TO `scene_column_settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `scenes` ADD `allow_obscure_cards` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `scenes` ADD `allow_move_cards` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `scenes` ADD `allow_group_cards` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `scenes` ADD `show_votes` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `scenes` ADD `show_comments` integer DEFAULT true;