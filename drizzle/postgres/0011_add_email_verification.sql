-- Add email verification columns to users table
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN "email_verification_secret" text;
