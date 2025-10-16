-- Remove old boolean permission columns from scenes table
-- SQLite doesn't support DROP COLUMN, so we need to recreate the table

-- Step 1: Create new scenes table without the boolean columns
CREATE TABLE scenes_new (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  mode TEXT NOT NULL,
  seq INTEGER NOT NULL,
  selected_card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
  display_rule TEXT,
  display_mode TEXT NOT NULL DEFAULT 'collecting',
  focused_question_id TEXT REFERENCES health_questions(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

-- Step 2: Copy data from old table to new table
INSERT INTO scenes_new (id, board_id, title, description, mode, seq, selected_card_id, display_rule, display_mode, focused_question_id, created_at)
SELECT id, board_id, title, description, mode, seq, selected_card_id, display_rule, display_mode, focused_question_id, created_at
FROM scenes;

-- Step 3: Drop old table
DROP TABLE scenes;

-- Step 4: Rename new table to scenes
ALTER TABLE scenes_new RENAME TO scenes;

-- Step 5: Recreate indexes and foreign key references will be handled by the table creation
