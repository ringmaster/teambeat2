-- Add clone_of field to boards table to track board cloning
ALTER TABLE boards
ADD COLUMN IF NOT EXISTS clone_of TEXT REFERENCES boards(id) ON DELETE SET NULL;
