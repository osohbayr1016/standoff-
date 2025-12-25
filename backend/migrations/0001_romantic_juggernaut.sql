PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_players` (
	`id` text PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`discord_username` text,
	`discord_avatar` text,
	`standoff_nickname` text,
	`mmr` integer DEFAULT 1000 NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`nickname_updated_at` text
);
--> statement-breakpoint
INSERT INTO `__new_players`("id", "discord_id", "discord_username", "discord_avatar", "standoff_nickname", "mmr", "wins", "losses", "created_at", "nickname_updated_at") SELECT "id", "discord_id", "discord_username", "discord_avatar", "standoff_nickname", "mmr", "wins", "losses", "created_at", "nickname_updated_at" FROM `players`;--> statement-breakpoint
DROP TABLE `players`;--> statement-breakpoint
ALTER TABLE `__new_players` RENAME TO `players`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `players_discord_id_unique` ON `players` (`discord_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `players_standoff_nickname_unique` ON `players` (`standoff_nickname`);