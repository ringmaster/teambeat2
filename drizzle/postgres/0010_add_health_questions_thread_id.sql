-- Add thread_id column to health_questions table
ALTER TABLE health_questions ADD COLUMN thread_id TEXT;

-- Set thread_id to the question's own id for existing questions (each starts its own thread)
UPDATE health_questions SET thread_id = id WHERE thread_id IS NULL;

-- Make thread_id NOT NULL
ALTER TABLE health_questions ALTER COLUMN thread_id SET NOT NULL;

-- Create index on thread_id for efficient historical queries
CREATE INDEX health_questions_thread_id_idx ON health_questions(thread_id);
