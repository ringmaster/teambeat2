CREATE TABLE `user_authenticators` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`credential_public_key` text NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`credential_device_type` text,
	`credential_backed_up` integer DEFAULT false,
	`transports` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_authenticators_credential_id_unique` ON `user_authenticators` (`credential_id`);