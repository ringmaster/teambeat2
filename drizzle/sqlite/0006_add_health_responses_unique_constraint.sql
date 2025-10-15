-- Add unique constraint on (question_id, user_id) for health_responses
-- This ensures one response per user per question
CREATE UNIQUE INDEX IF NOT EXISTS health_responses_question_id_user_id_unique
ON health_responses(question_id, user_id);
