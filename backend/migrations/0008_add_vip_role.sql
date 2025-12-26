-- Add is_vip and vip_until columns to players table
ALTER TABLE players ADD COLUMN is_vip INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN vip_until DATETIME;
UPDATE players SET is_vip = 0 WHERE is_vip IS NULL;
