ALTER TABLE health_questions ADD COLUMN thread_id TEXT;--> statement-breakpoint
UPDATE health_questions SET thread_id = id WHERE thread_id IS NULL;--> statement-breakpoint
CREATE INDEX health_questions_thread_id_idx ON health_questions(thread_id);
