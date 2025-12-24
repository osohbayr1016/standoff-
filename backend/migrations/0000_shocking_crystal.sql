CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`standoff_id` text,
	`mmr` integer DEFAULT 1000,
	`is_verified` integer DEFAULT false,
	`created_at` integer
);
