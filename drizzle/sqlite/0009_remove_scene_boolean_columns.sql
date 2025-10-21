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
);--> statement-breakpoint
INSERT INTO scenes_new (id, board_id, title, description, mode, seq, selected_card_id, display_rule, display_mode, focused_question_id, created_at)
SELECT id, board_id, title, description, mode, seq, selected_card_id, display_rule, display_mode, focused_question_id, created_at
FROM scenes;--> statement-breakpoint
DROP TABLE scenes;--> statement-breakpoint
ALTER TABLE scenes_new RENAME TO scenes;
