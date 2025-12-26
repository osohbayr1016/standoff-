-- Migration: Add matches, match_players, and elo_history tables for new matchmaking system
-- This replaces the old NeatQueue-based system with manual lobby creation

-- Matches table - stores lobby/match information
CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    lobby_url TEXT NOT NULL,
    host_id TEXT NOT NULL,
    status TEXT DEFAULT 'waiting' NOT NULL CHECK(status IN ('waiting', 'in_progress', 'pending_review', 'completed', 'cancelled')),
    player_count INTEGER DEFAULT 0,
    max_players INTEGER DEFAULT 10,
    map_name TEXT,
    result_screenshot_url TEXT,
    winner_team TEXT CHECK(winner_team IN ('alpha', 'bravo', NULL)),
    alpha_score INTEGER,
    bravo_score INTEGER,
    reviewed_by TEXT,
    reviewed_at TEXT,
    review_notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (host_id) REFERENCES players(id),
    FOREIGN KEY (reviewed_by) REFERENCES players(id)
);

-- Match players junction table - tracks which players are in which match
CREATE TABLE IF NOT EXISTS match_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    team TEXT CHECK(team IN ('alpha', 'bravo', NULL)),
    is_captain INTEGER DEFAULT 0,
    joined_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id),
    UNIQUE(match_id, player_id)
);

-- ELO history table - tracks all ELO changes for players
CREATE TABLE IF NOT EXISTS elo_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    match_id TEXT,
    elo_before INTEGER NOT NULL,
    elo_after INTEGER NOT NULL,
    elo_change INTEGER NOT NULL,
    reason TEXT NOT NULL CHECK(reason IN ('match_win', 'match_loss', 'manual_adjustment', 'initial')),
    created_by TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES players(id),
    FOREIGN KEY (match_id) REFERENCES matches(id),
    FOREIGN KEY (created_by) REFERENCES players(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_host ON matches(host_id);
CREATE INDEX IF NOT EXISTS idx_matches_created ON matches(created_at);
CREATE INDEX IF NOT EXISTS idx_match_players_match ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_player ON match_players(player_id);
CREATE INDEX IF NOT EXISTS idx_elo_history_user ON elo_history(user_id);
CREATE INDEX IF NOT EXISTS idx_elo_history_match ON elo_history(match_id);
CREATE INDEX IF NOT EXISTS idx_elo_history_created ON elo_history(created_at);
