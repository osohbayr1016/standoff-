import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

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
    avatar_url: text('avatar_url'),
    balance: integer('balance').default(0).notNull(), // MNT Currency
    role: text('role').default('user').notNull(), // 'user', 'moderator', 'admin'
    banned: integer('banned').default(0),
    is_discord_member: integer('is_discord_member').default(0),
    is_vip: integer('is_vip').default(0),
    vip_until: text('vip_until'),
    discord_roles: text('discord_roles', { mode: 'json' }) // Store JSON array of role IDs
}, (table) => ({
    idxPlayersVipElo: index('idx_players_vip_elo').on(table.is_vip, table.elo),
}));

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
    match_type: text('match_type').default('casual'), // casual, league
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
}, (table) => ({
    idxMatchesStatus: index('idx_matches_status').on(table.status),
    idxMatchesHostId: index('idx_matches_host_id').on(table.host_id),
    idxMatchesCreatedAt: index('idx_matches_created_at').on(table.created_at),
    idxMatchesMatchType: index('idx_matches_match_type').on(table.match_type),
}));

export const matchPlayers = sqliteTable('match_players', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    match_id: text('match_id').notNull().references(() => matches.id),
    player_id: text('player_id').notNull().references(() => players.id),
    team: text('team'), // alpha, bravo
    is_captain: integer('is_captain').default(0),
    joined_at: text('joined_at').default('CURRENT_TIMESTAMP')
}, (table) => ({
    idxMpMatchId: index('idx_mp_match_id').on(table.match_id),
    idxMpPlayerId: index('idx_mp_player_id').on(table.player_id),
    idxMpTeam: index('idx_mp_team').on(table.team),
}));

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
}, (table) => ({
    idxEloUserId: index('idx_elo_user_id').on(table.user_id),
}));

export const streamers = sqliteTable('streamers', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    user_id: text('user_id').notNull().unique().references(() => players.id),
    platform: text('platform').notNull(), // 'twitch', 'youtube', 'kick', 'tiktok'
    channel_url: text('channel_url'),
    stream_title: text('stream_title'),
    is_live: integer('is_live', { mode: 'boolean' }).default(false),
    last_live_at: text('last_live_at'),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
    idxStreamersIsLive: index('idx_streamers_is_live').on(table.is_live),
}));

export const clans = sqliteTable('clans', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull().unique(),
    tag: text('tag').notNull(),
    leader_id: text('leader_id').notNull().references(() => players.id),
    logo_url: text('logo_url'),
    max_members: integer('max_members').default(20).notNull(), // 20 or 50
    description: text('description'),
    elo: integer('elo').default(1000).notNull(),
    wins: integer('wins').default(0),
    losses: integer('losses').default(0),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});

export const clanMembers = sqliteTable('clan_members', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    clan_id: text('clan_id').notNull().references(() => clans.id),
    user_id: text('user_id').notNull().references(() => players.id),
    role: text('role').default('member'), // 'leader', 'coleader', 'member'
    joined_at: text('joined_at').default(sql`CURRENT_TIMESTAMP`)
});

// Manual Clan Requests
export const clanRequests = sqliteTable('clan_requests', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    user_id: text('user_id').notNull().references(() => players.id),
    clan_name: text('clan_name').notNull(),
    clan_tag: text('clan_tag').notNull(),
    clan_size: integer('clan_size').default(20).notNull(), // 20 or 50
    screenshot_url: text('screenshot_url').notNull(),
    status: text('status').default('pending').notNull(), // 'pending', 'approved', 'rejected'
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at'),
    reviewed_by: text('reviewed_by').references(() => players.id),
    rejection_reason: text('rejection_reason'),
});

// Indexes can be added here
export const idxClansLeader = index('idx_clans_leader').on(clans.leader_id);
export const idxClanMembersClan = index('idx_clan_members_clan').on(clanMembers.clan_id);
export const idxClanMembersUser = index('idx_clan_members_user').on(clanMembers.user_id);
export const idxClanRequestsUser = index('idx_clan_requests_user').on(clanRequests.user_id);
export const idxClanRequestsStatus = index('idx_clan_requests_status').on(clanRequests.status);