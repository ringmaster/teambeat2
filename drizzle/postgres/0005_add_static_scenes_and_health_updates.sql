-- Add display_rule field to scenes table for conditional scene display
ALTER TABLE scenes ADD COLUMN IF NOT EXISTS display_rule TEXT;

-- Restructure health_questions table to be scene-based instead of board-based

-- Step 1: Add new columns first
ALTER TABLE health_questions ADD COLUMN IF NOT EXISTS scene_id TEXT;
ALTER TABLE health_questions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE health_questions ADD COLUMN IF NOT EXISTS question_type TEXT;

-- Step 2: For existing data, you would need to manually set scene_id values
-- This migration assumes no critical production data, or manual migration will be handled separately

-- Step 3: Make question_type NOT NULL and add constraint after data is populated
-- ALTER TABLE health_questions ALTER COLUMN question_type SET NOT NULL;

-- Step 4: Drop old foreign key constraint and column (PostgreSQL)
-- Note: This will fail if there's existing data - handle manually in production
DO $$
BEGIN
  -- Drop the old foreign key if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%health_questions_board_id%'
    AND table_name = 'health_questions'
  ) THEN
    ALTER TABLE health_questions DROP CONSTRAINT health_questions_board_id_boards_id_fk;
  END IF;

  -- Drop the old board_id column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_questions'
    AND column_name = 'board_id'
  ) THEN
    ALTER TABLE health_questions DROP COLUMN board_id;
  END IF;
END $$;

-- Step 5: Add foreign key constraint for scene_id
ALTER TABLE health_questions
ADD CONSTRAINT health_questions_scene_id_scenes_id_fk
FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE;

-- Step 6: Set scene_id as NOT NULL after data is populated
-- ALTER TABLE health_questions ALTER COLUMN scene_id SET NOT NULL;
