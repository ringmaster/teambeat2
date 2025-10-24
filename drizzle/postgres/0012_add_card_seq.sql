-- Add seq column to cards table for manual card ordering
ALTER TABLE "cards" ADD COLUMN "seq" integer DEFAULT 0;
