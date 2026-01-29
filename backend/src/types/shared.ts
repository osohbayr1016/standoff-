export interface QueuePlayer {
    id: string;
    discord_id?: string;
    username: string;
    standoff_nickname?: string;
    name?: string;
    avatar?: string | null;
    elo?: number;
    // Extended properties for match/lobby
    team?: 'alpha' | 'bravo';
    player_id?: string;
}

export interface ReadyPhaseState {
    phaseActive: boolean;
    readyPlayers: string[];
    readyPhaseStartTimestamp?: number;
    readyPhaseTimeout: number;
}

export interface ServerInfo {
    ip: string;
    password: string;
    matchLink?: string;
    matchId?: string;
    note?: string;
}

export interface DraftState {
    isActive: boolean;
    pool: QueuePlayer[];
    currentTurn: 'captainA' | 'captainB';
    pickOrder: ('captainA' | 'captainB')[]; // Snake: A, B, B, A, A, B, B, A
    pickHistory: { pickerId: string; pickedId: string }[];
    draftTimeout: number;
    lastPickTimestamp: number;
}

export interface Lobby {
    id: string;
    players: QueuePlayer[];
    captainA: QueuePlayer;
    captainB: QueuePlayer;
    teamA: QueuePlayer[];
    teamB: QueuePlayer[];
    readyPlayers: string[];

    readyPhaseState: ReadyPhaseState;
    draftState?: DraftState;
    serverInfo?: ServerInfo;
    matchType?: string;
    status?: string;
    startedAt?: number;
    lobby_url?: string;
    captain_alpha_id?: string;
    captain_bravo_id?: string;
    max_players?: number;
    selectedMap?: string;
    alpha_avg_elo?: number;
    bravo_avg_elo?: number;
    mapBanState?: any; // To be typed properly if needed
}

export interface ChatMessage {
    id: string;
    userId: string;
    username: string;
    avatar?: string;
    content: string;
    timestamp: number;
    lobbyId?: string; // Optional, present for lobby-specific chat
    type?: 'user' | 'system';
}

export interface Env {
    MATCH_QUEUE: DurableObjectNamespace;
    DB: D1Database;
    DISCORD_CLIENT_ID: string;
    DISCORD_CLIENT_SECRET: string;
    DISCORD_REDIRECT_URI: string;
    DISCORD_SERVER_ID: string;
    DISCORD_CHANNEL_ID: string;
    FRONTEND_URL: string;
    MODERATOR_ROLE_ID?: string;
    NEATQUEUE_API_KEY?: string;
    DISCORD_BOT_TOKEN?: string;
    NEATQUEUE_WEBHOOK_SECRET?: string;
    ADMIN_SECRET?: string;
    TURNSTILE_SECRET_KEY?: string;
    DD_API_KEY?: string;
}

export interface WebhookData {
    type: string;
    data: Record<string, unknown>;
}

export interface DiscordTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
}

export interface DiscordUser {
    id: string;
    username: string;
    avatar: string | null;
    discriminator: string;
    public_flags?: number;
    flags?: number;
    banner?: string | null;
    accent_color?: number | null;
    global_name?: string | null;
    avatar_decoration_data?: unknown;
    banner_color?: string | null;
    mfa_enabled?: boolean;
    locale?: string;
    premium_type?: number;
    email?: string;
    verified?: boolean;
}

export interface DiscordGuildMember {
    user?: DiscordUser;
    nick?: string | null;
    avatar?: string | null;
    banner?: string | null;
    roles: string[];
    joined_at: string;
    premium_since?: string | null;
    deaf: boolean;
    mute: boolean;
    pending?: boolean;
    permissions?: string;
    communication_disabled_until?: string | null;
}
