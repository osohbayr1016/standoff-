-- Migration to add max_players column to matches table
ALTER TABLE matches ADD COLUMN max_players INTEGER DEFAULT 10;
