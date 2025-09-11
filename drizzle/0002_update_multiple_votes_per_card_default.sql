PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_scenes` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`mode` text NOT NULL,
	`seq` integer NOT NULL,
	`allow_add_cards` integer DEFAULT true,
	`allow_edit_cards` integer DEFAULT true,
	`allow_obscure_cards` integer DEFAULT false,
	`allow_move_cards` integer DEFAULT true,
	`allow_group_cards` integer DEFAULT false,
	`show_votes` integer DEFAULT true,
	`allow_voting` integer DEFAULT false,
	`show_comments` integer DEFAULT true,
	`allow_comments` integer DEFAULT true,
	`multiple_votes_per_card` integer DEFAULT true,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_scenes`("id", "board_id", "title", "description", "mode", "seq", "allow_add_cards", "allow_edit_cards", "allow_obscure_cards", "allow_move_cards", "allow_group_cards", "show_votes", "allow_voting", "show_comments", "allow_comments", "multiple_votes_per_card", "created_at") SELECT "id", "board_id", "title", "description", "mode", "seq", "allow_add_cards", "allow_edit_cards", "allow_obscure_cards", "allow_move_cards", "allow_group_cards", "show_votes", "allow_voting", "show_comments", "allow_comments", "multiple_votes_per_card", "created_at" FROM `scenes`;--> statement-breakpoint
DROP TABLE `scenes`;--> statement-breakpoint
ALTER TABLE `__new_scenes` RENAME TO `scenes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;