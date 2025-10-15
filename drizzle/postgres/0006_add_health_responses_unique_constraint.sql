-- Add unique constraint on (question_id, user_id) for health_responses
-- This ensures one response per user per question
ALTER TABLE health_responses
ADD CONSTRAINT health_responses_question_id_user_id_unique
UNIQUE (question_id, user_id);
