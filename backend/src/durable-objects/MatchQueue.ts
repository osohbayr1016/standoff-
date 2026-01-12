
import { DurableObject } from "cloudflare:workers";
import { Env, QueuePlayer, Lobby, ChatMessage, WebhookData } from "../types/shared";
import { logToDatadog } from '../utils/logger';
import { updateDiscordRole, TIERS } from '../utils/discord';

export class MatchQueueDO extends DurableObject {
    sessions: Set<WebSocket> = new Set();
    userSockets: Map<string, WebSocket> = new Map();
    localQueue: Map<string, QueuePlayer> = new Map();
    remoteQueue: QueuePlayer[] = [];
    activeLobbies: Map<string, Lobby> = new Map();
    playerLobbyMap: Map<string, string> = new Map(); // UserId -> LobbyId
    chatHistory: ChatMessage[] = []; // Global chat history
    lobbyChatHistory: Map<string, ChatMessage[]> = new Map(); // LobbyId -> ChatMessage[]
    userData: Map<string, { username: string, avatar: string, elo: number }> = new Map();

    // High-performance update tracking
    lastBroadcastData: string = '';
    lastQueueBroadcast: string = '';
    lastQueueBroadcastTime: number = 0;

    // Track initialization state
    initialized: boolean = false;

    constructor(public state: DurableObjectState, public env: Env) {
        super(state, env);
        this.state.blockConcurrencyWhile(async () => {
            await this.loadMatchState();
            this.initialized = true;
        });
    }

    async fetch(request: Request) {
        const url = new URL(request.url);

        // Handle API endpoints
        if (url.pathname.endsWith('/server-info') && request.method === 'POST') {
            return this.handleServerInfo(request);
        }

        if (url.pathname.endsWith('/check-online') && request.method === 'POST') {
            return this.handleCheckOnline(request);
        }

        if (url.pathname.endsWith('/join-lobby') && request.method === 'POST') {
            return this.handleJoinLobby(request);
        }

        if (url.pathname.endsWith('/purge-lobby') && request.method === 'POST') {
            return this.handlePurgeLobby(request);
        }

        if (url.pathname.endsWith('/broadcast') && request.method === 'POST') {
            const body = await request.json() as { type: string; data: Record<string, unknown> };
            console.log('📢 DO Internal Broadcast:', body.type);

            // Handle LOBBY_ACTION relay from Hono routes
            if (body.type === 'START_DRAFT') {
                const data = body.data as unknown as {
                    matchId: string;
                    captainAlpha: QueuePlayer;
                    captainBravo: QueuePlayer;
                    players: QueuePlayer[];
                };
                const { matchId, captainAlpha, captainBravo, players } = data;
                console.log(`Draft Starting for ${matchId}`);

                let lobby = this.activeLobbies.get(matchId);

                // If lobby doesn't exist in DO (e.g. manual create), sync it
                if (!lobby && players) {
                    lobby = {
                        id: matchId,
                        players: players,
                        captainA: captainAlpha,
                        captainB: captainBravo,
                        teamA: [captainAlpha],
                        teamB: [captainBravo],
                        readyPlayers: [],

                        readyPhaseState: { phaseActive: false, readyPlayers: [], readyPhaseTimeout: 30 },
                        matchType: 'competitive', // assume comp/league
                        status: 'drafting',
                        startedAt: Date.now()
                    };
                    this.activeLobbies.set(matchId, lobby);
                }

                if (lobby) {


                    const pool = players.filter((p: QueuePlayer) =>
                        p.id !== captainAlpha.player_id &&
                        p.discord_id !== captainAlpha.player_id &&
                        p.id !== captainBravo.player_id &&
                        p.discord_id !== captainBravo.player_id
                    ).map((p: QueuePlayer) => ({ ...p, id: p.player_id || p.id })); // Ensure ID normalization

                    lobby.status = 'drafting';
                    lobby.captainA = captainAlpha;
                    lobby.captainB = captainBravo;

                    // CRITICAL: Ensure other phases are disabled to prevent Alarm from cancelling
                    if (lobby.readyPhaseState) lobby.readyPhaseState.phaseActive = false;


                    lobby.captainA = captainAlpha;
                    lobby.captainB = captainBravo;

                    lobby.captain_alpha_id = captainAlpha.player_id || captainAlpha.id;
                    lobby.captain_bravo_id = captainBravo.player_id || captainBravo.id;

                    lobby.teamA = [captainAlpha];
                    lobby.teamB = [captainBravo];

                    lobby.draftState = {
                        isActive: true,
                        pool: pool,
                        currentTurn: 'captainA',
                        // Dota Style: 1-1-1-1 (Alternating)
                        // Picks 1-7. The 8th player is auto-assigned to Team B (since A picks 4 times, B picks 3).
                        pickOrder: ['captainA', 'captainB', 'captainA', 'captainB', 'captainA', 'captainB', 'captainA'],
                        pickHistory: [],
                        draftTimeout: 15,
                        lastPickTimestamp: Date.now()
                    };

                    await this.saveMatchState();

                    // CRITICAL: Set playerLobbyMap for reconnection support
                    lobby.players.forEach(p => {
                        const pid = p.id || p.player_id || p.discord_id;
                        if (pid) this.playerLobbyMap.set(pid, matchId);
                    });

                    this.broadcastToLobby(matchId, JSON.stringify({
                        type: 'DRAFT_START',
                        lobbyId: matchId,
                        draftState: lobby.draftState,
                        captainAlpha,
                        captainBravo,
                        captainA: captainAlpha, // Legacy/Frontend compat
                        captainB: captainBravo, // Legacy/Frontend compat
                        captainAlphaId: captainAlpha.player_id || captainAlpha.id,
                        captainBravoId: captainBravo.player_id || captainBravo.id,
                        teams: { A: lobby.teamA, B: lobby.teamB }
                    }));

                    // Check if First Picker is Bot/Auto
                    // Turn 0 = captainA
                    const firstPicker = lobby.captainA;
                    if ((firstPicker.id || '').startsWith('bot_') || (firstPicker.id || '').startsWith('auto_')) {
                        console.log(`🤖 Bot First Pick triggered for ${matchId}`);
                        this.executeAutoPick(matchId, true).catch(console.error);
                    }
                }
            }

            if (body.type === 'LOBBY_ACTION') {
                const data = body.data as unknown as {
                    userIds?: string[];
                    type?: string;
                    matchId: string;
                    players: QueuePlayer[];
                    teamA?: QueuePlayer[];
                    teamB?: QueuePlayer[];
                    status?: string;
                    matchType?: string;
                    startedAt?: number;
                };
                const { userIds, type, matchId, players, ...msgData } = data;

                // Sync manual lobby state to DO for chat/real-time support
                if (matchId && players) {
                    const existingLobby = this.activeLobbies.get(matchId);

                    if (existingLobby) {
                        // MERGE UPDATE
                        // Update player list, status, team/captain mapping if provided
                        // CRITICAL: Do NOT overwrite teams if draft is active (prevents team reset bug)
                        if (!existingLobby.draftState?.isActive) {
                            existingLobby.players = players;
                            if (msgData.teamA) existingLobby.teamA = msgData.teamA;
                            if (msgData.teamB) existingLobby.teamB = msgData.teamB;
                        }
                        if (msgData.status) existingLobby.status = msgData.status;

                        // CRITICAL: Clear stale playerLobbyMap entries for this lobby (handles leave/kick)
                        for (const [playerId, lobbyId] of this.playerLobbyMap) {
                            if (lobbyId === matchId) this.playerLobbyMap.delete(playerId);
                        }
                        // Then set fresh mappings for current players
                        players.forEach((p: QueuePlayer) => {
                            const pid = p.id || p.player_id || p.discord_id;
                            if (pid) this.playerLobbyMap.set(pid, matchId);
                        });

                        console.log(`📌 Updated existing lobby ${matchId} (DraftActive: ${!!existingLobby.draftState?.isActive})`);
                        this.saveMatchState(); // Bug #17 Fix: Persist updates
                    } else {
                        // Prevent Zombie Lobbies: Do not create new lobby if status is final
                        if (msgData.status === 'completed' || msgData.status === 'cancelled' || msgData.status === 'pending_review') {
                            console.log(`⚠️ [${matchId}] Ignoring LOBBY_ACTION for finished match (Status: ${msgData.status})`);
                            return new Response(JSON.stringify({ success: true, ignored: true }), { headers: { 'Content-Type': 'application/json' } });
                        }

                        // CREATE NEW (Minimal)
                        this.activeLobbies.set(matchId, {
                            id: matchId,
                            players: players,
                            captainA: players[0],
                            captainB: players[1] || players[0],
                            teamA: players.filter((p: QueuePlayer) => p.team === 'alpha'),
                            teamB: players.filter((p: QueuePlayer) => p.team === 'bravo'),
                            readyPlayers: [],
                            mapBanState: { bannedMaps: [], currentBanTeam: 'alpha', banHistory: [], mapBanPhase: false, banTimeout: 15 },
                            readyPhaseState: { phaseActive: false, readyPlayers: [], readyPhaseTimeout: 30 },
                            matchType: msgData.matchType || 'competitive',
                            status: msgData.status || 'pending',
                            startedAt: msgData.startedAt || Date.now()
                        } as Lobby);

                        // CRITICAL: Set playerLobbyMap for reconnection support
                        players.forEach((p: QueuePlayer) => {
                            const pid = p.id || p.player_id || p.discord_id;
                            if (pid) this.playerLobbyMap.set(pid, matchId);
                        });

                        console.log(`📌 Synced NEW manual lobby ${matchId} with ${players.length} players`);
                        this.saveMatchState(); // Bug #17 Fix: Persist new lobby
                    }
                }

                if (Array.isArray(userIds)) {
                    userIds.forEach(uid => {
                        const ws = this.userSockets.get(uid);
                        if (ws && ws.readyState === WebSocket.READY_STATE_OPEN) {
                            ws.send(JSON.stringify({ type, matchId, ...msgData }));
                        }
                    });
                }
            }

            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (url.pathname.endsWith('/debug')) {
            return new Response(JSON.stringify({
                localQueueSize: this.localQueue.size,
                sessionsCount: this.sessions.size,
                remoteQueueCount: this.remoteQueue.length,
                localPlayers: Array.from(this.localQueue.values()),
                activeLobbies: Array.from(this.activeLobbies.values()), // Debug active lobbies
                registeredUsers: Array.from(this.userSockets.keys())
            }), { headers: { 'Content-Type': 'application/json' } });
        }

        const upgradeHeader = request.headers.get('Upgrade');
        if (!upgradeHeader || upgradeHeader !== 'websocket') {
            return new Response('Expected Upgrade: websocket', { status: 426 });
        }

        // 1. WebSocket Connection
        const [client, server] = Object.values(new WebSocketPair());

        this.handleSession(server);

        return new Response(null, { status: 101, webSocket: client });
    }

    async handleCheckOnline(request: Request) {
        try {
            const body = await request.json() as { userIds: string[] };
            const { userIds } = body;

            if (!Array.isArray(userIds)) {
                return new Response(JSON.stringify({ error: 'userIds must be an array' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const onlineStatus: Record<string, boolean> = {};
            for (const userId of userIds) {
                const ws = this.userSockets.get(userId);
                onlineStatus[userId] = !!(ws && ws.readyState === WebSocket.READY_STATE_OPEN);
            }

            return new Response(JSON.stringify({ onlineStatus }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error: any) {
            console.error('Check online error:', error);
            return new Response(JSON.stringify({ error: 'Failed to check online status' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    async handleServerInfo(request: Request) {
        try {
            const body = await request.json() as { lobbyId: string; serverInfo: { ip: string; password: string; matchLink?: string } };

            // Load match state if not initialized
            if (!this.initialized) {
                await this.loadMatchState();
            }

            const lobby = this.activeLobbies.get(body.lobbyId);

            // Validate lobbyId
            if (!lobby) {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Lobby not found or invalid lobbyId'
                }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Generate match link if not provided
            const matchLink = body.serverInfo.matchLink || `standoff://connect/${body.serverInfo.ip}/${body.serverInfo.password}`;

            // Store server info in lobby
            lobby.serverInfo = {
                ...body.serverInfo,
                matchLink
            };

            // Save state
            await this.saveMatchState();

            const mapBanFinished = true;

            // Broadcast to LOBBY clients
            if (mapBanFinished) {
                // Match Started
                // FETCH FRESH DATA (URL might have changed)
                try {
                    const freshData = await this.env.DB.prepare("SELECT lobby_url FROM matches WHERE id = ?").bind(lobby.id).first();
                    if (freshData && freshData.lobby_url) {
                        lobby.lobby_url = freshData.lobby_url as string;
                    }
                } catch (e) {
                    console.error("Failed to refresh lobby url in auto-pick", e);
                }

                this.broadcastToLobby(lobby.id, JSON.stringify({
                    type: 'MATCH_START',
                    lobbyId: lobby.id,
                    selectedMap: "Sandstone",
                    matchData: lobby,
                    serverInfo: lobby.serverInfo
                }));

                // Broadcast LOBBY_UPDATE with new status
                await this.env.MATCH_QUEUE.get(this.env.MATCH_QUEUE.idFromName('global-matchmaking-v2')).fetch('http://do/broadcast', {
                    method: 'POST',
                    body: JSON.stringify({
                        type: 'LOBBY_UPDATE',
                        lobbyId: lobby.id,
                        lobby: lobby
                    })
                });

                console.log(`✅ [${lobby.id}] Draft Complete (Auto/Bot). Match Started.`);
            } else {
                // Server Ready (waiting for ready phase?)
                this.broadcastToLobby(lobby.id, JSON.stringify({
                    type: 'SERVER_READY',
                    lobbyId: lobby.id,
                    serverInfo: lobby.serverInfo
                }));
            }

            // Sync
            await this.broadcastLobbyUpdate(lobby.id);

            console.log(`✅ Server info updated for lobby ${lobby.id}:`, lobby.serverInfo);

            return new Response(JSON.stringify({
                success: true,
                message: 'Server info updated successfully'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error: unknown) {
            console.error('❌ Error handling server info:', error);
            return new Response(JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // Helper: Broadcast to All (Global)
    broadcastToAll(message: string) {
        for (const ws of this.userSockets.values()) {
            if (ws.readyState === WebSocket.READY_STATE_OPEN) {
                ws.send(message);
            }
        }
    }

    // Helper: Broadcast Leaderboard Update to All Clients
    async broadcastLeaderboardUpdate() {
        try {
            const result = await this.env.DB.prepare(
                'SELECT * FROM players ORDER BY elo DESC LIMIT 500'
            ).all();

            const leaderboard = (result.results || []).map((player: any, index: number) => ({
                rank: index + 1,
                id: player.id,
                discord_id: player.discord_id,
                username: player.discord_username,
                avatar: player.discord_avatar,
                nickname: player.standoff_nickname,
                elo: player.elo,
                wins: player.wins,
                losses: player.losses,
                role: player.role,
                is_vip: player.is_vip
            }));

            // Cache the leaderboard result
            // await this.env.KV.put('leaderboard_cache', JSON.stringify(leaderboard), { expirationTtl: 300 });

            // Only broadcast if changed significantly? For now just broadcast
            this.broadcastToAll(JSON.stringify({
                type: 'LEADERBOARD_UPDATE',
                leaderboard
            }));
        } catch (error) {
            console.error('Leaderboard broadcast error:', error);
        }
    }

    // Load match state from storage
    // Load match state from storage
    async loadMatchState() {
        try {
            // 1. Load active lobbies
            const activeLobbiesMap = await this.state.storage.get<Map<string, Lobby>>('activeLobbies');
            if (activeLobbiesMap) {
                this.activeLobbies = activeLobbiesMap;

                // CRITICAL: Rebuild playerLobbyMap for reconnection support after DO restart
                for (const [lobbyId, lobby] of this.activeLobbies) {
                    lobby.players.forEach(p => {
                        const pid = p.id || p.player_id || p.discord_id;
                        if (pid) this.playerLobbyMap.set(pid, lobbyId);
                    });
                }
            }

            // 2. Load queues
            // const localQueue = await this.state.storage.get<Map<string, QueuePlayer>>('localQueue');
            // if (localQueue) this.localQueue = localQueue;

            console.log(`Loaded ${this.activeLobbies.size} active lobbies from storage.`);
        } catch (e: unknown) {
            console.error('Failed to load match state:', e);
        }
    }

    // Save match state to storage
    async saveMatchState() {
        try {
            // 1. Persist active lobbies
            await this.state.storage.put('activeLobbies', this.activeLobbies);

            // 2. Persist queue? (Maybe not needed for volatile queue)
            // await this.state.storage.put('localQueue', this.localQueue);
        } catch (e: unknown) {
            console.error('Failed to save match state:', e);
        }
    }

    // Helper to delete a lobby from storage
    async deleteLobbyFromStorage(lobbyId: string) {
        await this.state.storage.delete(`lobby_${lobbyId}`);
        // Also remove from master map if we were storing it separately
        // Since we store the whole map:
        await this.saveMatchState();
    }

    async alarm() {
        console.log('⏰ Alarm triggered');

        let stateChanged = false; // Flag to skip saving/broadcasting if nothing happened

        // 1. Handle Ready Phase Timeouts
        for (const [lobbyId, lobby] of this.activeLobbies) {
            if (lobby.readyPhaseState && lobby.readyPhaseState.phaseActive) {
                lobby.readyPhaseState.readyPhaseTimeout--;

                // Sync every 5 seconds or if near end
                if (lobby.readyPhaseState.readyPhaseTimeout % 5 === 0 || lobby.readyPhaseState.readyPhaseTimeout <= 5) {
                    this.broadcastToLobby(lobbyId, JSON.stringify({
                        type: 'READY_CHECK_UPDATE',
                        readyPlayers: lobby.readyPhaseState.readyPlayers,
                        timeout: lobby.readyPhaseState.readyPhaseTimeout
                    }));
                }

                if (lobby.readyPhaseState.readyPhaseTimeout <= 0) {
                    // READY CHECK FAILED
                    // Kick unready players
                    const unreadyPlayers = lobby.players.filter(p => !lobby.readyPhaseState.readyPlayers.includes(p.id));

                    console.log(`[${lobbyId}] Ready Phase Failed. Unready: ${unreadyPlayers.map(p => p.username).join(', ')}`);

                    // Remove unready from queue/lobby
                    unreadyPlayers.forEach(p => {
                        // Ban or timeout logic here?
                    });

                    // Dissolve Lobby / Return to Queue
                    // For now, simpler: Just cancel match
                    this.broadcastToLobby(lobbyId, JSON.stringify({
                        type: 'MATCH_CANCELLED',
                        reason: 'Ready check failed'
                    }));
                    // CRITICAL: Clear playerLobbyMap for all players in cancelled match
                    lobby.players.forEach(p => {
                        const pid = p.id || p.player_id || p.discord_id;
                        if (pid) this.playerLobbyMap.delete(pid);
                    });
                    this.activeLobbies.delete(lobbyId);
                    stateChanged = true;
                } else {
                    // Continue alarm
                    // stateChanged = true; // Optimization: don't save every second
                }
            }

            // 2. Handle Draft Timeouts (Snake Draft)
            if (lobby.draftState && lobby.draftState.isActive) {
                lobby.draftState.draftTimeout--;

                if (lobby.draftState.draftTimeout <= 0) {
                    // AUTO PICK LOGIC
                    await this.executeAutoPick(lobbyId, false);
                    stateChanged = true;
                } else {
                    // Broadcast tick every second for smooth UI
                    this.broadcastToLobby(lobbyId, JSON.stringify({
                        type: 'DRAFT_TICK',
                        timeout: lobby.draftState.draftTimeout
                    }));
                }
            }
        }

        if (this.activeLobbies.size > 0) {
            // Re-schedule alarm if any active lobbies need it
            const hasActivePhases = Array.from(this.activeLobbies.values()).some(
                l => (l.readyPhaseState?.phaseActive) || (l.draftState?.isActive)
            );

            if (hasActivePhases) {
                this.state.storage.setAlarm(Date.now() + 1000);
            }
        }

        if (stateChanged) {
            await this.saveMatchState();
        }
    }

    async broadcastMergedQueue() {
        const queue = await this.getMergedQueue();
        const data = JSON.stringify({ type: 'QUEUE_UPDATE', count: queue.length, players: queue });

        // Deduplicate broadcasts
        if (data !== this.lastQueueBroadcast || Date.now() - this.lastQueueBroadcastTime > 2000) {
            this.broadcastToAll(data);
            this.lastQueueBroadcast = data;
            this.lastQueueBroadcastTime = Date.now();
        }
    }

    async getMergedQueue(): Promise<QueuePlayer[]> {
        // Merge local and remote queues (if using distributed DOs, fetching from others)
        // Simple version: just local
        return Array.from(this.localQueue.values());
    }

    async startMatch(players: QueuePlayer[]) {
        const matchId = crypto.randomUUID();
        const lobby: Lobby = {
            id: matchId,
            players: players,
            captainA: players[0], // Logic to pick captains (Elo based?)
            captainB: players[1],
            teamA: [],
            teamB: [],
            readyPlayers: [],
            readyPhaseState: {
                phaseActive: true,
                readyPlayers: [],
                readyPhaseTimeout: 30 // 30 seconds to accept
            },
            status: 'ready_check',
            startedAt: Date.now()
        };

        // Assign Captains (First 2 highest Elo?)
        // ensure unique captains
        // ...

        this.activeLobbies.set(matchId, lobby);
        players.forEach(p => this.playerLobbyMap.set(p.id, matchId));

        // Persist
        await this.saveMatchState();

        // Broadcast
        const msg = JSON.stringify({
            type: 'MATCH_FOUND',
            lobbyId: matchId,
            players: players,
            timeout: 30
        });

        players.forEach(p => {
            const ws = this.userSockets.get(p.id);
            if (ws) ws.send(msg);
        });

        // Start Alarm for timeouts
        this.state.storage.setAlarm(Date.now() + 1000);
    }

    // Helper: Broadcast to specific lobby participants
    broadcastToLobby(lobbyId: string, message: string) {
        const lobby = this.activeLobbies.get(lobbyId); // Performance: Direct lookup
        // Fallback to chat history map if lobby object missing?

        // Store in history
        let history = this.lobbyChatHistory.get(lobbyId);
        if (!history) {
            history = [];
            this.lobbyChatHistory.set(lobbyId, history);
        }

        // Optionally parse message to check if it's a chat message to store
        try {
            const parsed = JSON.parse(message);
            if (parsed.type === 'CHAT_MESSAGE') {
                history.push(parsed.message);
                if (history.length > 50) history.shift();
            }
        } catch (e) { }

        if (lobby) {
            lobby.players.forEach(p => {
                // Check if user is online in THIS DO instance
                const ws = this.userSockets.get(p.id || p.discord_id || '');
                if (ws && ws.readyState === WebSocket.READY_STATE_OPEN) {
                    ws.send(message);
                }
            });

            // Also send to spectators? (Anyone with lobbyId in map?)
        }
    }

    async broadcastLobbyUpdate(lobbyId?: string) {
        if (!lobbyId) return;
        const lobby = this.activeLobbies.get(lobbyId);
        if (!lobby) return;

        this.broadcastToLobby(lobbyId, JSON.stringify({
            type: 'LOBBY_UPDATE',
            lobbyId: lobby.id,
            lobby: lobby
        }));
    }

    async handleSession(ws: WebSocket) {
        this.sessions.add(ws);
        // @ts-ignore
        ws.accept();

        let userId: string | null = null;

        ws.addEventListener('message', async (event) => {
            try {
                const message = JSON.parse(event.data as string) as {
                    type: string;
                    userId?: string;
                    lobbyId?: string;
                    playerId?: string;
                    message?: string;
                    [key: string]: unknown;
                };

                if (message.type === 'AUTH' || message.type === 'REGISTER') {
                    userId = message.userId ?? null;
                    if (userId) {
                        this.userSockets.set(userId, ws);

                        // Store User Data
                        if (message.username) {
                            this.userData.set(userId, {
                                username: message.username as string,
                                avatar: message.avatar as string || 'default',
                                elo: (message.elo as number) || 1000
                            });
                        }

                        // Check if user is in a lobby, send re-connect data
                        if (this.playerLobbyMap.has(userId)) {
                            const lobbyId = this.playerLobbyMap.get(userId)!;
                            const lobby = this.activeLobbies.get(lobbyId);
                            if (lobby) {
                                ws.send(JSON.stringify({
                                    type: 'RECONNECT_LOBBY',
                                    lobby: lobby
                                }));
                            }
                        }
                        // Send Global Chat History
                        ws.send(JSON.stringify({
                            type: 'CHAT_HISTORY',
                            messages: this.chatHistory
                        }));
                    }
                } else if (message.type === 'JOIN_QUEUE') {
                    // Queue Logic
                } else if (message.type === 'LEAVE_QUEUE') {
                    // Dequeue Logic
                } else if (message.type === 'SEND_CHAT' || message.type === 'CHAT_MESSAGE') {
                    // Support both legacy CHAT_MESSAGE (flat) and new SEND_CHAT
                    const content = (message.content || message.message) as string;
                    const lobbyId = message.lobbyId;

                    if (!content || !userId) return;

                    const user = this.userData.get(userId) || { username: 'Unknown', avatar: 'default' };

                    const chatMsg: ChatMessage = {
                        id: crypto.randomUUID(),
                        userId: userId,
                        username: user.username,
                        avatar: user.avatar,
                        content: content,
                        timestamp: Date.now(),
                        lobbyId: lobbyId,
                        type: 'user'
                    };

                    // Broadcast to scope (Lobby or Global)
                    if (lobbyId) {
                        this.broadcastToLobby(lobbyId, JSON.stringify({
                            type: 'CHAT_MESSAGE',
                            lobbyId: lobbyId,
                            message: chatMsg
                        }));
                    } else {
                        // Store in history
                        this.chatHistory.push(chatMsg);
                        if (this.chatHistory.length > 50) this.chatHistory.shift();

                        this.broadcastToAll(JSON.stringify({
                            type: 'CHAT_MESSAGE',
                            message: chatMsg
                        }));
                    }
                }
                else if (message.type === 'DRAFT_PICK') {
                    console.log('[WS] 📨 DRAFT_PICK message received:', message);
                    const { lobbyId, pickedPlayerId } = message; // picked player ID
                    const pickerId = userId; // Captain ID

                    console.log(`[DRAFT_PICK] 🎯 Request: Lobby=${lobbyId}, Picker=${pickerId}, Target=${pickedPlayerId}`);

                    if (!lobbyId || !pickedPlayerId || !pickerId) {
                        console.log(`[DRAFT_PICK] ❌ Missing Data`);
                        return;
                    }

                    const lobby = this.activeLobbies.get(lobbyId);
                    if (!lobby || !lobby.draftState || !lobby.draftState.isActive) {
                        console.log(`[DRAFT_PICK] ❌ Invalid Lobby or Inactive Draft. Active? ${!!lobby?.draftState?.isActive}`);
                        return;
                    }

                    const state = lobby.draftState;
                    console.log(`[DRAFT_PICK] Current Turn: ${state.currentTurn}`);

                    // Validate Turn
                    const currentPickerEnv = state.currentTurn === 'captainA' ? lobby.captainA : lobby.captainB;
                    console.log(`[DRAFT_PICK] Expected Picker: ${currentPickerEnv.id} (or ${currentPickerEnv.player_id})`);

                    // Using loose equality or checking both id/player_id
                    if (currentPickerEnv.id !== pickerId && currentPickerEnv.player_id !== pickerId) {
                        console.log(`[DRAFT_PICK] ❌ Not picker's turn. Picker=${pickerId}`);
                        // Not your turn
                        ws.send(JSON.stringify({ type: 'ERROR', message: 'Not your turn!' }));
                        return;
                    }

                    // Validate Pick (Is player in pool?)
                    // CHECK BOTH ID AND PLAYER_ID
                    const pickedPlayerIndex = state.pool.findIndex(p => p.id === pickedPlayerId || p.player_id === pickedPlayerId);
                    console.log(`[DRAFT_PICK] Pool Index Found: ${pickedPlayerIndex}`);

                    if (pickedPlayerIndex === -1) {
                        console.log(`[DRAFT_PICK] ❌ Player not in pool. Pool IDs: ${state.pool.map(p => p.id || p.player_id).join(', ')}`);
                        ws.send(JSON.stringify({ type: 'ERROR', message: 'Player not in pool or already picked!' }));
                        return;
                    }
                    const pickedPlayer = state.pool[pickedPlayerIndex];

                    // EXECUTE PICK
                    // 1. Move from Pool to Team
                    state.pool.splice(pickedPlayerIndex, 1);

                    if (state.currentTurn === 'captainA') {
                        lobby.teamA.push(pickedPlayer);
                    } else {
                        lobby.teamB.push(pickedPlayer);
                    }

                    state.pickHistory.push({ pickerId: pickerId!, pickedId: String(pickedPlayerId) });

                    // 2. Advance Turn
                    const picksMade = state.pickHistory.length;
                    const nextTurnRole = state.pickOrder[picksMade]; // Get next from predefined order

                    // Is Draft Over?
                    // Pool size check or pick count check. 
                    // 10 players total. 2 Captains. 8 in pool.
                    // Pick order length is 7. 
                    // If picksMade == 7, one player left. Auto-assign to B.

                    if (!nextTurnRole || state.pool.length === 1) {
                        // DRAFT COMPLETE
                        // Auto assign last player to Team Bravo (as per logic: A picks 4, B picks 3, last goes to B)
                        // OR check remaining pool

                        if (state.pool.length === 1) {
                            const lastPlayer = state.pool[0];
                            lobby.teamB.push(lastPlayer);
                            state.pool = []; // Clear pool
                        }

                        state.isActive = false;

                        // Shared Finalize Logic
                        this.finalizeDraft(lobbyId, lobby).catch(console.error);
                    } else {
                        // Next Turn
                        state.currentTurn = nextTurnRole;
                        state.lastPickTimestamp = Date.now();
                        state.draftTimeout = 15; // Reset Timer

                        // Force Alarm Update
                        this.state.storage.setAlarm(Date.now() + 1000);

                        // Broadcast Update
                        this.broadcastToLobby(lobbyId, JSON.stringify({
                            type: 'DRAFT_UPDATE',
                            matchId: lobbyId, // Required by frontend filter
                            draftState: state,
                            teamA: lobby.teamA, // Flatten for frontend
                            teamB: lobby.teamB
                        }));

                        // RECURSE: Check if NEXT turn is bot (only if we just acted)
                        // If we just timeout-picked for a human, and next is bot, we should trigger bot logic
                        if (lobby.draftState.isActive) {
                            this.executeAutoPick(lobbyId, true).catch(console.error);
                        }
                    }
                }
                else if (message.type === 'REQUEST_MATCH_STATE') {
                    const requestedId = message.lobbyId;
                    let targetLobbyId = this.playerLobbyMap.get(userId || '');

                    console.log(`🔎 REQUEST_MATCH_STATE: User=${userId}, MapLobby=${targetLobbyId}, ReqLobby=${requestedId}`);

                    // 1. Verify existence of Map-derived Lobby
                    if (targetLobbyId && !this.activeLobbies.has(targetLobbyId)) {
                        console.warn(`⚠️ User ${userId} mapped to Ghost Lobby ${targetLobbyId}. invalidating mapping.`);
                        this.playerLobbyMap.delete(userId || '');
                        targetLobbyId = undefined;
                    }

                    // 2. Fallback to Payload Lobby ID if Map failed
                    if (!targetLobbyId && requestedId) {
                        const existing = this.activeLobbies.get(requestedId);

                        if (existing) {
                            // Security: Is user in this lobby?
                            if (existing.players.some(p => (p.id === userId || p.player_id === userId))) {
                                targetLobbyId = requestedId;
                                if (userId) this.playerLobbyMap.set(userId, targetLobbyId);
                                console.log(`🔧 Repaired map for ${userId} -> ${targetLobbyId}`);
                            }
                        } else {
                            // 3. Resurrection (Bug #17)
                            console.log(`⚰️ Lobby ${requestedId} missing from RAM. Attempting resurrection...`);
                            const resurrected = await this.reconstructLobbyFromDB(requestedId);
                            if (resurrected) {
                                targetLobbyId = requestedId;
                                console.log(`🧟 RESURRECTED Lobby ${targetLobbyId} Success!`);
                            } else {
                                console.log(`❌ Resurrection failed for ${requestedId}`);
                            }
                        }
                    }

                    if (targetLobbyId) {
                        this.broadcastLobbyUpdate(targetLobbyId);

                        const lobby = this.activeLobbies.get(targetLobbyId);
                        if (lobby?.draftState?.isActive) {
                            console.log(`📤 Sending DRAFT_STATE to ${userId} for lobby ${targetLobbyId}`);
                            ws.send(JSON.stringify({
                                type: 'DRAFT_START',
                                lobbyId: lobby.id,
                                draftState: lobby.draftState,
                                captainAlpha: lobby.captainA,
                                captainBravo: lobby.captainB,
                                captainA: lobby.captainA,
                                captainB: lobby.captainB,
                                captainAlphaId: lobby.captain_alpha_id,
                                captainBravoId: lobby.captain_bravo_id,
                                teams: { A: lobby.teamA, B: lobby.teamB }
                            }));
                        } else {
                            console.log(`ℹ️ Lobby ${targetLobbyId} found but draft not active? (DraftState: ${!!lobby?.draftState}, Active: ${!!lobby?.draftState?.isActive})`);
                        }
                    } else {
                        console.warn(`⚠️ Could not resolve lobby for user ${userId} (Req: ${requestedId})`);
                        ws.send(JSON.stringify({ type: 'ERROR', message: 'Lobby not found or access denied' }));
                    }
                }
            } catch (err: unknown) {
                console.error('WebSocket Error:', err);
            }
        });

        ws.addEventListener('close', () => {
            this.sessions.delete(ws);
            if (userId) {
                this.userSockets.delete(userId);
                // Handle disconnect logic (mark offline, etc)
            }
        });

        ws.addEventListener('error', (err: unknown) => {
            console.error("WS Error:", err);
        });
    }

    async isModerator(userId: string): Promise<boolean> {
        // Check admin list or DB
        return false; // placeholder
    }

    // --- RECOVERY LOGIC (Bug #17 Fix: Ghost Resurrection) ---
    async reconstructLobbyFromDB(lobbyId: string): Promise<Lobby | null> {
        try {
            console.log(`⚕️ Attempting to resurrect Ghost Lobby ${lobbyId} from DB...`);

            // 1. Fetch Match Data
            const matchResult = await this.env.DB.prepare(`
                SELECT * FROM matches WHERE id = ?
            `).bind(lobbyId).first();

            if (!matchResult) {
                console.log(`❌ Match ${lobbyId} not found in DB.`);
                return null;
            }

            // 2. Fetch Players
            const playersResult = await this.env.DB.prepare(`
                SELECT 
                    mp.*, 
                    u.username, u.avatar, u.discord_id, u.standoff_nickname,
                    p.elo
                FROM match_players mp
                LEFT JOIN users u ON mp.player_id = u.id
                LEFT JOIN players p ON mp.player_id = p.id
                WHERE mp.match_id = ?
            `).bind(lobbyId).all();

            const dbPlayers = playersResult.results as unknown as Record<string, any>[];
            if (!dbPlayers || dbPlayers.length === 0) return null;

            // 3. Reconstruct Players
            const players: QueuePlayer[] = dbPlayers.map(p => ({
                id: p.player_id,
                username: p.username || p.standoff_nickname || `Player ${p.player_id.slice(0, 4)}`,
                avatar: p.avatar,
                discord_id: p.discord_id || p.player_id,
                elo: p.elo || 1000,
                team: p.team
            }));

            // 4. Identify Captains (Improved Logic for Bug #17 Refinement)
            // Priority 1: Match Host is ALWAYS Captain A (Alpha)
            const hostId = matchResult.host_id as string;

            // Priority 2: Captain flags in DB or Team leaders (fallback)
            const teamA = players.filter(p => p.team === 'alpha');
            const teamB = players.filter(p => p.team === 'bravo');

            // CAPTAIN A: Host > Team A Leader > First Team A Player
            const captainA = players.find(p => p.id === hostId || p.player_id === hostId)
                || dbPlayers.find(p => p.team === 'alpha' && p.is_captain)
                || teamA[0] || players[0];

            // CAPTAIN B: Captain Flag > Team B Leader > First Team B Player
            const captainB = dbPlayers.find(p => p.team === 'bravo' && p.is_captain)
                || teamB[0] || players[1];

            const lobby: Lobby = {
                id: lobbyId,
                players: players,
                captainA: { ...captainA, id: captainA.player_id } as QueuePlayer, // cast mainly for ID
                captainB: { ...captainB, id: captainB.player_id } as QueuePlayer,
                teamA: teamA,
                teamB: teamB,
                readyPlayers: [],
                mapBanState: { bannedMaps: [], currentBanTeam: 'alpha', banHistory: [], mapBanPhase: false, banTimeout: 15 },
                readyPhaseState: { phaseActive: false, readyPlayers: [], readyPhaseTimeout: 30 },
                matchType: (matchResult.match_type as string) || 'competitive',
                status: (matchResult.status as string) || 'pending',
                startedAt: Date.now() // Close enough
            };

            lobby.captain_alpha_id = captainA.player_id;
            lobby.captain_bravo_id = captainB.player_id;

            // 5. Reconstruct Draft State if Drafting
            if (lobby.status === 'drafting') {
                const pool = players.filter(p => !p.team); // Everyone not in a team

                // Infer Turn
                const picksMade = teamA.length + teamB.length - 2; // Subtract captains (assuming 1 each start)
                // If teams are empty (just captains), picks = 0.

                // Pick Order: A, B, A, B...
                // Turn 0 = A, Turn 1 = B...
                const turnRole = (picksMade % 2 === 0) ? 'captainA' : 'captainB';

                lobby.draftState = {
                    isActive: true,
                    pool: pool,
                    currentTurn: turnRole,
                    pickOrder: ['captainA', 'captainB', 'captainA', 'captainB', 'captainA', 'captainB', 'captainA'], // Standard
                    pickHistory: [], // Hard to reconstruct accurately without logs, but empty is safe-ish
                    draftTimeout: 30,
                    lastPickTimestamp: Date.now()
                };

                // Ensure captains are set correctly in Lobby object for logic usage
                lobby.captainA = players.find(p => p.id === lobby.captain_alpha_id) || lobby.captainA;
                lobby.captainB = players.find(p => p.id === lobby.captain_bravo_id) || lobby.captainB;
            }

            // 6. Save and Return
            this.activeLobbies.set(lobbyId, lobby);

            // Re-bind player maps
            players.forEach(p => {
                const pid = p.id || p.discord_id;
                if (pid) this.playerLobbyMap.set(pid, lobbyId);
            });

            await this.saveMatchState();
            console.log(`✅ successfully resurrected lobby ${lobbyId} (Status: ${lobby.status})`);

            return lobby;

        } catch (e: unknown) {
            console.error(`❌ Failed to reconstruct lobby ${lobbyId}:`, e);
            return null;
        }
    }

    // --- AUTO / BOT PICK LOGIC ---
    async executeAutoPick(lobbyId: string, isBotLogic: boolean) {
        const lobby = this.activeLobbies.get(lobbyId);
        if (!lobby || !lobby.draftState || !lobby.draftState.isActive) return;

        const state = lobby.draftState;
        const currentStats = state.currentTurn === 'captainA' ? lobby.captainA : lobby.captainB;

        // Check if current picker is a BOT or if we are forcing because of TimeOut
        const isBot = (currentStats.id || '').startsWith('bot_') || (currentStats.id || '').startsWith('auto_');

        if (isBotLogic && !isBot) return; // If we are running bot logic, but captain is human, exit.

        // Delat for bot realism
        if (isBot) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Re-check state after delay
            if (!this.activeLobbies.has(lobbyId)) return;
            if (!lobby.draftState.isActive) return;
        }

        // PICK HIGHEST ELO PLAYER available
        // Sort pool by Elo desc
        const sortedPool = [...state.pool].sort((a, b) => (b.elo || 1000) - (a.elo || 1000));
        if (sortedPool.length === 0) return;

        const bestPick = sortedPool[0];

        console.log(`🤖 Auto-Picking ${bestPick.username} for ${state.currentTurn}`);

        // Simulate DRAFT_PICK message
        const fakeMessage = {
            type: 'DRAFT_PICK',
            lobbyId: lobbyId,
            playerId: bestPick.id
        };

        // We can't easily "inject" into the message handler because we need the context of the picker (userId)
        // So we have to replicate the logic OR call a shared internal function.
        // Replicating logic here for safety/speed:

        // 1. Move
        const idx = state.pool.findIndex(p => p.id === bestPick.id);
        if (idx !== -1) {
            state.pool.splice(idx, 1);
            if (state.currentTurn === 'captainA') lobby.teamA.push(bestPick);
            else lobby.teamB.push(bestPick);

            state.pickHistory.push({ pickerId: currentStats.id, pickedId: bestPick.id });

            // 2. Advance
            const picksMade = state.pickHistory.length;
            const nextTurnRole = state.pickOrder[picksMade];

            if (!nextTurnRole || state.pool.length === 1) {
                // COPY PASTE FINALIZE LOGIC (Refactor this to a method `endDraft(lobby)`)
                if (state.pool.length === 1) {
                    const lastPlayer = state.pool[0];
                    lobby.teamB.push(lastPlayer);
                    state.pool = [];
                }
                state.isActive = false;

                state.isActive = false;

                // Shared Finalize Logic
                this.finalizeDraft(lobbyId, lobby).catch(console.error);

            } else {
                state.currentTurn = nextTurnRole;
                state.lastPickTimestamp = Date.now();
                state.draftTimeout = 15;
                this.state.storage.setAlarm(Date.now() + 1000);

                this.broadcastToLobby(lobbyId, JSON.stringify({
                    type: 'DRAFT_UPDATE',
                    draftState: state,
                    teams: { A: lobby.teamA, B: lobby.teamB }
                }));

                // Recursive Bot Check
                this.executeAutoPick(lobbyId, true).catch(console.error);
            }
        }
    }

    // Shared Finalize Draft Logic (Centralized for DRAFT_PICK and executeAutoPick)
    async finalizeDraft(lobbyId: string, lobby: Lobby) {
        console.log(`🏁 [${lobbyId}] finalizeDraft() CALLED. Status: ${lobby.status}, Players: ${lobby.players.length}`);

        // 1. Update Team attributes
        lobby.teamA.forEach(p => p.team = 'alpha');
        lobby.teamB.forEach(p => p.team = 'bravo');

        // 2. Update lobby.players
        lobby.players = [...lobby.teamA, ...lobby.teamB];

        await this.broadcastLobbyUpdate(lobbyId);

        // 3. Update DB: Status -> in_progress & Persist Players

        // STEP A: Insert Bots (Separate Try-Catch)
        try {
            const botPlayers = lobby.players.filter(p => (p.id || '').startsWith('bot_') || (p.id || '').startsWith('auto_'));
            if (botPlayers.length > 0) {
                console.log(`[${lobbyId}] Inserting ${botPlayers.length} bot players into DB...`);
                const botBatch = botPlayers.map(p => this.env.DB.prepare(`
                    INSERT INTO players (
                        id, username, discord_username, standoff_nickname, 
                        is_discord_member, created_at, nickname_updated_at,
                        discord_id, avatar, role, elo, is_vip, banned, daily_comp_matches_used, balance, wins, losses, gold
                    ) VALUES (
                        ?, ?, ?, ?, 
                        0, datetime('now'), datetime('now'),
                        ?, ?, 'user', 1000, 0, 0, 0, 0, 0, 0, 0
                    ) ON CONFLICT(id) DO UPDATE SET
                        username = excluded.username,
                        discord_username = excluded.discord_username,
                        standoff_nickname = excluded.standoff_nickname,
                        nickname_updated_at = datetime('now')
                `).bind(
                    p.id,
                    p.username || `Bot ${p.id.slice(0, 8)}`,
                    p.username || `Bot ${p.id.slice(0, 8)}`,
                    null, // CRITICAL: Set nickname to NULL to avoid UNIQUE constraint violation on 'standoff_nickname' index
                    p.id, // using ID as discord_id for bots to satisfy unique constraint
                    p.avatar || 'default_avatar'
                ));

                const botResults = await this.env.DB.batch(botBatch);
                console.log(`✅ [${lobbyId}] Bot players inserted: ${botResults.length}/${botPlayers.length}`);
            }
        } catch (botErr: any) {
            console.error(`❌ [${lobbyId}] BOT INSERT ERROR:`, botErr);
            this.broadcastToLobby(lobbyId, JSON.stringify({
                type: 'CHAT_MESSAGE',
                senderId: 'SYSTEM',
                content: `DB ERROR (Bots): ${botErr.message}`,
                timestamp: Date.now()
            }));
        }

        // STEP B: Update Match & Stick Players (Separate Try-Catch)
        try {
            // Update Match Status
            await this.env.DB.prepare("UPDATE matches SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?")
                .bind(lobbyId).run();

            // Clear old players (idempotency)
            await this.env.DB.prepare("DELETE FROM match_players WHERE match_id = ?").bind(lobbyId).run();

            // Insert Match Players (using AUTOINCREMENT id)
            console.log(`[${lobbyId}] Inserting ${lobby.players.length} match_players...`);

            const playerStmt = this.env.DB.prepare(`
                INSERT INTO match_players (match_id, player_id, team, is_captain, joined_at) 
                VALUES (?, ?, ?, ?, datetime('now'))
            `);

            const batch = lobby.players.map(p => {
                const isCaptain = (p.id === lobby.captainA.id || p.id === lobby.captainB.id) ? 1 : 0;
                const team = p.team || (lobby.teamA.find(x => x.id === p.id) ? 'alpha' : 'bravo');
                return playerStmt.bind(
                    lobbyId,
                    p.id,
                    team,
                    isCaptain
                );
            });

            const results = await this.env.DB.batch(batch);
            console.log(`✅ [${lobbyId}] Match Players Inserted: ${results.length}/${lobby.players.length}`);

        } catch (matchErr: any) {
            console.error(`❌ [${lobbyId}] MATCH PERSISTENCE ERROR:`, matchErr);
            this.broadcastToLobby(lobbyId, JSON.stringify({
                type: 'CHAT_MESSAGE',
                senderId: 'SYSTEM',
                content: `DB ERROR (Match): ${matchErr.message}`,
                timestamp: Date.now()
            }));
        }

        // Match Start Broadcast
        this.broadcastToLobby(lobbyId, JSON.stringify({
            type: 'MATCH_START',
            lobbyId: lobby.id,
            selectedMap: "Sandstone",
            matchData: lobby,
            serverInfo: lobby.serverInfo
        }));
    }

    async handlePurgeLobby(request: Request) {
        try {
            const { matchId } = await request.json() as { matchId: string };
            if (!matchId) return new Response(JSON.stringify({ success: false, error: 'Match ID required' }), { status: 400 });

            const lobby = this.activeLobbies.get(matchId);
            if (lobby) {
                console.log(`🧹 [${matchId}] Explicitly purging lobby from memory.`);

                // 1. Remove from maps
                this.activeLobbies.delete(matchId);
                lobby.players.forEach(p => {
                    const pid = p.id || p.discord_id || (p as QueuePlayer).player_id;
                    if (pid) this.playerLobbyMap.delete(pid);
                });

                // 2. Clean from persistent storage
                await this.deleteLobbyFromStorage(matchId);

                // 3. Save master state (playerMap_v2 update)
                await this.saveMatchState();

                console.log(`✅ [${matchId}] Purge complete.`);
            }

            return new Response(JSON.stringify({ success: true }));
        } catch (e: unknown) {
            console.error("Purge Error:", e);
            return new Response(JSON.stringify({ success: false, error: (e as Error).message }), { status: 500 });
        }
    }

    async handleJoinLobby(request: Request) {
        try {
            const body = await request.json() as { matchId: string; player: { id: string; username: string; avatar: string; elo?: number }; team?: 'alpha' | 'bravo' };
            const { matchId, player } = body;

            if (!matchId) return new Response(JSON.stringify({ success: false, error: 'Match ID required' }), { status: 400 });
            if (!player || !player.id) return new Response(JSON.stringify({ success: false, error: 'Player data required' }), { status: 400 });

            let lobby = this.activeLobbies.get(matchId);

            // Hydrate from DB if not in memory (Fixes race condition for 'Waiting' matches)
            if (!lobby) {
                const match = await this.env.DB.prepare("SELECT * FROM matches WHERE id = ?").bind(matchId).first();
                if (!match) return new Response(JSON.stringify({ success: false, error: 'Match not found' }), { status: 404 });

                // Load existing players from DB
                const playersResult = await this.env.DB.prepare(`
             SELECT mp.*, p.discord_username, p.discord_avatar, p.standoff_nickname, p.elo, p.role
             FROM match_players mp
             LEFT JOIN players p ON mp.player_id = p.id
             WHERE mp.match_id = ?
             ORDER BY mp.joined_at
         `).bind(matchId).all();

                const players = (playersResult.results || []).map((p: any) => ({
                    id: p.player_id,
                    username: p.discord_username || p.username,
                    avatar: p.discord_avatar,
                    elo: p.elo || 1000,
                    joinedAt: new Date(p.joined_at as string).getTime(), // Ensure Date parsing
                    role: p.role,
                    team: p.team,
                    is_captain: p.is_captain
                }));

                // Reconstruct basic lobby state
                lobby = {
                    id: matchId,
                    players: players,
                    captainA: players.find((p: any) => p.is_captain && p.team === 'alpha') || players[0],
                    captainB: players.find((p: any) => p.is_captain && p.team === 'bravo'),
                    teamA: players.filter((p: any) => p.team === 'alpha'),
                    teamB: players.filter((p: any) => p.team === 'bravo'),
                    matchType: match.match_type as string,
                    status: match.status as string,
                    max_players: (match.max_players as number) || 10,
                    readyPlayers: [],
                    readyPhaseState: { phaseActive: false, readyPlayers: [], readyPhaseTimeout: 30 }
                } as Lobby;

                this.activeLobbies.set(matchId, lobby!);

                // CRITICAL: Set playerLobbyMap for all hydrated players (reconnection support)
                players.forEach((p: any) => {
                    if (p.id) this.playerLobbyMap.set(p.id, matchId);
                });

                console.log(`✅ [${matchId}] Hydrated match into DO memory with ${players.length} players.`);
            }

            // 2. CHECK CAPACITY (Synchronous Check - The Race Condition Fix)
            if (lobby!.players.length >= (lobby!.max_players || 10)) {
                return new Response(JSON.stringify({ success: false, error: 'Lobby is full' }), { status: 400 });
            }

            const joinTeam = body.team;

            // 2.1 CHECK TEAM CAPACITY (Prevents 6v4)
            if (joinTeam && lobby!.matchType !== 'clan_lobby' && lobby!.matchType !== 'dm' && lobby!.matchType !== 'gun_game') {
                const teamLimit = (lobby!.max_players || 10) / 2;
                const currentTeamCount = lobby!.players.filter((p: QueuePlayer) => p.team === joinTeam).length;
                if (currentTeamCount >= teamLimit) {
                    return new Response(JSON.stringify({ success: false, error: `Team ${joinTeam} is full` }), { status: 400 });
                }
            }

            // Check Duplicates
            if (lobby!.players.find((p: QueuePlayer) => p.id === player.id)) {
                return new Response(JSON.stringify({ success: false, error: 'Already in this match' }), { status: 400 });
            }

            // 3. Add Player (Sync)
            const newPlayer = {
                id: player.id,
                username: player.username,
                avatar: player.avatar,
                elo: player.elo || 1000,
                joinedAt: Date.now(),
                team: joinTeam // CRITICAL: Store team in memory
            };
            lobby!.players.push(newPlayer as QueuePlayer);

            // CRITICAL: Set playerLobbyMap for reconnection support
            this.playerLobbyMap.set(player.id, matchId);

            // 4. Persist (Async with Rollback)
            try {
                await this.env.DB.prepare(`
             INSERT INTO match_players (match_id, player_id, team, is_captain, joined_at)
             VALUES (?, ?, ?, 0, datetime('now'))
           `).bind(matchId, player.id, body.team || null).run();

                // Update player_count (Crucial for List View & DB Integrity)
                await this.env.DB.prepare(`
             UPDATE matches SET player_count = player_count + 1, updated_at = datetime('now')
             WHERE id = ?
          `).bind(matchId).run();
            } catch (dbErr: unknown) {
                console.error(`❌ [${matchId}] Join persistence failed. Rolling back memory.`, dbErr);
                // ROLLBACK MEMORY (Remove the player we just added)
                lobby!.players = lobby!.players.filter(p => p.id !== player.id);
                throw dbErr; // Re-throw to inform client
            }

            // Notify players in lobby
            this.broadcastLobbyUpdate(matchId);

            // Notify Global List (MatchmakingPage)
            this.broadcastToAll(JSON.stringify({
                type: 'LOBBY_UPDATED',
                matchId,
                count: lobby!.players.length,
                status: lobby!.status
            }));

            return new Response(JSON.stringify({ success: true, count: lobby!.players.length }));

        } catch (e: any) {
            console.error("Join Error:", e);
            return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
        }
    }

}
