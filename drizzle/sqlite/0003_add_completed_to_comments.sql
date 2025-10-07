-- Add completed functionality to comments table
ALTER TABLE comments ADD COLUMN completed INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE comments ADD COLUMN completed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE comments ADD COLUMN completed_at TEXT;

-- Add index for querying agreements by completion status
CREATE INDEX IF NOT EXISTS comments_agreement_completed_idx
ON comments(card_id, is_agreement, completed);
