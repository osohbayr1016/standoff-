CREATE TABLE `moderator_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`moderator_id` text NOT NULL,
	`action_type` text NOT NULL,
	`target_id` text,
	`details` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_mod_logs_moderator` ON `moderator_logs` (`moderator_id`);--> statement-breakpoint
CREATE INDEX `idx_mod_logs_action` ON `moderator_logs` (`action_type`);