-- Add match_type column to matches table
-- This allows us to distinguish between casual and league matches

ALTER TABLE matches ADD COLUMN match_type TEXT DEFAULT 'casual' CHECK(match_type IN ('casual', 'league'));

-- Update existing matches to be casual by default
UPDATE matches SET match_type = 'casual' WHERE match_type IS NULL;
