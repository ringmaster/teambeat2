
-- Add index for querying agreements by completion status
CREATE INDEX IF NOT EXISTS comments_agreement_completed_idx
ON comments(card_id, is_agreement, completed);
