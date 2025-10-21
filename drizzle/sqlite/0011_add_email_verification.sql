-- Add email verification columns to users table
ALTER TABLE `users` ADD `email_verified` integer DEFAULT 0 NOT NULL;
ALTER TABLE `users` ADD `email_verification_secret` text;
