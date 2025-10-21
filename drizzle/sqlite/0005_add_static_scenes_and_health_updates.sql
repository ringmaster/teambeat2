ALTER TABLE scenes ADD COLUMN display_rule TEXT;--> statement-breakpoint
CREATE TABLE health_questions_new (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  description TEXT,
  question_type TEXT NOT NULL,
  seq INTEGER NOT NULL,
  created_at TEXT NOT NULL
);--> statement-breakpoint
DROP TABLE IF EXISTS health_questions;--> statement-breakpoint
ALTER TABLE health_questions_new RENAME TO health_questions;
