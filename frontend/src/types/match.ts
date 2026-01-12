export interface MatchPlayer {
    player_id: string;
    team: string; // 'alpha' | 'bravo' | 'spectator'
    discord_username?: string;
    discord_avatar?: string;
    elo?: number;
    is_vip?: number | boolean;
    standoff_nickname?: string;
    role?: string;
}

export interface Match {
    id: string;
    lobby_url: string;
    host_id: string;
    host_username?: string;
    host_avatar?: string;
    status: string; // 'waiting' | 'drafting' | 'in_progress' | 'completed' | 'cancelled'
    player_count: number;
    max_players: number;
    map_name?: string;
    match_type?: 'casual' | 'league' | 'competitive' | 'clan_lobby' | 'clan_war';
    created_at: string;
    alpha_avg_elo?: number;
    bravo_avg_elo?: number;
    draftState?: any;
    captain_alpha_id?: string;
    captain_bravo_id?: string;
    alpha_clan?: { name: string; tag: string };
    bravo_clan?: { name: string; tag: string };
}
