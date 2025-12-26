// Type definitions for the bot

export interface Player {
    id: string;
    discord_id?: string;
    username: string;
    name?: string;
    avatar?: string;
    avatar_url?: string;
    mmr?: number;
}

export interface MatchData {
    id: string;
    lobbyId: string;
    players: Player[];
    teamAlpha: Player[];
    teamBravo: Player[];
    captainA: Player;
    captainB: Player;
    map?: string;
}

export interface BackendMessage {
    type:
    | 'MATCH_READY'
    | 'MATCH_CANCELLED'
    | 'LOBBY_UPDATE'
    | 'QUEUE_UPDATE'
    | 'SERVER_CREATED'
    | 'SERVER_CREATION_FAILED'
    | 'MATCH_START'
    | 'CREATE_MATCH'
    | 'REGISTER_ACK'
    | 'MATCH_RESET'
    // New types for manual matchmaking
    | 'VERIFY_MODERATOR'
    | 'VERIFY_MODERATOR_RESPONSE'
    | 'MATCH_CREATED'
    | 'MATCH_RESULT_SUBMITTED'
    | 'LOBBY_CREATED'
    | 'PLAYER_JOINED'
    | 'PLAYER_LEFT';
    lobbyId?: string;
    matchId?: string;
    matchData?: MatchData;
    userId?: string;
    discordId?: string;
    requestId?: string;
    isModerator?: boolean;
    timestamp?: number;
}

export interface QueuePlayer {
    id: string;
    name: string;
    discord_id: string;
    avatar_url?: string;
}

export interface VoiceChannelPair {
    categoryId: string;
    alphaChannelId: string;
    bravoChannelId: string;
    matchId: string;
    createdAt: Date;
}
