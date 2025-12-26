import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const players = sqliteTable('players', {
    id: text('id').primaryKey(), // Discord User ID
    discord_id: text('discord_id').notNull().unique(),
    discord_username: text('discord_username'),
    discord_avatar: text('discord_avatar'),
    standoff_nickname: text('standoff_nickname').unique(),
    elo: integer('elo').default(1000).notNull(),
    wins: integer('wins').default(0).notNull(),
    losses: integer('losses').default(0).notNull(),
    created_at: text('created_at').default('CURRENT_TIMESTAMP'),
    nickname_updated_at: text('nickname_updated_at'),
    role: text('role').default('user').notNull(), // 'user', 'moderator', 'admin'
    banned: integer('banned').default(0)
});

export const friendships = sqliteTable('friendships', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    user_id1: text('user_id1').notNull().references(() => players.id), // Requester
    user_id2: text('user_id2').notNull().references(() => players.id), // Recipient
    status: text('status').notNull(), // 'pending', 'accepted'
    created_at: text('created_at').default('CURRENT_TIMESTAMP')
});

// New tables for manual matchmaking system

export const matches = sqliteTable('matches', {
    id: text('id').primaryKey(),
    lobby_url: text('lobby_url').notNull(),
    host_id: text('host_id').notNull().references(() => players.id),
    status: text('status').default('waiting').notNull(), // waiting, in_progress, pending_review, completed, cancelled
    player_count: integer('player_count').default(0),
    max_players: integer('max_players').default(10),
    map_name: text('map_name'),
    result_screenshot_url: text('result_screenshot_url'),
    winner_team: text('winner_team'), // alpha, bravo
    alpha_score: integer('alpha_score'),
    bravo_score: integer('bravo_score'),
    reviewed_by: text('reviewed_by').references(() => players.id),
    reviewed_at: text('reviewed_at'),
    review_notes: text('review_notes'),
    created_at: text('created_at').default('CURRENT_TIMESTAMP'),
    updated_at: text('updated_at').default('CURRENT_TIMESTAMP')
});

export const matchPlayers = sqliteTable('match_players', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    match_id: text('match_id').notNull().references(() => matches.id),
    player_id: text('player_id').notNull().references(() => players.id),
    team: text('team'), // alpha, bravo
    is_captain: integer('is_captain').default(0),
    joined_at: text('joined_at').default('CURRENT_TIMESTAMP')
});

export const eloHistory = sqliteTable('elo_history', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    user_id: text('user_id').notNull().references(() => players.id),
    match_id: text('match_id').references(() => matches.id),
    elo_before: integer('elo_before').notNull(),
    elo_after: integer('elo_after').notNull(),
    elo_change: integer('elo_change').notNull(),
    reason: text('reason').notNull(), // match_win, match_loss, manual_adjustment, initial
    created_by: text('created_by').references(() => players.id),
    notes: text('notes'),
    created_at: text('created_at').default('CURRENT_TIMESTAMP')
});