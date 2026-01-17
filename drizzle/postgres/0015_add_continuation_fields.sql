ALTER TABLE "scenes" ADD COLUMN "continuation_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scenes" ADD COLUMN "continuation_scene_id" text;
