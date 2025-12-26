-- Migration: Rename mmr column to elo to match schema
PRAGMA foreign_keys=OFF;

-- Create new table with elo column
CREATE TABLE `__new_players` (
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
	`role` text DEFAULT 'user' NOT NULL,
	`banned` integer DEFAULT 0,
	`is_discord_member` integer DEFAULT 0
);

-- Copy data from old table, renaming mmr to elo
INSERT INTO `__new_players`("id", "discord_id", "discord_username", "discord_avatar", "standoff_nickname", "elo", "wins", "losses", "created_at", "nickname_updated_at", "role", "banned", "is_discord_member") 
SELECT "id", "discord_id", "discord_username", "discord_avatar", "standoff_nickname", "mmr", "wins", "losses", "created_at", "nickname_updated_at", "role", "banned", "is_discord_member" 
FROM `players`;

-- Drop old table and rename new one
DROP TABLE `players`;
ALTER TABLE `__new_players` RENAME TO `players`;

PRAGMA foreign_keys=ON;

-- Recreate indexes
CREATE UNIQUE INDEX IF NOT EXISTS `players_discord_id_unique` ON `players` (`discord_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `players_standoff_nickname_unique` ON `players` (`standoff_nickname`);

