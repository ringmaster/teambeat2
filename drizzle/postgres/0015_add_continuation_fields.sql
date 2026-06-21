-- Add continuation fields to scenes (survey multi-phase support)
-- Idempotent: safe to run on databases that already have these columns.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scenes' AND column_name = 'continuation_enabled'
  ) THEN
    ALTER TABLE "scenes" ADD COLUMN "continuation_enabled" boolean DEFAULT false NOT NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scenes' AND column_name = 'continuation_scene_id'
  ) THEN
    ALTER TABLE "scenes" ADD COLUMN "continuation_scene_id" text;
  END IF;
END $$;
