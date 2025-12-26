-- Add is_discord_member column to track Discord server membership
ALTER TABLE players ADD COLUMN is_discord_member INTEGER DEFAULT 0;
