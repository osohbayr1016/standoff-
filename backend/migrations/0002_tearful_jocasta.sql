-- CREATE TABLE `gold_prices` (
-- 	`gold` integer PRIMARY KEY NOT NULL,
-- 	`price` integer NOT NULL
-- );
--> statement-breakpoint
CREATE TABLE `tournament_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`clan_id` text NOT NULL,
	`registered_at` text DEFAULT CURRENT_TIMESTAMP,
	`status` text DEFAULT 'registered',
	`seed` integer,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`clan_id`) REFERENCES `clans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tourney_part_clan` ON `tournament_participants` (`clan_id`);--> statement-breakpoint
CREATE INDEX `idx_tourney_part_tourney` ON `tournament_participants` (`tournament_id`);--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`start_time` text NOT NULL,
	`status` text DEFAULT 'registration' NOT NULL,
	`bracket_type` text DEFAULT 'single_elimination' NOT NULL,
	`min_teams` integer DEFAULT 4 NOT NULL,
	`max_teams` integer DEFAULT 16 NOT NULL,
	`prizepool` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`winner_clan_id` text,
	FOREIGN KEY (`winner_clan_id`) REFERENCES `clans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `matches` ADD `reminder_sent` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `matches` ADD `tournament_id` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `tournament_round` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `bracket_match_id` integer;--> statement-breakpoint
ALTER TABLE `matches` ADD `next_match_id` text;