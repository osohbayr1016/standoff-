-- Reset all players ELO to 1000
UPDATE players SET elo = 1000;

-- Clear all match history
DELETE FROM match_players;
DELETE FROM matches;
DELETE FROM elo_history;
