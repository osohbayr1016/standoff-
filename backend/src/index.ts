import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { players } from './db/schema';
import { nicknameSchema, updateProfileSchema } from './schemas/profile';
import { setupProfileRoutes } from './routes/profile';
import { setupLeaderboardRoutes } from './routes/leaderboard';
import { setupAdminRoutes } from './routes/admin';
import { setupFriendsRoutes } from './routes/friends';
import neatqueueWebhook from './webhooks/neatqueue';

// ============= Type Definitions =============
interface QueuePlayer {
  id: string;
  discord_id?: string;
  username: string;
  name?: string;
  avatar?: string | null;
  elo?: number;
}

interface MapBanState {
  bannedMaps: string[];
  currentBanTeam: 'alpha' | 'bravo';
  banHistory: Array<{ team: 'alpha' | 'bravo'; map: string; timestamp: number }>;
  selectedMap?: string;
  mapBanPhase: boolean;
  lastBanTimestamp?: number;
  currentTurnStartTimestamp?: number;
  banTimeout: number;
}

interface ReadyPhaseState {
  phaseActive: boolean;
  readyPlayers: string[];
  readyPhaseStartTimestamp?: number;
  readyPhaseTimeout: number;
}

interface ServerInfo {
  ip: string;
  password: string;
  matchLink?: string;
  matchId?: string;
  note?: string;
}

interface Lobby {
  id: string;
  players: QueuePlayer[];
  captainA: QueuePlayer;
  captainB: QueuePlayer;
  teamA: QueuePlayer[];
  teamB: QueuePlayer[];
  readyPlayers: string[];
  mapBanState: MapBanState;
  readyPhaseState: ReadyPhaseState;
  serverInfo?: ServerInfo;
}

interface Env {
  MATCH_QUEUE: DurableObjectNamespace;
  DB: D1Database;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_REDIRECT_URI: string;
  DISCORD_SERVER_ID: string;
  DISCORD_CHANNEL_ID: string;
  FRONTEND_URL: string;
  NEATQUEUE_API_KEY?: string;
  NEATQUEUE_WEBHOOK_SECRET?: string;
}

interface WebhookData {
  type: string;
  data: Record<string, unknown>;
}

// 1. Durable Object - Real-time системд хэрэгтэй
export class MatchQueueDO {
  sessions: Set<WebSocket> = new Set();
  userSockets: Map<string, WebSocket> = new Map();
  localQueue: Map<string, QueuePlayer> = new Map();
  remoteQueue: QueuePlayer[] = [];

  constructor(public state: DurableObjectState, public env: Env) { }


  async fetch(request: Request) {
    const url = new URL(request.url);

    // Handle API endpoints
    if (url.pathname.endsWith('/server-info') && request.method === 'POST') {
      return this.handleServerInfo(request);
    }

    if (url.pathname.endsWith('/broadcast') && request.method === 'POST') {
      const body = await request.json() as { type: string; data: any };
      console.log('📢 DO Internal Broadcast:', body.type);

      // Handle NeatQueue webhook events relayed from Worker
      if (body.type.startsWith('NEATQUEUE_')) {
        // Just broadcast globally for now
        this.broadcastToAll(JSON.stringify({
          type: body.type,
          data: body.data
        }));
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

      // Check if all players are ready
      const readyPhaseState = lobby.readyPhaseState;
      const players = lobby.players || [];
      const allPlayersReady = readyPhaseState.readyPlayers.length >= players.length;

      // Broadcast to LOBBY clients
      if (allPlayersReady) {
        // Match Started
        this.broadcastToLobby(lobby.id, JSON.stringify({
          type: 'MATCH_START',
          lobbyId: lobby.id,
          selectedMap: lobby.mapBanState?.selectedMap,
          matchData: lobby,
          serverInfo: lobby.serverInfo
        }));
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
        'SELECT * FROM players ORDER BY mmr DESC LIMIT 500'
      ).all();

      const leaderboard = (result.results || []).map((player: any, index: number) => ({
        rank: index + 1,
        id: player.id,
        discord_id: player.discord_id,
        username: player.discord_username,
        avatar: player.discord_avatar,
        nickname: player.standoff_nickname,
        elo: player.mmr,
        wins: player.wins,
        losses: player.losses,
      }));

      this.broadcastToAll(JSON.stringify({
        type: 'LEADERBOARD_UPDATE',
        data: leaderboard
      }));

      console.log('📊 Broadcasted leaderboard update to all clients');
    } catch (error) {
      console.error('Error broadcasting leaderboard update:', error);
    }
  }

  // Multi-Match Architecture State
  activeLobbies: Map<string, Lobby> = new Map();
  playerLobbyMap: Map<string, string> = new Map(); // UserId -> LobbyId

  // Legacy/Global state (Removed/Deprecated)
  // matchState: 'IDLE' | 'LOBBY' | 'GAME' = 'IDLE'; 
  // currentLobby: Lobby | null = null;

  readyPhaseTimer: ReturnType<typeof setTimeout> | null = null;
  initialized: boolean = false; // Track if we've loaded from storage

  // Load match state from storage
  async loadMatchState() {
    try {
      const savedState = await this.state.storage.get<{
        lobbies: [string, Lobby][],
        playerMap: [string, string][]
      }>('matchState_v2');

      if (savedState) {
        this.activeLobbies = new Map(savedState.lobbies);
        this.playerLobbyMap = new Map(savedState.playerMap);
        console.log(`✅ Loaded ${this.activeLobbies.size} active lobbies from storage.`);
      } else {
        // Fallback: Check legacy state and migrate if possible? 
        // For now, clean slate is better for major refactor.
        console.log('ℹ️ No v2 match state found, starting fresh.');
      }
    } catch (error) {
      console.error('❌ Error loading match state:', error);
    }
    this.initialized = true;
  }

  // Save match state to storage
  async saveMatchState() {
    try {
      // Serialize Maps to Arrays for JSON storage
      await this.state.storage.put('matchState_v2', {
        lobbies: Array.from(this.activeLobbies.entries()),
        playerMap: Array.from(this.playerLobbyMap.entries())
      });
      console.log(`💾 Saved state: ${this.activeLobbies.size} lobbies, ${this.playerLobbyMap.size} players.`);
    } catch (error) {
      console.error('❌ Error saving match state:', error);
    }
  }

  async alarm() {
    try {
      console.log('⏰ Alarm firing...');

      // Load state from storage if not initialized
      if (!this.initialized) {
        await this.loadMatchState();
      }

      await this.syncWithNeatQueue(); // Updates this.remoteQueue
      const merged = this.getMergedQueue();

      // 1. MATCHMAKING CHECK
      // Always check if we have enough players to start a NEW match
      if (merged.length >= 10) {
        await this.startMatch(merged.slice(0, 10));
      }

      // 2. LOBBY TIMEOUT CHECKS
      for (const [lobbyId, lobby] of this.activeLobbies) {
        try {
          const banState = lobby.mapBanState;
          const readyState = lobby.readyPhaseState;

          // A. MAP BAN
          if (banState?.mapBanPhase) {
            const lastActivity = banState.currentTurnStartTimestamp || banState.lastBanTimestamp || Date.now();
            const elapsed = (Date.now() - lastActivity) / 1000;
            if (elapsed > (banState.banTimeout + 5)) {
              // Auto Ban Logic
              console.log(`⏰ [${lobbyId}] Auto-banning map...`);
              const ALL_MAPS = ['Hanami', 'Rust', 'Zone 7', 'Dune', 'Breeze', 'Province', 'Sandstone'];
              const availableMaps = ALL_MAPS.filter(m => !banState.bannedMaps.includes(m));

              if (availableMaps.length > 0) {
                const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];
                banState.bannedMaps.push(randomMap);
                banState.banHistory.push({
                  team: banState.currentBanTeam,
                  map: randomMap,
                  timestamp: Date.now(),
                  // isAutoBan: true // Removed type error
                });
                banState.currentBanTeam = banState.currentBanTeam === 'alpha' ? 'bravo' : 'alpha';
                banState.currentTurnStartTimestamp = Date.now();

                // End condition
                if (banState.bannedMaps.length >= 6) {
                  const finalMap = ALL_MAPS.find(m => !banState.bannedMaps.includes(m));
                  banState.selectedMap = finalMap;
                  banState.mapBanPhase = false;

                  // Start Ready Phase
                  if (finalMap) { // Type check
                    lobby.readyPhaseState.phaseActive = true;
                    lobby.readyPhaseState.readyPhaseStartTimestamp = Date.now();
                    lobby.readyPhaseState.readyPhaseTimeout = 30;

                    this.broadcastToLobby(lobbyId, JSON.stringify({
                      type: 'READY_PHASE_STARTED',
                      lobbyId: lobbyId,
                      selectedMap: finalMap,
                      readyPhaseTimeout: 30
                    }));
                  }
                }
                await this.broadcastLobbyUpdate(lobbyId);
              }
            }
          }

          // B. READY PHASE
          if (readyState?.phaseActive) {
            const elapsed = (Date.now() - (readyState.readyPhaseStartTimestamp || Date.now())) / 1000;
            const playerCount = lobby.players.length;
            const readyCount = readyState.readyPlayers.length;

            if (elapsed > readyState.readyPhaseTimeout && readyCount < playerCount) {
              console.log(`⏰ [${lobbyId}] Ready timeout. Cancelling.`);
              // Cancel Match
              this.broadcastToLobby(lobbyId, JSON.stringify({
                type: 'MATCH_CANCELLED',
                reason: 'Ready timer expired'
              }));

              // Clean up
              this.activeLobbies.delete(lobbyId);
              lobby.players.forEach(p => {
                const pid = p.id || p.discord_id;
                if (pid) this.playerLobbyMap.delete(pid);
              });
              await this.saveMatchState();
            }
          }
        } catch (err) {
          console.error(`❌ Error in lobby loop ${lobbyId}:`, err);
        }
      }

      // 3. BROADCAST QUEUE STATUS
      this.broadcastMergedQueue();

      this.broadcastToAll(JSON.stringify({
        type: 'DEBUG_QUEUE_STATUS',
        localQueueSize: this.localQueue.size,
        remoteQueueSize: this.remoteQueue.length,
        activeLobbies: this.activeLobbies.size,
        timestamp: Date.now()
      }));

    } catch (error) {
      console.error('❌ Alarm error:', error);
    } finally {
      // Reschedule
      const shouldReschedule = this.activeLobbies.size > 0 || this.localQueue.size > 0 || this.sessions.size > 0;
      if (shouldReschedule) {
        await this.state.storage.setAlarm(Date.now() + 1000);
      }
    }
  }

  broadcastMergedQueue() {
    const merged = this.getMergedQueue();
    const message = JSON.stringify({
      type: 'QUEUE_UPDATE',
      players: merged,
      count: merged.length
    });
    this.broadcastToAll(message);
  }

  getMergedQueue() {
    const localPlayers = Array.from(this.localQueue.values());
    const merged = [...this.remoteQueue];
    localPlayers.forEach(lp => {
      const inRemote = merged.find(rp => rp.id === lp.id || rp.discord_id === lp.id);
      if (!inRemote) merged.push(lp);
    });
    return merged;
  }

  async startMatch(players: QueuePlayer[]) {
    console.log("Starting Match with:", players.length, "players");

    // Select Captains
    const captain1 = players[0];
    const captain2 = players[1] || players[0];

    const teamA: QueuePlayer[] = [];
    const teamB: QueuePlayer[] = [];

    for (let i = 0; i < players.length; i++) {
      if (i % 2 === 0) teamA.push(players[i]);
      else teamB.push(players[i]);
    }

    const sortedPlayers = [...teamA, ...teamB];
    const lobbyId = crypto.randomUUID();

    const newLobby: Lobby = {
      id: lobbyId,
      players: sortedPlayers,
      captainA: captain1,
      captainB: captain2,
      teamA: teamA,
      teamB: teamB,
      readyPlayers: [],
      mapBanState: {
        bannedMaps: [],
        currentBanTeam: 'alpha',
        banHistory: [],
        selectedMap: undefined,
        mapBanPhase: true,
        lastBanTimestamp: undefined,
        currentTurnStartTimestamp: Date.now(),
        banTimeout: 15
      },
      readyPhaseState: {
        phaseActive: false,
        readyPlayers: [],
        readyPhaseStartTimestamp: undefined,
        readyPhaseTimeout: 30
      }
    };

    // Store in Active Lobbies
    this.activeLobbies.set(lobbyId, newLobby);

    // Map players to this lobby
    sortedPlayers.forEach(p => {
      if (p.id) this.playerLobbyMap.set(p.id, lobbyId);
      if (p.discord_id) this.playerLobbyMap.set(p.discord_id, lobbyId);
    });

    await this.saveMatchState();

    // Broadcast MATCH_READY to these players
    const message = JSON.stringify({
      type: 'MATCH_READY',
      lobbyId: newLobby.id,
      players: sortedPlayers,
      captains: [captain1, captain2]
    });

    this.broadcastToLobby(lobbyId, message);

    // Cleanup Local Queue
    sortedPlayers.forEach(p => {
      if (this.localQueue.has(p.id)) {
        this.localQueue.delete(p.id);
      }
    });
  }

  // Helper: Broadcast to specific lobby participants
  broadcastToLobby(lobbyId: string, message: string) {
    const lobby = this.activeLobbies.get(lobbyId);
    if (!lobby) return;

    lobby.players.forEach(p => {
      const socketKey = p.id || p.discord_id;
      if (socketKey && this.userSockets.has(socketKey)) {
        const ws = this.userSockets.get(socketKey);
        if (ws && ws.readyState === WebSocket.READY_STATE_OPEN) {
          ws.send(message);
        }
      }
    });

    // Debug: also log
    // console.log(`📢 Sent ${JSON.parse(message).type} to lobby ${lobbyId}`);
  }

  async broadcastLobbyUpdate(lobbyId?: string) {
    if (lobbyId) {
      const lobby = this.activeLobbies.get(lobbyId);
      if (lobby) {
        await this.saveMatchState();
        this.broadcastToLobby(lobbyId, JSON.stringify({
          type: 'LOBBY_UPDATE',
          lobby: lobby
        }));
      }
    } else {
      // Legacy or Global Update? 
      // Just update all lobbies
      for (const [id, _] of this.activeLobbies) {
        this.broadcastLobbyUpdate(id);
      }
    }
  }





  async syncWithNeatQueue() {
    if (!this.env.NEATQUEUE_API_KEY || !this.env.DISCORD_CHANNEL_ID) {
      // console.warn("NeatQueue env vars missing, skipping sync");
      return;
    }

    try {
      // Create a controller with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const apiKey = this.env.NEATQUEUE_API_KEY;
      if (!apiKey) {
        console.error("❌ NEATQUEUE_API_KEY is missing in env!");
        return;
      }

      // Log masked key to verify it's loaded correctly
      const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
      console.log(`🔍 Syncing with NeatQueue using key: ${maskedKey}`);

      const response = await fetch(
        `https://api.neatqueue.com/api/v1/queue/${this.env.DISCORD_CHANNEL_ID}/players`,
        {
          headers: {
            'Authorization': `${apiKey}`
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json() as any;
        this.remoteQueue = data.players || [];
      } else {
        console.error(`❌ NeatQueue API returned ${response.status}: ${await response.text()}`);
      }
    } catch (e) {
      console.error("❌ Failed to sync with NeatQueue:", e instanceof Error ? e.message : String(e));
    }
  }

  async handleSession(ws: WebSocket) {
    ws.accept();
    this.sessions.add(ws);

    // Initial load if needed
    if (!this.initialized) await this.loadMatchState();

    // Ensure alarm
    this.state.storage.getAlarm().then(currentAlarm => {
      if (!currentAlarm) this.state.storage.setAlarm(Date.now() + 1000);
    });

    let currentUserId: string | null = null;
    let currentUserData: any = null;

    ws.addEventListener('message', async (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string);

        // 1. REGISTER
        if (msg.type === 'REGISTER') {
          if (msg.userId) {
            currentUserId = msg.userId;
            currentUserData = {
              id: msg.userId,
              username: msg.username,
              avatar: msg.avatar,
              elo: msg.elo
            };
            this.userSockets.set(msg.userId, ws);
            ws.send(JSON.stringify({ type: 'REGISTER_ACK', userId: msg.userId }));

            // Check if in active lobby
            const lobbyId = this.playerLobbyMap.get(msg.userId);
            if (lobbyId) {
              const lobby = this.activeLobbies.get(lobbyId); // Using lobbyId from map
              if (lobby) {
                // Send existing state
                ws.send(JSON.stringify({
                  type: 'MATCH_READY',
                  lobbyId: lobby.id,
                  players: lobby.players,
                  captains: [lobby.captainA, lobby.captainB]
                }));
                ws.send(JSON.stringify({
                  type: 'LOBBY_UPDATE',
                  lobby: lobby
                }));
              } else {
                // Stale map entry?
                this.playerLobbyMap.delete(msg.userId);
                this.broadcastMergedQueue();
              }
            } else {
              this.broadcastMergedQueue();
            }
          }
        }

        // 2. JOIN_QUEUE
        if (msg.type === 'JOIN_QUEUE') {
          const userId = msg.userId || currentUserId;
          if (userId) {
            // Check if already in match
            if (this.playerLobbyMap.has(userId)) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Already in a match' }));
              return;
            }

            const user = {
              id: userId,
              username: msg.username || (currentUserData?.username ?? 'Unknown'),
              avatar: msg.avatar || currentUserData?.avatar,
              elo: msg.elo || currentUserData?.elo || 1000
            };
            this.localQueue.set(userId, user);
            this.syncWithNeatQueue();
            this.broadcastMergedQueue();
          }
        }

        // 3. LEAVE_QUEUE
        if (msg.type === 'LEAVE_QUEUE') {
          const userId = msg.userId || currentUserId;
          if (userId && this.localQueue.has(userId)) {
            this.localQueue.delete(userId);
            this.broadcastMergedQueue();
          }
        }

        // 4. BAN_MAP
        if (msg.type === 'BAN_MAP') {
          const userId = currentUserId;
          if (!userId) return;

          const lobbyId = this.playerLobbyMap.get(userId);
          const lobby = lobbyId ? this.activeLobbies.get(lobbyId) : null;

          if (lobby && lobby.mapBanState?.mapBanPhase) {
            const { map, team } = msg;
            const banState = lobby.mapBanState;

            // Security: Check Turn & Captain
            if (banState.currentBanTeam !== team) return; // Wrong turn

            const captain = banState.currentBanTeam === 'alpha' ? lobby.captainA : lobby.captainB;
            const isCaptain = (captain.id === userId || captain.discord_id === userId) || userId === 'discord-bot';

            if (!isCaptain) return; // Unauthorized

            // Apply Ban
            if (map && !banState.bannedMaps.includes(map)) {
              banState.bannedMaps.push(map);
              banState.banHistory.push({ team, map, timestamp: Date.now() });
              banState.lastBanTimestamp = Date.now();

              // Logic for End Phase
              const ALL_MAPS = ['Hanami', 'Rust', 'Zone 7', 'Dune', 'Breeze', 'Province', 'Sandstone'];
              if (banState.bannedMaps.length >= 6) {
                const remaining = ALL_MAPS.find(m => !banState.bannedMaps.includes(m));
                if (remaining) {
                  banState.selectedMap = remaining;
                  banState.mapBanPhase = false;

                  // Start Ready
                  lobby.readyPhaseState.phaseActive = true;
                  lobby.readyPhaseState.readyPhaseStartTimestamp = Date.now();
                  lobby.readyPhaseState.readyPhaseTimeout = 30;

                  // Notify
                  this.broadcastToLobby(lobby.id, JSON.stringify({
                    type: 'READY_PHASE_STARTED',
                    lobbyId: lobby.id,
                    selectedMap: remaining,
                    readyPhaseTimeout: 30
                  }));
                }
              } else {
                // Switch Turn
                banState.currentBanTeam = banState.currentBanTeam === 'alpha' ? 'bravo' : 'alpha';
                banState.currentTurnStartTimestamp = Date.now();
              }
              await this.broadcastLobbyUpdate(lobby.id);
            }
          }
        }

        // 5. PLAYER_READY
        if (msg.type === 'PLAYER_READY') {
          const userId = msg.userId || currentUserId;
          if (!userId) return;

          const lobbyId = this.playerLobbyMap.get(userId);
          const lobby = lobbyId ? this.activeLobbies.get(lobbyId) : null;

          if (lobby && lobby.readyPhaseState.phaseActive) {
            if (!lobby.readyPhaseState.readyPlayers.includes(userId)) {
              lobby.readyPhaseState.readyPlayers.push(userId);

              const allReady = lobby.readyPhaseState.readyPlayers.length >= lobby.players.length;
              if (allReady) {
                lobby.readyPhaseState.phaseActive = false; // Phase done
                // Match Proceed
                this.broadcastToLobby(lobby.id, JSON.stringify({
                  type: 'ALL_PLAYERS_READY',
                  lobbyId: lobby.id
                }));

                // Trigger Bot
                const botWs = this.userSockets.get('discord-bot');
                if (botWs) {
                  botWs.send(JSON.stringify({
                    type: 'CREATE_MATCH',
                    lobbyId: lobby.id,
                    matchData: { ...lobby, map: lobby.mapBanState?.selectedMap }
                  }));
                }
              }
              await this.broadcastLobbyUpdate(lobby.id);
            }
          }
        }

        // 6. REQUEST_MATCH_STATE
        if (msg.type === 'REQUEST_MATCH_STATE') {
          const requestedLobbyId = msg.lobbyId;
          const lobby = this.activeLobbies.get(requestedLobbyId);
          if (lobby) {
            // Return state
            ws.send(JSON.stringify({
              type: 'LOBBY_UPDATE',
              lobby: lobby
            }));
          }
        }

        // 7. LEAVE_MATCH
        if (msg.type === 'LEAVE_MATCH') {
          const userId = msg.userId || currentUserId;
          const lobbyId = msg.lobbyId;

          if (userId && lobbyId) {
            const lobby = this.activeLobbies.get(lobbyId); // Using provided lobbyId
            if (lobby) {
              // Check if user is in this lobby
              const pIndex = lobby.players.findIndex(p => p.id === userId || p.discord_id === userId);
              if (pIndex !== -1) {
                // Remove from main list
                lobby.players.splice(pIndex, 1);

                // Remove from Teams
                const tA = lobby.teamA.findIndex(p => p.id === userId || p.discord_id === userId);
                if (tA !== -1) lobby.teamA.splice(tA, 1);

                const tB = lobby.teamB.findIndex(p => p.id === userId || p.discord_id === userId);
                if (tB !== -1) lobby.teamB.splice(tB, 1);

                // Remove from Ready
                const rIdx = lobby.readyPhaseState.readyPlayers.indexOf(userId);
                if (rIdx !== -1) lobby.readyPhaseState.readyPlayers.splice(rIdx, 1);

                // Remove from map registration
                this.playerLobbyMap.delete(userId);

                console.log(`Player ${userId} left lobby ${lobbyId}`);

                // If empty, delete lobby
                if (lobby.players.length === 0) {
                  this.activeLobbies.delete(lobbyId);
                  console.log(`Lobby ${lobbyId} is empty and deleted.`);
                } else {
                  await this.broadcastLobbyUpdate(lobbyId);
                }

                await this.saveMatchState();

                ws.send(JSON.stringify({
                  type: 'LEAVE_MATCH_SUCCESS',
                  lobbyId: lobbyId
                }));
              }
            } else {
              // Lobby not found? Maybe already deleted.
              // Clean up map just in case
              this.playerLobbyMap.delete(userId);
              ws.send(JSON.stringify({ type: 'LEAVE_MATCH_SUCCESS' }));
            }
          }
        }

        // 8. RESET_MATCH (Admin)
        if (msg.type === 'RESET_MATCH') {
          console.log("⚠️ RESET_MATCH: Clearing all lobbies.");
          this.activeLobbies.clear();
          this.playerLobbyMap.clear();
          await this.saveMatchState();
          this.broadcastToAll(JSON.stringify({ type: 'MATCH_RESET' }));
          this.broadcastMergedQueue();
        }

        // 9. FILL_BOTS (Debug)
        if (msg.type === 'FILL_BOTS') {
          // Ensure we are not already in a match?
          // With multi-lobby, checking 'this.matchState' is obsolete.
          // We just check if user is in a match?
          // The button was removed, but if triggered via WS manually:
          const merged = this.getMergedQueue();
          const needed = 10 - merged.length;
          if (needed > 0) {
            const bots = [];
            for (let i = 0; i < needed; i++) {
              bots.push({ id: `bot_${i}`, username: `Bot ${i}`, elo: 1000 }); // simplified
            }
            const all = [...merged, ...bots].slice(0, 10);
            this.startMatch(all);
          }
        }

        // 10. REQUEST_LEADERBOARD
        if (msg.type === 'REQUEST_LEADERBOARD') {
          try {
            // Fetch leaderboard from database
            const result = await this.env.DB.prepare(
              'SELECT * FROM players ORDER BY mmr DESC LIMIT 500'
            ).all();

            const leaderboard = (result.results || []).map((player: any, index: number) => ({
              rank: index + 1,
              id: player.id,
              discord_id: player.discord_id,
              username: player.discord_username,
              avatar: player.discord_avatar,
              nickname: player.standoff_nickname,
              elo: player.mmr,
              wins: player.wins,
              losses: player.losses,
            }));

            // Send leaderboard to requesting client
            ws.send(JSON.stringify({
              type: 'LEADERBOARD_UPDATE',
              data: leaderboard
            }));
          } catch (error) {
            console.error('Error fetching leaderboard:', error);
            ws.send(JSON.stringify({
              type: 'ERROR',
              message: 'Failed to fetch leaderboard'
            }));
          }
        }

      } catch (err) {
        console.error('WS Message Error:', err);
      }
    });

    ws.addEventListener('close', () => {
      this.sessions.delete(ws);
      if (currentUserId) this.userSockets.delete(currentUserId);
    });
  }

}

// 2. Hono API
const app = new Hono<{
  Bindings: {
    DB: D1Database,
    MATCH_QUEUE: DurableObjectNamespace,
    DISCORD_CLIENT_ID: string,
    DISCORD_CLIENT_SECRET: string,
    DISCORD_REDIRECT_URI: string,
    NEATQUEUE_API_KEY: string,
    DISCORD_SERVER_ID: string,
    DISCORD_CHANNEL_ID: string,
    DISCORD_BOT_TOKEN: string,
    FRONTEND_URL: string
  }
}>();

// CORS-ийг идэвхжүүлэх
app.use('/*', cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://standoff-frontend.pages.dev',
    'https://main.standoff-frontend.pages.dev',
    'https://a0ab2f80.standoff-frontend.pages.dev'
  ],
  credentials: true,
}));

// Setup routes
setupProfileRoutes(app);
setupLeaderboardRoutes(app);
setupAdminRoutes(app);
setupFriendsRoutes(app);

app.get('/', (c) => c.text('Standoff 2 Platform API is Online!'));

// Debug endpoint to check environment variables (remove in production)
app.get('/api/debug/env', async (c) => {
  return c.json({
    hasClientId: !!c.env.DISCORD_CLIENT_ID,
    hasClientSecret: !!c.env.DISCORD_CLIENT_SECRET,
    hasRedirectUri: !!c.env.DISCORD_REDIRECT_URI,
    redirectUri: c.env.DISCORD_REDIRECT_URI || 'NOT SET',
    clientId: c.env.DISCORD_CLIENT_ID || 'NOT SET'
  });
});

// Discord OAuth2 Callback
app.get('/api/auth/callback', async (c) => {
  const code = c.req.query('code');

  if (!code) {
    return c.text("Code not found", 400);
  }

  // Validate environment variables
  const clientId = c.env.DISCORD_CLIENT_ID;
  const clientSecret = c.env.DISCORD_CLIENT_SECRET;
  const redirectUri = c.env.DISCORD_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error('Missing Discord environment variables:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRedirectUri: !!redirectUri
    });
    return c.json({
      error: "Server configuration error",
      message: "Discord OAuth credentials are not configured properly"
    }, 500);
  }

  try {
    // 1. Кодоо "Access Token" болгож солих
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
    });

    const tokens = await tokenResponse.json() as any;

    if (!tokens.access_token) {
      console.error('Discord Token Error:', tokens);
      return c.json({
        error: "Failed to get access token",
        details: tokens,
        sent_redirect_uri: redirectUri
      }, 400);
    }

    // 2. Access Token ашиглан хэрэглэгчийн мэдээллийг авах
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`
      },
    });

    const userData = await userResponse.json() as any;

    // 3. Хэрэглэгчийг Database-д хадгалах bolon info avah
    let player: any = null;
    try {
      await c.env.DB.prepare(
        `INSERT INTO players (id, discord_id, discord_username, discord_avatar) 
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
         discord_username = excluded.discord_username,
         discord_avatar = excluded.discord_avatar`
      ).bind(
        userData.id,
        userData.id,
        userData.username,
        userData.avatar
      ).run();

      const { results } = await c.env.DB.prepare(
        `SELECT role, elo FROM players WHERE id = ?`
      ).bind(userData.id).all();

      if (results && results.length > 0) {
        player = results[0];
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
    }

    // 4. Хэрэглэгчийг Frontend рүү нь буцаах
    const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173';
    const role = player?.role || 'user';
    const elo = player?.elo || 1000;

    return c.redirect(
      `${frontendUrl}?id=${userData.id}&username=${userData.username}&avatar=${userData.avatar || ''}&role=${role}&elo=${elo}`
    );
  } catch (error) {
    console.error('Auth error:', error);
    return c.text("Authentication failed", 500);
  }
});





// Get Live Queue Status - Дараалалд байгаа тоглогчдын тоо
app.get('/api/queue-status', async (c) => {
  try {
    const CHANNEL_ID = c.env.DISCORD_CHANNEL_ID || '';

    const response = await fetch(
      `https://api.neatqueue.com/api/v1/queue/${CHANNEL_ID}/players`,
      {
        headers: {
          'Authorization': `${c.env.NEATQUEUE_API_KEY}`
        }
      }
    );

    if (response.ok) {
      const data = await response.json() as any;
      return c.json({
        success: true,
        queueCount: data.length || 0,
        players: data || []
      });
    } else {
      return c.json({ success: false, queueCount: 0, players: [] }, 400);
    }
  } catch (error) {
    console.error('Queue status error:', error);
    return c.json({ success: false, queueCount: 0, players: [] }, 500);
  }
});



// Get Player Stats - Тоглогчийн статистик
app.get('/api/player-stats/:playerId', async (c) => {
  try {
    const playerId = c.req.param('playerId');
    const SERVER_ID = c.env.DISCORD_SERVER_ID || '';

    const response = await fetch(
      `https://api.neatqueue.com/api/v1/playerstats/${SERVER_ID}/${playerId}`,
      {
        headers: {
          'Authorization': `${c.env.NEATQUEUE_API_KEY}`
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      return c.json({
        success: true,
        stats: data
      });
    } else {
      return c.json({ success: false, stats: null }, 404);
    }
  } catch (error) {
    console.error('Player stats error:', error);
    return c.json({ success: false, stats: null }, 500);
  }
});


// Debug Route
app.get('/api/debug/queue', async (c) => {
  const id = c.env.MATCH_QUEUE.idFromName('global-matchmaking-v2');
  const obj = c.env.MATCH_QUEUE.get(id);
  // We can't call methods directly on the Stub in Hono without RPC or fetching specific URL
  // So we'll fetch the DO with a special path
  return obj.fetch(new Request('http://do/debug', c.req.raw));
});

app.get('/ws', async (c) => {
  const id = c.env.MATCH_QUEUE.idFromName('global-matchmaking-v2');
  const obj = c.env.MATCH_QUEUE.get(id);
  return obj.fetch(c.req.raw);
});

// API endpoint for Discord bot to send server info
app.post('/api/match/server-info', async (c) => {
  try {
    const id = c.env.MATCH_QUEUE.idFromName('global-matchmaking-v2');
    const obj = c.env.MATCH_QUEUE.get(id);

    // Create a new request to the Durable Object's server-info endpoint
    const doUrl = new URL(c.req.raw.url);
    doUrl.pathname = '/server-info';
    const doRequest = new Request(doUrl.toString(), {
      method: 'POST',
      headers: c.req.raw.headers,
      body: c.req.raw.body
    });

    return obj.fetch(doRequest);
  } catch (error: any) {
    console.error('Error forwarding server info to Durable Object:', error);
    return c.json({
      success: false,
      error: error.message || 'Internal server error'
    }, 500);
  }
});

// NeatQueue Webhook Handler
app.route('/api/neatqueue', neatqueueWebhook);

export default {
  fetch: app.fetch,
  MatchQueueDO
};
