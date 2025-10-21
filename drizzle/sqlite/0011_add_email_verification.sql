ALTER TABLE `users` ADD `email_verified` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `email_verification_secret` text;
