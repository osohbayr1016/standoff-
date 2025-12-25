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
    role: text('role').default('user').notNull() // 'user', 'moderator', 'admin'
});

export const friendships = sqliteTable('friendships', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    user_id1: text('user_id1').notNull().references(() => players.id), // Requester
    user_id2: text('user_id2').notNull().references(() => players.id), // Recipient
    status: text('status').notNull(), // 'pending', 'accepted'
    created_at: text('created_at').default('CURRENT_TIMESTAMP')
});