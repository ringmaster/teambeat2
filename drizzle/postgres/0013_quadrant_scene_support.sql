-- Add quadrant scene support

-- Add quadrant fields to scenes table
ALTER TABLE "scenes" ADD COLUMN "quadrant_config" text;
ALTER TABLE "scenes" ADD COLUMN "present_mode_filter" text;
ALTER TABLE "scenes" ADD COLUMN "quadrant_phase" text;

-- Add quadrant metadata to cards table
ALTER TABLE "cards" ADD COLUMN "quadrant_metadata" text;

-- Create quadrant_positions table
CREATE TABLE "quadrant_positions" (
	"id" text PRIMARY KEY NOT NULL,
	"card_id" text NOT NULL,
	"user_id" text NOT NULL,
	"scene_id" text NOT NULL,
	"x_value" integer NOT NULL,
	"y_value" integer NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "quadrant_positions_card_id_user_id_scene_id_unique" UNIQUE("card_id","user_id","scene_id")
);

-- Add foreign keys
ALTER TABLE "quadrant_positions" ADD CONSTRAINT "quadrant_positions_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "quadrant_positions" ADD CONSTRAINT "quadrant_positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "quadrant_positions" ADD CONSTRAINT "quadrant_positions_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "scenes"("id") ON DELETE cascade ON UPDATE no action;

-- Add indexes
CREATE INDEX "quadrant_positions_scene_idx" ON "quadrant_positions" ("scene_id");
CREATE INDEX "quadrant_positions_card_idx" ON "quadrant_positions" ("card_id");
