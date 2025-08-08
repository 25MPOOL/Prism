CREATE TABLE `github_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`access_token_expires_at` integer NOT NULL,
	`refresh_token_expires_at` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_id_idx` ON `github_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`github_id` integer NOT NULL,
	`github_username` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_github_id_unique` ON `users` (`github_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT '"2025-08-07T18:02:48.961Z"' NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_messages`("id", "conversation_id", "role", "content", "created_at") SELECT "id", "conversation_id", "role", "content", "created_at" FROM `messages`;--> statement-breakpoint
DROP TABLE `messages`;--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`phase` text DEFAULT 'idea' NOT NULL,
	`created_at` integer DEFAULT '"2025-08-07T18:02:48.961Z"' NOT NULL,
	`updated_at` integer DEFAULT '"2025-08-07T18:02:48.961Z"' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_conversations`("id", "user_id", "title", "phase", "created_at", "updated_at") SELECT "id", "user_id", "title", "phase", "created_at", "updated_at" FROM `conversations`;--> statement-breakpoint
DROP TABLE `conversations`;--> statement-breakpoint
ALTER TABLE `__new_conversations` RENAME TO `conversations`;