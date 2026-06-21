-- Add api_tokens table for programmatic / AI access
-- Handwritten migration: do NOT regenerate with drizzle-kit (composite index bug)
-- Token hashes are SHA-256 of the raw tb_* token; raw tokens are never stored.

CREATE TABLE IF NOT EXISTS `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`token_hash` text NOT NULL,
	`label` text NOT NULL,
	`expires_at` integer NOT NULL,
	`last_used_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `api_tokens_token_hash_unique` ON `api_tokens` (`token_hash`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `api_tokens_user_id_idx` ON `api_tokens` (`user_id`);
