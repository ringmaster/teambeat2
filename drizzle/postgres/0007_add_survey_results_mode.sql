-- Add survey results mode fields to scenes table
ALTER TABLE scenes ADD COLUMN display_mode TEXT NOT NULL DEFAULT 'collecting';
ALTER TABLE scenes ADD COLUMN focused_question_id TEXT REFERENCES health_questions(id) ON DELETE SET NULL;

-- Add check constraint for display_mode
ALTER TABLE scenes ADD CONSTRAINT scenes_display_mode_check CHECK (display_mode IN ('collecting', 'results'));
