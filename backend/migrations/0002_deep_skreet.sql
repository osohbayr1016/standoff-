/*
CREATE TABLE `clan_members` (
	`id` text PRIMARY KEY NOT NULL,
	`clan_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member',
	`joined_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`clan_id`) REFERENCES `clans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
*/
CREATE TABLE `clan_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`clan_name` text NOT NULL,
	`clan_tag` text NOT NULL,
	`clan_size` integer DEFAULT 20 NOT NULL,
	`screenshot_url` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text,
	`reviewed_by` text,
	`rejection_reason` text,
	FOREIGN KEY (`user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
/*
CREATE TABLE `clans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tag` text NOT NULL,
	`leader_id` text NOT NULL,
	`logo_url` text,
	`max_members` integer DEFAULT 20 NOT NULL,
	`description` text,
	`elo` integer DEFAULT 1000 NOT NULL,
	`wins` integer DEFAULT 0,
	`losses` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`leader_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clans_name_unique` ON `clans` (`name`);--> statement-breakpoint
CREATE TABLE `elo_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`match_id` text,
	`elo_before` integer NOT NULL,
	`elo_after` integer NOT NULL,
	`elo_change` integer NOT NULL,
	`reason` text NOT NULL,
	`created_by` text,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_elo_user_id` ON `elo_history` (`user_id`);--> statement-breakpoint
CREATE TABLE `friendships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id1` text NOT NULL,
	`user_id2` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`user_id1`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id2`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `match_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` text NOT NULL,
	`player_id` text NOT NULL,
	`team` text,
	`is_captain` integer DEFAULT 0,
	`joined_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_mp_match_id` ON `match_players` (`match_id`);--> statement-breakpoint
CREATE INDEX `idx_mp_player_id` ON `match_players` (`player_id`);--> statement-breakpoint
CREATE INDEX `idx_mp_team` ON `match_players` (`team`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`lobby_url` text NOT NULL,
	`host_id` text NOT NULL,
	`match_type` text DEFAULT 'casual',
	`status` text DEFAULT 'waiting' NOT NULL,
	`player_count` integer DEFAULT 0,
	`max_players` integer DEFAULT 10,
	`map_name` text,
	`result_screenshot_url` text,
	`winner_team` text,
	`alpha_score` integer,
	`bravo_score` integer,
	`reviewed_by` text,
	`reviewed_at` text,
	`review_notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`host_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_matches_status` ON `matches` (`status`);--> statement-breakpoint
CREATE INDEX `idx_matches_host_id` ON `matches` (`host_id`);--> statement-breakpoint
CREATE INDEX `idx_matches_created_at` ON `matches` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_matches_match_type` ON `matches` (`match_type`);--> statement-breakpoint
CREATE TABLE `streamers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`platform` text NOT NULL,
	`channel_url` text,
	`stream_title` text,
	`is_live` integer DEFAULT false,
	`last_live_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `streamers_user_id_unique` ON `streamers` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_streamers_is_live` ON `streamers` (`is_live`);--> statement-breakpoint
*/
/*
ALTER TABLE `players` ADD `elo` integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `avatar_url` text;--> statement-breakpoint
ALTER TABLE `players` ADD `balance` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `role` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `banned` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `players` ADD `is_discord_member` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `players` ADD `is_vip` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `players` ADD `vip_until` text;--> statement-breakpoint
CREATE INDEX `idx_players_vip_elo` ON `players` (`is_vip`,`elo`);--> statement-breakpoint
ALTER TABLE `players` DROP COLUMN `mmr`;
*/