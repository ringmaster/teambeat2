DROP TABLE `board_timers`;--> statement-breakpoint
DROP TABLE `timer_extension_votes`;--> statement-breakpoint
ALTER TABLE `boards` ADD `timer_start` text;--> statement-breakpoint
ALTER TABLE `boards` ADD `timer_duration` integer;