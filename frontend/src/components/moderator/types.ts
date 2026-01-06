export interface MatchPlayer {
    player_id: string;
    team: string;
    discord_username: string;
    discord_avatar?: string;
    standoff_nickname?: string;
    elo: number;
    is_captain?: number;
}

export interface PendingMatch {
    id: string;
    lobby_url: string;
    host_id: string;
    host_username?: string;
    host_avatar?: string;
    status: string;
    player_count: number;
    result_screenshot_url?: string;
    winner_team?: string;
    alpha_score?: number;
    bravo_score?: number;
    created_at: string;
    updated_at: string;
    players?: MatchPlayer[];
    match_type: string;
    map_name?: string;
}

export interface User {
    id: string;
    discord_username: string;
    discord_avatar: string | null;
    role: string;
    elo: number;
    mmr?: number;
    wins: number;
    losses: number;
    banned: number;
    standoff_nickname?: string;
    is_vip?: number | boolean;
    vip_until?: string;
}

export interface Clan {
    id: string;
    name: string;
    tag: string;
    leader_id: string;
    leader_name?: string;
    logo_url?: string;
    max_members: number;
    description?: string;
    member_count?: number;
    elo: number;
    wins: number;
    losses: number;
    created_at: string;
}

export interface EloHistoryEntry {
    id: number;
    match_id: string;
    elo_before: number;
    elo_after: number;
    elo_change: number;
    reason: string;
    created_at: string;
    result_screenshot_url?: string;
}

export interface ModeratorStats {
    totalPlayers: number;
    waitingMatches: number;
    activeMatches: number;
    pendingReviews: number;
    completedMatches: number;
    bannedPlayers: number;
}

export interface VIPRequest {
    id: string;
    user_id: string;
    discord_username: string;
    phone_number?: string;
    screenshot_url: string;
    message?: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    reviewed_at?: string;
    rejection_reason?: string;
    user_discord_username?: string;
    user_discord_avatar?: string;
}

export interface AuditLog {
    id: number;
    moderator_id: string;
    moderator_username?: string;
    moderator_avatar?: string;
    action_type: string;
    target_id: string;
    details: string;
    created_at: string;
}

export interface Clan {
    id: string;
    name: string;
    tag: string;
    leader_id: string;
    logo_url?: string;
    description?: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    members_count?: number;
    leader_username?: string;
    leader_avatar?: string;
}

export interface ClanRequest {
    id: string;
    clan_id: string;
    user_id: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    user_username?: string;
    user_avatar?: string;
    clan_name?: string;
}
