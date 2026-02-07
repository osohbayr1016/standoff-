-- Disable foreign key constraints to avoid issues during rename/drop
PRAGMA foreign_keys=OFF;

-- 1. Create new table without the CHECK constraint on match_type
CREATE TABLE matches_new (
    id TEXT PRIMARY KEY,
    lobby_url TEXT NOT NULL,
    host_id TEXT NOT NULL, -- Removing foreign key constraint definition for simplicity if not strictly enforced, or keep it: REFERENCES players(id) ON UPDATE CASCADE ON DELETE CASCADE
    match_type TEXT DEFAULT 'casual',
    status TEXT DEFAULT 'waiting' NOT NULL,
    player_count INTEGER DEFAULT 0,
    max_players INTEGER DEFAULT 10,
    map_name TEXT,
    result_screenshot_url TEXT,
    winner_team TEXT,
    alpha_score INTEGER,
    bravo_score INTEGER,
    reviewed_by TEXT,
    reviewed_at TEXT,
    review_notes TEXT,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    min_rank TEXT,
    clan_id TEXT,
    reminder_sent INTEGER DEFAULT 0,
    tournament_id TEXT,
    tournament_round INTEGER,
    bracket_match_id INTEGER,
    next_match_id TEXT,
    alpha_clan_id TEXT,
    bravo_clan_id TEXT,
    FOREIGN KEY (host_id) REFERENCES players (id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2. Copy data from old table to new table
INSERT INTO matches_new (
    id, lobby_url, host_id, match_type, status, player_count, max_players, 
    map_name, result_screenshot_url, winner_team, alpha_score, bravo_score, 
    reviewed_by, reviewed_at, review_notes, created_at, updated_at, 
    min_rank, clan_id, reminder_sent, tournament_id, tournament_round, 
    bracket_match_id, next_match_id, alpha_clan_id, bravo_clan_id
)
SELECT 
    id, lobby_url, host_id, match_type, status, player_count, max_players, 
    map_name, result_screenshot_url, winner_team, alpha_score, bravo_score, 
    reviewed_by, reviewed_at, review_notes, created_at, updated_at, 
    min_rank, clan_id, reminder_sent, tournament_id, tournament_round, 
    bracket_match_id, next_match_id, alpha_clan_id, bravo_clan_id
FROM matches;

-- 3. Rename tables
DROP TABLE matches;
ALTER TABLE matches_new RENAME TO matches;

-- 4. Recreate Indexes
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_host_id ON matches(host_id);
CREATE INDEX idx_matches_created_at ON matches(created_at);
CREATE INDEX idx_matches_match_type ON matches(match_type);

PRAGMA foreign_keys=ON;
