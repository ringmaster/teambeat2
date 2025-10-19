-- Add thread_id column to health_questions table
ALTER TABLE health_questions ADD COLUMN thread_id TEXT;

-- Set thread_id to the question's own id for existing questions (each starts its own thread)
UPDATE health_questions SET thread_id = id WHERE thread_id IS NULL;

-- Make thread_id NOT NULL after setting values
-- Note: SQLite doesn't support ALTER COLUMN, so we need to verify all values are set
-- The application layer will enforce NOT NULL for new inserts

-- Create index on thread_id for efficient historical queries
CREATE INDEX health_questions_thread_id_idx ON health_questions(thread_id);
