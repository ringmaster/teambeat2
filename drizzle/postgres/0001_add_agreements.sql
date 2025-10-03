-- Add agreements table
CREATE TABLE IF NOT EXISTS "agreements" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"user_id" text,
	"content" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_by_user_id" text,
	"completed_at" text,
	"source_agreement_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "agreements_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "boards"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "agreements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "agreements_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "agreements_source_agreement_id_agreements_id_fk" FOREIGN KEY ("source_agreement_id") REFERENCES "agreements"("id") ON DELETE set null ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "agreements_board_id_idx" ON "agreements" ("board_id");
CREATE INDEX IF NOT EXISTS "agreements_completed_idx" ON "agreements" ("board_id","completed");

-- Add completion fields to comments table
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "completed" boolean DEFAULT false NOT NULL;
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "completed_by_user_id" text;
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "completed_at" text;

-- Add foreign key constraint for completed_by_user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'comments_completed_by_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "comments" ADD CONSTRAINT "comments_completed_by_user_id_users_id_fk"
        FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "comments_agreement_completed_idx" ON "comments" ("card_id","is_agreement","completed");
