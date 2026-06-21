-- Add api_tokens table for programmatic / AI access
-- Handwritten migration: do NOT regenerate with drizzle-kit (composite index bug)
-- Token hashes are SHA-256 of the raw tb_* token; raw tokens are never stored.

CREATE TABLE IF NOT EXISTS "api_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"label" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"last_used_at" bigint,
	"created_at" bigint NOT NULL,
	CONSTRAINT "api_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_tokens_token_hash_unique" ON "api_tokens" ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_tokens_user_id_idx" ON "api_tokens" ("user_id");
