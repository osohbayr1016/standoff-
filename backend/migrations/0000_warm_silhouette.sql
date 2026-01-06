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
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
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
CREATE TABLE `gold_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`gold_amount` integer NOT NULL,
	`price_mnt` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`proof_url` text,
	`graffiti_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`processed_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`processed_by`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `gold_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_gold_trans_seller` ON `gold_transactions` (`created_by`);--> statement-breakpoint
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
	FOREIGN KEY (`host_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_matches_status` ON `matches` (`status`);--> statement-breakpoint
CREATE INDEX `idx_matches_host_id` ON `matches` (`host_id`);--> statement-breakpoint
CREATE INDEX `idx_matches_created_at` ON `matches` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_matches_match_type` ON `matches` (`match_type`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`discord_username` text,
	`discord_avatar` text,
	`standoff_nickname` text,
	`elo` integer DEFAULT 1000 NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`nickname_updated_at` text,
	`avatar_url` text,
	`balance` integer DEFAULT 0 NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`banned` integer DEFAULT 0,
	`is_discord_member` integer DEFAULT 0,
	`is_vip` integer DEFAULT 0,
	`vip_until` text,
	`discord_roles` text,
	`gold` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_discord_id_unique` ON `players` (`discord_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `players_standoff_nickname_unique` ON `players` (`standoff_nickname`);--> statement-breakpoint
CREATE INDEX `idx_players_vip_elo` ON `players` (`is_vip`,`elo`);--> statement-breakpoint
CREATE TABLE `reward_claims` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`reward_type` text NOT NULL,
	`claimed_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reward_user_id` ON `reward_claims` (`user_id`);--> statement-breakpoint
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
CREATE INDEX `idx_streamers_is_live` ON `streamers` (`is_live`);