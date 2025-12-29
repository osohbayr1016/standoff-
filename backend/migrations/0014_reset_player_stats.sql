-- Reset player statistics
UPDATE players SET elo = 1000, wins = 0, losses = 0;

-- Ensure match history is cleared (redundant safety)
DELETE FROM match_players;
DELETE FROM matches;
DELETE FROM elo_history;
