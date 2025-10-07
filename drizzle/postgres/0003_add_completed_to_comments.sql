-- Add completed functionality to comments table
ALTER TABLE comments
ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS completed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS completed_at TEXT;

-- Add index for querying agreements by completion status
CREATE INDEX IF NOT EXISTS comments_agreement_completed_idx
ON comments(card_id, is_agreement, completed);
