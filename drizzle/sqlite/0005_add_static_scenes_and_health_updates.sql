-- Add display_rule field to scenes table for conditional scene display
ALTER TABLE scenes ADD COLUMN display_rule TEXT;

-- Restructure health_questions table to be scene-based instead of board-based
-- SQLite doesn't support dropping columns, so we need to recreate the table

-- Step 1: Create new health_questions table with updated schema
CREATE TABLE health_questions_new (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  description TEXT,
  question_type TEXT NOT NULL,
  seq INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- Step 2: If there's existing data, we would migrate it here
-- For now, we'll skip this as health questions should be associated with scenes
-- Any existing health questions would need manual migration to appropriate scenes

-- Step 3: Drop old table
DROP TABLE IF EXISTS health_questions;

-- Step 4: Rename new table
ALTER TABLE health_questions_new RENAME TO health_questions;
