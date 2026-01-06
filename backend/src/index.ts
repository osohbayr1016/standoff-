import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logToDatadog } from './utils/logger';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { players } from './db/schema';
import { nicknameSchema, updateProfileSchema } from './schemas/profile';
import { setupProfileRoutes } from './routes/profile';
import { setupLeaderboardRoutes } from './routes/leaderboard';
import { setupAdminRoutes } from './routes/admin';
import { setupFriendsRoutes } from './routes/friends';
import { setupStatsRoutes } from './routes/stats';
import { matchesRoutes } from './routes/matches';
import { moderatorRoutes } from './routes/moderator';
import { uploadRoutes } from './routes/upload';
import { lobbyInviteRoutes } from './routes/lobby-invites';
import { vipRequestsRoutes } from './routes/vip-requests';
import { streamerRoutes } from './routes/streamers';
import { clanRoutes } from './routes/clans';
import { clanRequestsRoutes } from './routes/clan-requests';
import goldRoutes from './routes/gold';
import rewardsRoutes from './routes/rewards';
import { syncDiscordMembers } from './utils/sync';
import { updateDiscordRole, TIERS, sendDiscordMessage } from './utils/discord';
import { checkStaleMatches } from './tasks/match-reminder';


// ============= Type Definitions =============
interface QueuePlayer {
  id: string;
  discord_id?: string;
  username: string;
  name?: string;
  avatar?: string | null;
  elo?: number;
  // Extended properties for match/lobby
  team?: 'alpha' | 'bravo';
  player_id?: string;
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

interface DraftState {
  isActive: boolean;
  pool: QueuePlayer[];
  currentTurn: 'captainA' | 'captainB';
  pickOrder: ('captainA' | 'captainB')[]; // Snake: A, B, B, A, A, B, B, A
  pickHistory: { pickerId: string; pickedId: string }[];
  draftTimeout: number;
  lastPickTimestamp: number;
}

interface Lobby {
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
}

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  avatar?: string;
  content: string;
  timestamp: number;
  lobbyId?: string; // Optional, present for lobby-specific chat
  type?: 'user' | 'system';
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
  MODERATOR_ROLE_ID?: string;
  NEATQUEUE_API_KEY?: string;
  DISCORD_BOT_TOKEN?: string;
  NEATQUEUE_WEBHOOK_SECRET?: string;
  ADMIN_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  DD_API_KEY?: string;
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
  activeLobbies: Map<string, Lobby> = new Map();
  playerLobbyMap: Map<string, string> = new Map(); // UserId -> LobbyId
  chatHistory: ChatMessage[] = []; // Global chat history
  lobbyChatHistory: Map<string, ChatMessage[]> = new Map(); // LobbyId -> ChatMessage[]

  // High-performance update tracking
  lastBroadcastData: string = '';
  lastQueueBroadcast: string = '';



  constructor(public state: DurableObjectState, public env: Env) {
    this.state.blockConcurrencyWhile(async () => {
      await this.loadMatchState();
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

      // Handle LOBBY_ACTION relay from Hono routes
      if (body.type === 'START_DRAFT') {
        const { matchId, captainAlpha, captainBravo, players } = body.data;
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
          } as any;
          this.activeLobbies.set(matchId, lobby!);
        }

        if (lobby) {


          const pool = players.filter((p: any) =>
            p.id !== captainAlpha.player_id &&
            p.discord_id !== captainAlpha.player_id &&
            p.id !== captainBravo.player_id &&
            p.discord_id !== captainBravo.player_id
          ).map((p: any) => ({ ...p, id: p.player_id || p.id })); // Ensure ID normalization

          lobby.status = 'drafting';
          lobby.captainA = captainAlpha;
          lobby.captainB = captainBravo;

          // CRITICAL: Ensure other phases are disabled to prevent Alarm from cancelling
          if (lobby.readyPhaseState) lobby.readyPhaseState.phaseActive = false;


          lobby.captainA = captainAlpha;
          lobby.captainB = captainBravo;
          // Explicit IDs for frontend
          (lobby as any).captain_alpha_id = captainAlpha.player_id || captainAlpha.id;
          (lobby as any).captain_bravo_id = captainBravo.player_id || captainBravo.id;

          lobby.teamA = [captainAlpha];
          lobby.teamB = [captainBravo];

          lobby.draftState = {
            isActive: true,
            pool: pool,
            currentTurn: 'captainA',
            pickOrder: ['captainA', 'captainB', 'captainB', 'captainA', 'captainA', 'captainB', 'captainB', 'captainA'],
            pickHistory: [],
            draftTimeout: 15,
            lastPickTimestamp: Date.now()
          };

          await this.saveMatchState();

          this.broadcastToLobby(matchId, JSON.stringify({
            type: 'DRAFT_START',
            lobbyId: matchId,
            draftState: lobby.draftState,
            captainA: lobby.captainA,
            captainB: lobby.captainB,
            captainAlphaId: (lobby as any).captain_alpha_id,
            captainBravoId: (lobby as any).captain_bravo_id
          }));

          // Trigger Bot/Auto Pick if First Captain is Bot
          this.executeAutoPick(matchId, true).catch(console.error);
        }
      }

      if (body.type === 'LOBBY_ACTION') {
        const { userIds, type, matchId, players, ...msgData } = body.data;

        // Sync manual lobby state to DO for chat/real-time support
        if (matchId && players) {
          const existingLobby = this.activeLobbies.get(matchId);

          if (existingLobby) {
            // MERGE UPDATE
            // Update player list, status, team/captain mapping if provided
            // Careful not to wipe draftState or mapBanState
            existingLobby.players = players;
            if (msgData.status) existingLobby.status = msgData.status;
            if (msgData.teamA) existingLobby.teamA = msgData.teamA;
            if (msgData.teamB) existingLobby.teamB = msgData.teamB;
            // Ensure captains are updated if players changed? 
            // Usually LOBBY_ACTION comes from join/leave which might shift captain if captain left.
            // But for Immortal, captain is fixed.

            console.log(`📌 Updated existing lobby ${matchId} (DraftState: ${!!existingLobby.draftState})`);
          } else {
            // CREATE NEW (Minimal)
            this.activeLobbies.set(matchId, {
              id: matchId,
              players: players,
              captainA: players[0],
              captainB: players[1] || players[0],
              teamA: players.filter((p: any) => p.team === 'alpha'),
              teamB: players.filter((p: any) => p.team === 'bravo'),
              readyPlayers: [],
              mapBanState: { bannedMaps: [], currentBanTeam: 'alpha', banHistory: [], mapBanPhase: false, banTimeout: 15 },
              readyPhaseState: { phaseActive: false, readyPlayers: [], readyPhaseTimeout: 30 },
              matchType: msgData.matchType,
              status: msgData.status,
              startedAt: msgData.startedAt
            } as any);
            console.log(`📌 Synced NEW manual lobby ${matchId} with ${players.length} players`);
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

  // Legacy/Global state (Removed/Deprecated)
  // matchState: 'IDLE' | 'LOBBY' | 'GAME' = 'IDLE'; 
  // currentLobby: Lobby | null = null;

  readyPhaseTimer: ReturnType<typeof setTimeout> | null = null;
  initialized: boolean = false; // Track if we've loaded from storage

  // Load match state from storage
  // Load match state from storage
  async loadMatchState() {
    try {
      // 1. Load Player Map
      const playerMap = await this.state.storage.get<[string, string][]>('playerMap_v2');
      if (playerMap) {
        this.playerLobbyMap = new Map(playerMap);
      }

      // 2. Load Lobbies Individually (Sharding)
      const lobbyList = await this.state.storage.list<Lobby>({ prefix: 'lobby_' });
      this.activeLobbies = new Map();

      if (lobbyList.size > 0) {
        for (const [key, lobby] of lobbyList) {
          if (lobby && lobby.id) {
            this.activeLobbies.set(lobby.id, lobby);
          }
        }
        console.log(`✅ Loaded ${this.activeLobbies.size} active lobbies from storage (Sharded).`);
      } else {
        // FALLBACK / MIGRATION: Check for legacy monolithic state matching `matchState_v2`
        // This attempts to recover matches that were hidden by the update.
        try {
          const legacyState = await this.state.storage.get<{ lobbies: [string, Lobby][] }>('matchState_v2');
          if (legacyState && legacyState.lobbies && legacyState.lobbies.length > 0) {
            console.log(`⚠️ Found legacy match state with ${legacyState.lobbies.length} lobbies. Migrating...`);
            this.activeLobbies = new Map(legacyState.lobbies);

            // Immediately save in new format
            await this.saveMatchState();

            // Optional: Delete legacy key after successful migration to freeing space
            // await this.state.storage.delete('matchState_v2');
            console.log(`✅ Migration complete. Recovered ${this.activeLobbies.size} lobbies.`);
          }
        } catch (migErr) {
          console.error('❌ Migration failed (likely too large):', migErr);
        }
      }

      // Legacy cleanup (optional: remove old monolithic key if exists)
      // await this.state.storage.delete('matchState_v2'); 

    } catch (error) {
      console.error('❌ Error loading match state:', error);
    }
    this.initialized = true;
  }

  // Save match state to storage
  async saveMatchState() {
    try {
      // 1. Save Player Map (This is still small-ish, map of IDs)
      // If this gets too big, we might need to shard it too, but for 1000 users it's <100KB (1000 * 64 bytes = 64KB)
      await this.state.storage.put('playerMap_v2', Array.from(this.playerLobbyMap.entries()));

      // 2. Save Lobbies Individually
      // We use put() for each lobby. 
      // Optimization: Only save modified lobbies? For now, simpler to save all active ones, 
      // but 'put' supports multiple entries. 
      // LIMIT: 128KB per value. 'put' args: { key: value, ... }

      const storageObject: Record<string, Lobby> = {};

      // We need to handle excessive put size (total payload limit).
      // Durable Object put() takes an object. 
      // If we put 10 lobbies, and they are huge, the total transaction might trigger a limit?
      // DO transaction limit is fairly high using `storage.put({ ... })`.
      // But let's be safe: save critical lobbies.

      for (const [id, lobby] of this.activeLobbies) {
        storageObject[`lobby_${id}`] = lobby;
      }

      if (Object.keys(storageObject).length > 0) {
        await this.state.storage.put(storageObject);
      }

      // 3. Handle Deletions?
      // If a lobby is removed from this.activeLobbies, we must DELETE it from storage.
      // We need to track what is currently in storage vs active.
      // Simplified: We list all 'lobby_' keys, and if they are not in activeLobbies, delete them.

      // This "Diff" logic is expensive. 
      // Better approach: When we delete from activeLobbies, we delete from storage explicitly.
      // See: deleteLobby() helper (TODO: implement and use in alarm/leave/cancel)

      console.log(`💾 Saved state: ${this.activeLobbies.size} lobbies.`);

    } catch (error) {
      console.error('❌ Error saving match state:', error);
    }
  }

  // Helper to delete a lobby from storage
  async deleteLobbyFromStorage(lobbyId: string) {
    await this.state.storage.delete(`lobby_${lobbyId}`);
  }

  async alarm() {
    try {
      console.log('⏰ Alarm firing...');

      // Load state from storage if not initialized
      if (!this.initialized) {
        await this.loadMatchState();
      }

      // Process lobby updates (no more auto-matchmaking)
      const merged = this.getMergedQueue();

      // Note: Auto-matchmaking removed - using manual lobby system
      // Old logic that started match when 10 players queued is removed

      // 2. LOBBY TIMEOUT CHECKS
      for (const [lobbyId, lobby] of this.activeLobbies) {
        try {


          // C. DRAFT PHASE TIMEOUT
          // C. DRAFT PHASE TIMEOUT
          const draftState = lobby.draftState;
          const readyState = lobby.readyPhaseState;

          if (draftState?.isActive) {
            const lastActivity = draftState.lastPickTimestamp || Date.now();
            const elapsed = (Date.now() - lastActivity) / 1000;

            if (elapsed > (draftState.draftTimeout + 0.5)) { // +0.5s buffer
              console.log(`⏰ [${lobbyId}] Draft timeout. Auto-picking...`);
              await this.executeAutoPick(lobbyId, false); // false = triggered by timeout
            }
          }

          // B. READY PHASE
          if (readyState?.phaseActive) {
            const startTimestamp = readyState.readyPhaseStartTimestamp || Date.now();
            const elapsed = (Date.now() - startTimestamp) / 1000;
            const playerCount = lobby.players.length;
            const readyCount = readyState.readyPlayers.length;

            // Failsafe: If everyone is ready but match didn't start (rare race condition)
            if (readyCount >= playerCount && playerCount > 0) {
              console.log(`⚠️ [${lobbyId}] All players ready but match didn't start. Forcing start...`);

              // Reuse logic from handleServerInfo/handlePlayerReady or mostly just assume create match was sent?
              // Ideally we call a helper. For now, let's just ensure we don't time out.
              // Actually, if we are here, it means SERVER_READY/MATCH_START wasn't triggered.
              // We should trigger the specific logic if possible, or just log for now to see if this is the case.

              // If we have server info, broadcast MATCH_START
              if (lobby.serverInfo?.matchLink) {
                this.broadcastToLobby(lobbyId, JSON.stringify({
                  type: 'MATCH_START',
                  lobbyId: lobby.id,
                  selectedMap: "Sandstone",
                  matchData: lobby,
                  serverInfo: lobby.serverInfo
                }));
              }
            }

            // Timeout Check
            const timeoutLimit = readyState.readyPhaseTimeout || 30;
            if (elapsed > timeoutLimit && readyCount < playerCount) {
              console.log(`⏰ [${lobbyId}] Ready timeout (${elapsed.toFixed(1)}s > ${timeoutLimit}s). Cancelling.`);

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
              console.log(`🗑️ [${lobbyId}] Lobby deleted due to timeout.`);
            }
          }


          // C. CASUAL MATCH AUTO-DELETE (15 Minutes)
          // C. CASUAL MATCH AUTO-DELETE (15 Minutes)
          // STRICT CHECK: Only if matchType is explicitly casual
          if (lobby.matchType === 'casual' && lobby.status === 'in_progress' && lobby.startedAt) {
            const elapsed = (Date.now() - lobby.startedAt) / 1000;
            const timeout = 15 * 60; // 15 minutes

            if (elapsed > timeout) {
              console.log(`⏰ [${lobbyId}] Casual match timeout (${elapsed.toFixed(1)}s > ${timeout}s). Cancelling...`);

              // 1. Update DB (Soft Delete/Cancel)
              try {
                await this.env.DB.prepare(
                  "UPDATE matches SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?"
                ).bind(lobbyId).run();
              } catch (dbErr) {
                console.error(`❌ [${lobbyId}] Failed to update DB on timeout:`, dbErr);
              }

              // 2. Notify Clients
              this.broadcastToLobby(lobbyId, JSON.stringify({
                type: 'MATCH_CANCELLED',
                reason: 'Match time expired (15 minutes)'
              }));

              // 3. Clean up Memory
              this.activeLobbies.delete(lobbyId);
              await this.deleteLobbyFromStorage(lobbyId); // Clean from storage
              lobby.players.forEach(p => {
                const pid = p.id || p.discord_id;
                if (pid) this.playerLobbyMap.delete(pid);
              });

              console.log(`🗑️ [${lobbyId}] Casual match deleted due to 10m timeout.`);
            }
          }
        } catch (err) {
          console.error(`❌ Error in lobby loop ${lobbyId}:`, err);
        }
      }

      // 3. BROADCAST QUEUE STATUS
      const currentQueueData = JSON.stringify({
        local: Array.from(this.localQueue.values()),
        remote: this.remoteQueue
      });

      if (currentQueueData !== this.lastQueueBroadcast) {
        this.broadcastMergedQueue();
        this.lastQueueBroadcast = currentQueueData;
      }

      const currentDebugData = JSON.stringify({
        type: 'DEBUG_QUEUE_STATUS',
        localQueueSize: this.localQueue.size,
        remoteQueueSize: this.remoteQueue.length,
        activeLobbies: this.activeLobbies.size,
        timestamp: Math.floor(Date.now() / 1000) // Lower precision to avoid jitter
      });

      if (currentDebugData !== this.lastBroadcastData) {
        this.broadcastToAll(currentDebugData);
        this.lastBroadcastData = currentDebugData;
      }

    } catch (error) {
      console.error('❌ Alarm error:', error);
    } finally {
      // Reschedule - THROTTLED to 3 seconds for general status updates
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
    // Collect all players currently in active lobbies
    const activePlayerIds = new Set<string>();
    for (const lobby of this.activeLobbies.values()) {
      lobby.players.forEach(p => {
        if (p.id) activePlayerIds.add(p.id);
        if (p.discord_id) activePlayerIds.add(p.discord_id);
        if ((p as any).player_id) activePlayerIds.add((p as any).player_id);
      });
    }

    const localPlayers = Array.from(this.localQueue.values());
    const merged = [...this.remoteQueue];
    localPlayers.forEach(lp => {
      const inRemote = merged.find(rp => rp.id === lp.id || rp.discord_id === lp.id);
      if (!inRemote) merged.push(lp);
    });

    // Filter out players who are playing
    return merged.filter(p => {
      const id = p.id || p.discord_id || '';
      return id && !activePlayerIds.has(id);
    });
  }

  async startMatch(players: QueuePlayer[]) {
    console.log("Starting Match with:", players.length, "players");

    // 1. Sort by Elo (Descending) for Balance
    players.sort((a, b) => (b.elo || 1000) - (a.elo || 1000));

    // 2. Select Captains (Top 2 Players)
    const captain1 = players[0];
    const captain2 = players[1] || players[0]; // Fallback if 1 player (debug)

    // 3. Draft or Default Logic
    // Snake Draft (ABBA) Distribution if League/Comp
    const isDraftMode = players.length === 10; // Only draft 5v5 for now? Or check matchType if passed. 
    // Wait, startMatch doesn't receive matchType yet. Assuming all 10-player queues are competitive for now or defaulting.
    // For now, let's enable draft for ALL 10-player matches to test feature, or based on queue logic.
    // Given user request "league and competetive matches", let's assume we want this flow.

    // Logic: If plain match, do random. If draft, init draft.
    // Let's force Draft for testing as user requested "do it".

    const teamA: QueuePlayer[] = [captain1];
    const teamB: QueuePlayer[] = [captain2];
    const pool = players.filter(p => p.id !== captain1.id && p.id !== captain2.id); // Remaining 8

    let draftState: DraftState | undefined;
    let status = 'map_ban'; // Default unless draft

    if (true) { // Force Draft for now
      status = 'drafting';
      draftState = {
        isActive: true,
        pool: pool,
        currentTurn: 'captainA', // A picks 1st
        // Snake: A(1), B(2), B(3), A(4), A(5), B(6), B(7), A(8) -> Indices 0..7
        pickOrder: ['captainA', 'captainB', 'captainB', 'captainA', 'captainA', 'captainB', 'captainB', 'captainA'],
        pickHistory: [],
        draftTimeout: 15,
        lastPickTimestamp: Date.now()
      };

      // Kickstart Alarm
      this.state.storage.setAlarm(Date.now() + 1000);
      // Clear team arrays except captains (already there)
    } else {
      // ... Old Snake Logic ...
    }

    const lobbyId = crypto.randomUUID();
    const sortedPlayers = players; // Alias for compatibility with existing code

    const newLobby: Lobby = {
      id: lobbyId,
      players: players,
      captainA: captain1,
      captainB: captain2,
      teamA: teamA,
      teamB: teamB,
      readyPlayers: [],
      draftState: draftState,
      status: status,

      readyPhaseState: {
        phaseActive: false,
        readyPlayers: [],
        readyPhaseStartTimestamp: undefined,

        readyPhaseTimeout: 30
      },
      matchType: 'league' // Default to league for drafted matches to enable result submission
    };

    // CLEANUP: Force cancel any existing active matches for this host to prevent "Zombie" matches
    try {
      const zombieResult = await this.env.DB.prepare(`
        UPDATE matches 
        SET status = 'cancelled', updated_at = datetime('now') 
        WHERE host_id = ? AND status IN ('waiting', 'drafting', 'in_progress')
      `).bind(captain1.id).run();

      if (zombieResult.meta.changes > 0) {
        console.warn(`⚠️ [startMatch] Force-cancelled ${zombieResult.meta.changes} zombie matches for host ${captain1.id}`);
      }
    } catch (e) {
      console.error('Failed to cleanup zombie matches', e);
    }

    // Persist to D1 Database (CRITICAL: Moderator Panel queries this)
    try {
      await this.env.DB.prepare(`
        INSERT INTO matches (
          id, host_id, lobby_url, map_name, status, match_type, max_players,
          captain_alpha_id, captain_bravo_id, alpha_avg_elo, bravo_avg_elo, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        lobbyId,
        captain1.id,
        'standoff2://lobby/drafted', // Placeholder
        'Sandstone', // Default map
        status, // 'drafting'
        'league',
        10,
        captain1.id,
        captain2.id,
        Math.floor(teamA.reduce((sum, p) => sum + (p.elo || 1000), 0) / Math.max(1, teamA.length)),
        Math.floor(teamB.reduce((sum, p) => sum + (p.elo || 1000), 0) / Math.max(1, teamB.length))
      ).run();

      // Insert initial players (captains) into match_players
      const playerStmt = this.env.DB.prepare(`
        INSERT INTO match_players (id, match_id, player_id, team, role, elo, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      await this.env.DB.batch([
        playerStmt.bind(crypto.randomUUID(), lobbyId, captain1.id, 'alpha', 'captain', captain1.elo || 1000),
        playerStmt.bind(crypto.randomUUID(), lobbyId, captain2.id, 'bravo', 'captain', captain2.elo || 1000)
      ]);

      console.log(`✅ [${lobbyId}] Persisted drafted match to D1`);
    } catch (e) {
      console.error('Failed to persist drafted match to D1:', e);
    }

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

    // Notify Discord Bot to Sync NeatQueue (Clear Queue)
    const botWs = this.userSockets.get('discord-bot');
    if (botWs && botWs.readyState === WebSocket.READY_STATE_OPEN) {
      botWs.send(JSON.stringify({
        type: 'CREATE_MATCH',
        matchData: {
          lobbyId: newLobby.id,
          players: sortedPlayers
        }
      }));
    }

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
      // Handle both raw player objects and match_players joined objects
      // match_players join returns { player_id: ... } but p.id might be row ID
      const socketKey = (p as any).player_id || p.id || p.discord_id;

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
          lobby: lobby,
          serverTime: Date.now()
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





  // NeatQueue sync removed - using manual lobby system now

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
                // Send chat history
                ws.send(JSON.stringify({
                  type: 'LOBBY_CHAT_HISTORY',
                  lobbyId: lobby.id,
                  messages: this.lobbyChatHistory.get(lobbyId) || []
                }));
              } else {
                // Stale map entry?
                this.playerLobbyMap.delete(msg.userId);
                this.broadcastMergedQueue();
              }
            } else {
              // Send global chat history
              ws.send(JSON.stringify({
                type: 'CHAT_HISTORY',
                messages: this.chatHistory
              }));
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

            // CRITICAL: Validate User exists in DB (Session Validity Check)
            try {
              const dbUser = await this.env.DB.prepare('SELECT id, banned FROM players WHERE id = ?').bind(userId).first();
              if (!dbUser) {
                ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Session invalid/expired. Please login again.' }));
                return;
              }
              // Check if user is banned
              if (dbUser.banned === 1) {
                ws.send(JSON.stringify({ type: 'BANNED', message: 'You are banned from matchmaking.' }));
                return;
              }
            } catch (e) {
              console.error('DB Check Error:', e);
              // Proceed cautiously or fail open? Fail closed for safety.
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Database error validating session' }));
              return;
            }

            const user = {
              id: userId,
              username: msg.username || (currentUserData?.username ?? 'Unknown'),
              avatar: msg.avatar || currentUserData?.avatar,
              elo: msg.elo || currentUserData?.elo || 1000
            };
            this.localQueue.set(userId, user);
            // NeatQueue sync removed
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
                    matchData: { ...lobby, map: "Sandstone" }
                  }));
                }
              }
              await this.broadcastLobbyUpdate(lobby.id);
            }
          }
        }

        // 6. REQUEST_MATCH_STATE
        if (msg.type === 'REQUEST_MATCH_STATE') {
          try {
            const requestedLobbyId = msg.lobbyId;
            const lobby = this.activeLobbies.get(requestedLobbyId);
            if (lobby) {
              // Return state
              ws.send(JSON.stringify({
                type: 'LOBBY_UPDATE',
                lobby: lobby
              }));
            } else {
              // Lobby not found (expired, cancelled, or reset)
              console.warn(`[DO] Lobby ${requestedLobbyId} not found in memory`);
              ws.send(JSON.stringify({
                type: 'MATCH_STATE_ERROR',
                lobbyId: requestedLobbyId,
                error: 'Lobby not found'
              }));
            }
          } catch (err: any) {
            console.error('[DO] Error in REQUEST_MATCH_STATE:', err);
            ws.send(JSON.stringify({
              type: 'MATCH_STATE_ERROR',
              error: err.message
            }));
          }
        }


        // 6.5. SERVER_CREATED (From Bot)
        if (msg.type === 'SERVER_CREATED') {
          const { lobbyId, serverInfo } = msg;
          console.log(`📡 Received SERVER_CREATED from Bot for Lobby ${lobbyId}`, serverInfo);
          const lobby = this.activeLobbies.get(lobbyId);

          if (lobby) {
            lobby.serverInfo = serverInfo;
            // Also store in matchData if needed by frontend schema
            // this.activeLobbies.set(lobbyId, lobby); // Reference modified in place

            // Broadcast SERVER_READY to players in this lobby
            this.broadcastToLobby(lobbyId, JSON.stringify({
              type: 'SERVER_READY',
              lobbyId: lobbyId,
              serverInfo: serverInfo
            }));

            await this.broadcastLobbyUpdate(lobbyId);
            await this.saveMatchState();
          } else {
            console.warn(`SERVER_CREATED received for unknown lobby: ${lobbyId}`);
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
              const pIndex = lobby.players.findIndex(p => p.id === userId || p.discord_id === userId || (p as any).player_id === userId);
              if (pIndex !== -1) {
                // Remove from main list
                lobby.players.splice(pIndex, 1);

                // Remove from Teams
                const tA = lobby.teamA.findIndex(p => p.id === userId || p.discord_id === userId || (p as any).player_id === userId);
                if (tA !== -1) lobby.teamA.splice(tA, 1);

                const tB = lobby.teamB.findIndex(p => p.id === userId || p.discord_id === userId || (p as any).player_id === userId);
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
                  await this.deleteLobbyFromStorage(lobbyId);
                  console.log(`Lobby ${lobbyId} is empty and deleted.`);
                } else {
                  await this.broadcastLobbyUpdate(lobbyId);
                  await this.saveMatchState();
                }

                ws.send(JSON.stringify({
                  type: 'LEAVE_MATCH_SUCCESS',
                  lobbyId: lobbyId
                }));
              }
            } else {
              // Lobby doesn't exist? Consider it success so frontend can clear state.
              this.playerLobbyMap.delete(userId); // Ensure map is clean
              ws.send(JSON.stringify({
                type: 'LEAVE_MATCH_SUCCESS',
                lobbyId: lobbyId
              }));
            }
          }
        }



        // 9. SEND_INVITE (Party System)
        if (msg.type === 'SEND_INVITE') {
          const { targetId, fromUser, lobbyId } = msg;
          if (targetId && fromUser) {
            console.log(`📨 Invite from ${fromUser.username} to ${targetId}`);
            // Look for target socket
            // 1. Try key as simple ID
            let targetWs = this.userSockets.get(targetId);

            // 2. If not found, try searching by discord_id in active players?? 
            // For now, simpler: map assumes userSockets key is userId.

            if (targetWs && targetWs.readyState === WebSocket.READY_STATE_OPEN) {
              targetWs.send(JSON.stringify({
                type: 'INVITE_RECEIVED',
                fromUser: fromUser,
                lobbyId: lobbyId || 'global'
              }));
              ws.send(JSON.stringify({ type: 'INVITE_SENT', success: true, targetId }));
            } else {
              // Try to find via player list? (Access O(N) but safer if key mismatch)
              // But for now, just report failure
              ws.send(JSON.stringify({ type: 'INVITE_FAILED', error: 'User not online', targetId }));
            }
          }
        }
        if (msg.type === 'RESET_MATCH') {
          console.log("⚠️ RESET_MATCH: Clearing active lobbies & local queue.");
          this.activeLobbies.clear();
          this.playerLobbyMap.clear();
          this.localQueue.clear();
          await this.saveMatchState();
          this.broadcastToAll(JSON.stringify({ type: 'MATCH_RESET' }));
          this.broadcastMergedQueue();
        }

        // 10. FILL_BOTS (Debug)
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

        // 11. SEND_CHAT
        if (msg.type === 'SEND_CHAT') {
          const { content, lobbyId } = msg;
          if (!content) return;

          const chatMessage: ChatMessage = {
            id: crypto.randomUUID(),
            userId: currentUserId || 'unknown',
            username: currentUserData?.username || 'Unknown',
            avatar: currentUserData?.avatar,
            content: content.slice(0, 500), // Limit message length
            timestamp: Date.now(),
            lobbyId: lobbyId,
            type: 'user'
          };

          if (lobbyId) {
            // Lobby Chat
            if (this.activeLobbies.has(lobbyId)) {
              const history = this.lobbyChatHistory.get(lobbyId) || [];
              history.push(chatMessage);
              this.lobbyChatHistory.set(lobbyId, history.slice(-50)); // Keep last 50

              this.broadcastToLobby(lobbyId, JSON.stringify({
                type: 'CHAT_MESSAGE',
                message: chatMessage
              }));
            }
          } else {
            // Global Chat
            this.chatHistory.push(chatMessage);
            this.chatHistory = this.chatHistory.slice(-50); // Keep last 50

            this.broadcastToAll(JSON.stringify({
              type: 'CHAT_MESSAGE',
              message: chatMessage
            }));
          }
        }

        // 12. REQUEST_LEADERBOARD
        if (msg.type === 'REQUEST_LEADERBOARD') {
          try {
            // Fetch leaderboard from database - VIP ONLY (matching HTTP API)
            const result = await this.env.DB.prepare(
              "SELECT * FROM players WHERE is_vip = 1 OR is_vip = 'true' OR is_vip = true ORDER BY elo DESC LIMIT 500"
            ).all();

            // Calculate regional stats
            const players = result.results || [];
            const totalPlayers = players.length;
            const totalElo = players.reduce((sum: number, p: any) => sum + (p.elo || 0), 0);
            const averageElo = totalPlayers > 0 ? Math.round(totalElo / totalPlayers) : 0;
            const totalMatches = players.reduce((sum: number, p: any) => sum + (p.wins || 0) + (p.losses || 0), 0);

            const leaderboard = players.map((player: any, index: number) => {
              const totalPlayerMatches = (player.wins || 0) + (player.losses || 0);
              const winRate = totalPlayerMatches > 0 ? ((player.wins || 0) / totalPlayerMatches) * 100 : 0;

              return {
                rank: index + 1,
                id: player.id,
                discord_id: player.discord_id,
                username: player.discord_username,
                avatar: player.discord_avatar,
                nickname: player.standoff_nickname,
                elo: player.elo,
                wins: player.wins,
                losses: player.losses,
                total_matches: totalPlayerMatches,
                win_rate: Math.round(winRate * 10) / 10,
                is_vip: player.is_vip === 1 || player.is_vip === 'true' || player.is_vip === true
              };
            });

            // Send leaderboard with stats to requesting client
            ws.send(JSON.stringify({
              type: 'LEADERBOARD_UPDATE',
              data: {
                players: leaderboard,
                stats: {
                  total_vip_players: totalPlayers,
                  average_elo: averageElo,
                  total_matches: totalMatches
                }
              }
            }));
          } catch (error) {
            console.error('Error fetching leaderboard:', error);
            ws.send(JSON.stringify({
              type: 'ERROR',
              message: 'Failed to fetch leaderboard'
            }));
          }
        }

        // ============= MODERATOR HANDLERS =============
        // Helper: Check if user is moderator/admin
        const isModerator = async (userId: string): Promise<boolean> => {
          try {
            const result = await this.env.DB.prepare(
              'SELECT role FROM players WHERE id = ?'
            ).bind(userId).first();
            return !!(result && (result.role === 'moderator' || result.role === 'admin'));
          } catch (e) {
            console.error('Error checking moderator status:', e);
            return false;
          }
        };

        // 11. GET_ALL_LOBBIES (Moderator Only)
        if (msg.type === 'GET_ALL_LOBBIES') {
          if (currentUserId && await isModerator(currentUserId)) {
            const lobbiesArray = Array.from(this.activeLobbies.entries()).map(([id, lobby]) => ({
              id,
              playerCount: lobby.players.length,
              players: lobby.players.map(p => ({ id: p.id, username: p.username })),
              status: lobby.serverInfo ? 'LIVE' : 'LOBBY',
              map: 'Sandstone',
              createdAt: Date.now() // simplified, ideally track creation time
            }));
            ws.send(JSON.stringify({ type: 'ALL_LOBBIES_DATA', lobbies: lobbiesArray }));
          } else {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized: Moderator access required' }));
          }
        }

        // 12. GET_ALL_USERS (Moderator Only) - Paginated
        if (msg.type === 'GET_ALL_USERS') {
          if (currentUserId && await isModerator(currentUserId)) {
            try {
              const page = msg.page || 1;
              const limit = 50;
              const offset = (page - 1) * limit;

              const result = await this.env.DB.prepare(
                'SELECT id, discord_username, discord_avatar, role, elo, wins, losses, banned FROM players LIMIT ? OFFSET ?'
              ).bind(limit, offset).all();

              const totalResult = await this.env.DB.prepare('SELECT COUNT(*) as count FROM players').first();
              const total = totalResult?.count || 0;

              ws.send(JSON.stringify({
                type: 'ALL_USERS_DATA',
                users: result.results || [],
                page,
                total
              }));
            } catch (e) {
              console.error('Error fetching users:', e);
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Failed to fetch users' }));
            }
          } else {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized: Moderator access required' }));
          }
        }

        // 13. FORCE_CANCEL_MATCH (Moderator Only)
        if (msg.type === 'FORCE_CANCEL_MATCH') {
          if (currentUserId && await isModerator(currentUserId)) {
            const { lobbyId } = msg;
            if (lobbyId && this.activeLobbies.has(lobbyId)) {
              const lobby = this.activeLobbies.get(lobbyId)!;
              // Remove all players from lobby map
              lobby.players.forEach(p => this.playerLobbyMap.delete(p.id));
              this.activeLobbies.delete(lobbyId);
              await this.deleteLobbyFromStorage(lobbyId);

              // Broadcast to lobby members
              this.broadcastToLobby(lobbyId, JSON.stringify({
                type: 'MATCH_CANCELED',
                reason: 'Moderator action',
                lobbyId
              }));

              ws.send(JSON.stringify({ type: 'CANCEL_MATCH_SUCCESS', lobbyId }));
              console.log(`🛑 Moderator ${currentUserId} canceled lobby ${lobbyId}`);
            } else {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Lobby not found' }));
            }
          } else {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized: Moderator access required' }));
          }
        }

        // 14. BAN_USER (Moderator Only)
        if (msg.type === 'BAN_USER') {
          if (currentUserId && await isModerator(currentUserId)) {
            const { targetUserId } = msg;
            try {
              await this.env.DB.prepare(
                'UPDATE players SET banned = 1 WHERE id = ?'
              ).bind(targetUserId).run();

              // Remove from queue if present
              this.localQueue.delete(targetUserId);

              // Kick from active match if in one
              const lobbyId = this.playerLobbyMap.get(targetUserId);
              if (lobbyId) {
                const targetWs = this.userSockets.get(targetUserId);
                if (targetWs) {
                  targetWs.send(JSON.stringify({
                    type: 'BANNED',
                    reason: 'Banned by moderator'
                  }));
                }
                this.playerLobbyMap.delete(targetUserId);
              }

              ws.send(JSON.stringify({ type: 'BAN_USER_SUCCESS', userId: targetUserId }));
              this.broadcastMergedQueue();
              console.log(`🔨 Moderator ${currentUserId} banned user ${targetUserId}`);
            } catch (e) {
              console.error('Error banning user:', e);
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Failed to ban user' }));
            }
          } else {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized: Moderator access required' }));
          }
        }

        // 15. UNBAN_USER (Moderator Only)
        if (msg.type === 'UNBAN_USER') {
          if (currentUserId && await isModerator(currentUserId)) {
            const { targetUserId } = msg;
            try {
              await this.env.DB.prepare(
                'UPDATE players SET banned = 0 WHERE id = ?'
              ).bind(targetUserId).run();

              ws.send(JSON.stringify({ type: 'UNBAN_USER_SUCCESS', userId: targetUserId }));
              console.log(`✅ Moderator ${currentUserId} unbanned user ${targetUserId}`);
            } catch (e) {
              console.error('Error unbanning user:', e);
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Failed to unban user' }));
            }
          } else {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized: Moderator access required' }));
          }
        }

        // 16. CHANGE_USER_ROLE (Moderator Only)
        if (msg.type === 'CHANGE_USER_ROLE') {
          if (currentUserId && await isModerator(currentUserId)) {
            const { targetUserId, newRole } = msg;
            if (['user', 'moderator', 'admin'].includes(newRole)) {
              try {
                await this.env.DB.prepare(
                  'UPDATE players SET role = ? WHERE id = ?'
                ).bind(newRole, targetUserId).run();

                ws.send(JSON.stringify({ type: 'CHANGE_ROLE_SUCCESS', userId: targetUserId, newRole }));
                console.log(`👑 Moderator ${currentUserId} changed ${targetUserId} role to ${newRole}`);
              } catch (e) {
                console.error('Error changing user role:', e);
                ws.send(JSON.stringify({ type: 'ERROR', message: 'Failed to change role' }));
              }
            } else {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid role' }));
            }
          } else {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized: Moderator access required' }));
          }
        }

        // 17. REMOVE_FROM_QUEUE (Moderator Only)
        if (msg.type === 'REMOVE_FROM_QUEUE') {
          if (currentUserId && await isModerator(currentUserId)) {
            const { targetUserId } = msg;
            this.localQueue.delete(targetUserId);
            this.broadcastMergedQueue();
            ws.send(JSON.stringify({ type: 'REMOVE_QUEUE_SUCCESS', userId: targetUserId }));
            console.log(`🚫 Moderator ${currentUserId} removed ${targetUserId} from queue`);
          } else {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized: Moderator access required' }));
          }
        }

        // 18. GET_SYSTEM_STATS (Moderator Only)
        if (msg.type === 'GET_SYSTEM_STATS') {
          if (currentUserId && await isModerator(currentUserId)) {
            try {
              const totalUsersResult = await this.env.DB.prepare('SELECT COUNT(*) as count FROM players').first();
              const queueCount = this.getMergedQueue().length;
              const activeMatches = this.activeLobbies.size;

              ws.send(JSON.stringify({
                type: 'SYSTEM_STATS_DATA',
                stats: {
                  totalUsers: totalUsersResult?.count || 0,
                  queueCount,
                  activeMatches,
                  onlineUsers: this.userSockets.size
                }
              }));
            } catch (e) {
              console.error('Error fetching system stats:', e);
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Failed to fetch stats' }));
            }
          } else {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Unauthorized: Moderator access required' }));
          }
        }



        // 12.5 REQUEST_MATCH_STATE (for retrieving lobby state)
        if (msg.type === 'REQUEST_MATCH_STATE') {
          const { lobbyId } = msg; // Renamed logic
          const lobby = this.activeLobbies.get(lobbyId);
          if (lobby) {
            ws.send(JSON.stringify({
              type: 'LOBBY_UPDATE',
              lobby: lobby,
              serverTime: Date.now()
            }));
          } else {
            ws.send(JSON.stringify({ type: 'MATCH_STATE_ERROR', error: 'Lobby not found' }));
          }
        }

        // 13. DRAFT_PICK
        if (msg.type === 'DRAFT_PICK') {
          const { lobbyId, pickedPlayerId } = msg; // Correct destructuring
          const lobby = this.activeLobbies.get(lobbyId);

          if (lobby && lobby.draftState && lobby.draftState.isActive) {
            // Validate Turn
            const isCaptainA = currentUserId === lobby.captainA.id || currentUserId === lobby.captainA.discord_id;
            const isCaptainB = currentUserId === lobby.captainB.id || currentUserId === lobby.captainB.discord_id;

            const expectedPicker = lobby.draftState.currentTurn === 'captainA' ? isCaptainA : isCaptainB;

            if (!expectedPicker) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Not your turn to pick' }));
              return;
            }

            // Move Player
            const pickedIndex = lobby.draftState.pool.findIndex(p => p.id === pickedPlayerId || p.discord_id === pickedPlayerId);
            if (pickedIndex !== -1) {
              const pickedPlayer = lobby.draftState.pool[pickedIndex];
              lobby.draftState.pool.splice(pickedIndex, 1);

              if (lobby.draftState.currentTurn === 'captainA') {
                lobby.teamA.push(pickedPlayer);
              } else {
                lobby.teamB.push(pickedPlayer);
              }

              lobby.draftState.pickHistory.push({ pickerId: currentUserId!, pickedId: pickedPlayer.id });

              // PERSISTENCE: Save state after every pick to prevent data loss on DO restart
              await this.saveMatchState();


              // Update Turn
              const nextTurnIndex = lobby.draftState.pickHistory.length;
              if (nextTurnIndex < lobby.draftState.pickOrder.length) {
                lobby.draftState.currentTurn = lobby.draftState.pickOrder[nextTurnIndex];
                lobby.draftState.lastPickTimestamp = Date.now(); // RESET TIMER
              } else {
                // Draft Complete
                lobby.draftState.isActive = false;
                lobby.status = 'in_progress'; // CORRECT STATUS
                lobby.startedAt = Date.now();
                if (!(lobby as any).selectedMap) (lobby as any).selectedMap = "Sandstone";

                // FETCH FRESH DATA (URL might have changed)
                try {
                  const freshData = await this.env.DB.prepare("SELECT lobby_url FROM matches WHERE id = ?").bind(lobbyId).first();
                  if (freshData && freshData.lobby_url) {
                    lobby.lobby_url = freshData.lobby_url as string;
                  }
                } catch (e) {
                  console.error("Failed to refresh lobby url", e);
                }

                // START MATCH: Migrate drafted teams to main player list
                // 1. Tag players
                lobby.teamA.forEach(p => p.team = 'alpha');
                lobby.teamB.forEach(p => p.team = 'bravo');

                // 2. Update lobby.players
                lobby.players = [...lobby.teamA, ...lobby.teamB];

                // 3. Update DB: Status -> in_progress
                try {
                  await this.env.DB.prepare("UPDATE matches SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?")
                    .bind(lobbyId).run();

                  // 4. Update DB: Persist Players & Teams
                  await this.env.DB.prepare("DELETE FROM match_players WHERE match_id = ?").bind(lobbyId).run();

                  const stmt = this.env.DB.prepare(`
                    INSERT INTO match_players (id, match_id, player_id, team, is_captain, elo, created_at, joined_at)
                    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                  `);

                  const batch = lobby.players.map(p => {
                    const isCaptain = (p.id === lobby.captainA.id || p.id === lobby.captainB.id) ? 1 : 0;
                    const team = p.team || (lobby.teamA.find(x => x.id === p.id) ? 'alpha' : 'bravo');

                    return stmt.bind(
                      crypto.randomUUID(),
                      lobbyId,
                      p.id || p.player_id || p.discord_id,
                      team,
                      isCaptain,
                      p.elo || 1000
                    );
                  });

                  await this.env.DB.batch(batch);
                  console.log(`✅ [${lobbyId}] Persisted ${lobby.players.length} drafted players to DB (Manual Pick).`);

                } catch (e) {
                  console.error(`❌ [${lobbyId}] FAILED to persist match start state (Manual):`, e);
                }

                this.broadcastToLobby(lobbyId, JSON.stringify({
                  type: 'MATCH_START',
                  lobbyId: lobby.id,
                  selectedMap: "Sandstone",
                  matchData: lobby,
                  serverInfo: lobby.serverInfo
                }));
              }

              await this.saveMatchState();
              await this.broadcastLobbyUpdate(lobbyId);

              // CHECK IF NEXT TURN IS BOT
              if (lobby.draftState.isActive) {
                this.executeAutoPick(lobbyId, true).catch(console.error);
              }

            } else {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Player not in pool' }));
            }
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

  // --- AUTO / BOT PICK LOGIC ---
  async executeAutoPick(lobbyId: string, isBotLogic: boolean) {
    const lobby = this.activeLobbies.get(lobbyId);
    if (!lobby || !lobby.draftState || !lobby.draftState.isActive) return;

    const turn = lobby.draftState.currentTurn;
    const captain = turn === 'captainA' ? lobby.captainA : lobby.captainB;

    // IF BOT LOGIC: Check if it's actually a bot turn
    if (isBotLogic) {
      const isBot = captain.id.startsWith('bot_') || captain.id.startsWith('auto_');
      if (!isBot) {
        console.log(`❌ AutoPick: Not a bot (${captain.username}), skipping bot logic.`);
        return;
      }

      console.log(`🤖 Bot Turn (${captain.username}) in lobby ${lobbyId}. Pool Size: ${lobby.draftState.pool.length}`);
      // REMOVED DELAY FOR DEBUGGING/SPEED
      // await new Promise(resolve => setTimeout(resolve, 1500)); 
    } else {
      // TIMEOUT LOGIC: Force pick for whoever it is (Human or Bot)
      console.log(`⏱️ Auto-picking for ${captain.username} (Timeout). Pool Size: ${lobby.draftState.pool.length}`);
    }

    // Re-fetch state
    if (!lobby.draftState.isActive) {
      console.log('❌ AutoPick: Draft not active.');
      return;
    }

    // Double Check Turn (race condition)
    if (lobby.draftState.currentTurn !== turn) {
      console.log(`❌ AutoPick: Turn mismatch (Current: ${lobby.draftState.currentTurn} vs Expected: ${turn})`);
      return;
    }

    // Pick Random
    const pool = lobby.draftState.pool;
    if (pool.length === 0) {
      console.log('❌ AutoPick: Pool empty!');
      return;
    }

    const randomIdx = Math.floor(Math.random() * pool.length);
    const pickedPlayer = pool[randomIdx];
    console.log(`✅ Picking ${pickedPlayer.username} for ${captain.username}`);

    // Execute Pick
    pool.splice(randomIdx, 1);

    if (turn === 'captainA') lobby.teamA.push(pickedPlayer);
    else lobby.teamB.push(pickedPlayer);

    lobby.draftState.pickHistory.push({ pickerId: captain.id, pickedId: pickedPlayer.id });

    // PERSISTENCE: Save state after every pick to prevent data loss on DO restart
    await this.saveMatchState();

    // Advance Turn
    const nextTurnIndex = lobby.draftState.pickHistory.length;
    if (nextTurnIndex < lobby.draftState.pickOrder.length) {
      lobby.draftState.currentTurn = lobby.draftState.pickOrder[nextTurnIndex];
      lobby.draftState.lastPickTimestamp = Date.now(); // RESET TIMER
    } else {
      // Draft Complete
      lobby.draftState.isActive = false;
      lobby.status = 'in_progress';
      lobby.startedAt = Date.now();
      if (!(lobby as any).selectedMap) (lobby as any).selectedMap = "Sandstone";

      // START MATCH: Migrate drafted teams to main player list
      // 1. Tag players
      lobby.teamA.forEach(p => p.team = 'alpha');
      lobby.teamB.forEach(p => p.team = 'bravo');

      // 2. Update lobby.players
      lobby.players = [...lobby.teamA, ...lobby.teamB];

      // 3. Update DB: Status -> in_progress
      try {
        await this.env.DB.prepare("UPDATE matches SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?")
          .bind(lobbyId).run();

        // 4. Update DB: Persist Players & Teams
        // Explicitly clear existing players to ensure a fresh, correct insert
        await this.env.DB.prepare("DELETE FROM match_players WHERE match_id = ?").bind(lobbyId).run();

        const stmt = this.env.DB.prepare(`
          INSERT INTO match_players (id, match_id, player_id, team, is_captain, elo, created_at, joined_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `);

        // Batch Insert all 10 players
        const batch = lobby.players.map(p => {
          const isCaptain = (p.id === lobby.captainA.id || p.id === lobby.captainB.id) ? 1 : 0;
          // IMPORTANT: Check team assignment, fallback if missing (should not happen with tagging above)
          const team = p.team || (lobby.teamA.find(x => x.id === p.id) ? 'alpha' : 'bravo');

          return stmt.bind(
            crypto.randomUUID(),
            lobbyId,
            p.id || p.player_id || p.discord_id, // Ensure we get the ID
            team,
            isCaptain,
            p.elo || 1000
          );
        });

        const results = await this.env.DB.batch(batch);
        console.log(`✅ [${lobbyId}] Persisted ${lobby.players.length} drafted players to DB (Clean Insert). Success: ${results.length > 0}`);

      } catch (e) {
        console.error(`❌ [${lobbyId}] FAILED to persist match start state:`, e);
        // We do NOT re-throw here to keep the lobby running in memory, but this is critical.
      }

      this.broadcastToLobby(lobbyId, JSON.stringify({
        type: 'MATCH_START',
        lobbyId: lobby.id,
        selectedMap: "Sandstone",
        matchData: lobby,
        serverInfo: lobby.serverInfo
      }));
    }

    await this.saveMatchState();
    await this.broadcastLobbyUpdate(lobbyId);

    // RECURSE: Check if NEXT turn is bot (only if we just acted)
    // If we just timeout-picked for a human, and next is bot, we should trigger bot logic
    if (lobby.draftState.isActive) {
      this.executeAutoPick(lobbyId, true).catch(console.error);
    }
  }



}

// 2. Helper for VIP Cleanup
async function cleanupExpiredVips(env: Env) {
  try {
    const expiredPlayers = await env.DB.prepare(`
            SELECT id FROM players 
            WHERE is_vip = 1 AND vip_until < datetime('now')
        `).all();

    const playersList = expiredPlayers.results || [];
    const DISCORD_VIP_ROLE_ID = '1454234806933258382';

    for (const player of playersList) {
      const playerId = player.id as string;

      // Remove from Discord
      try {
        await fetch(
          `https://discord.com/api/v10/guilds/${env.DISCORD_SERVER_ID}/members/${playerId}/roles/${DISCORD_VIP_ROLE_ID}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json',
            }
          }
        );
      } catch (err) {
        console.error(`Failed to remove Discord role for ${playerId}:`, err);
      }

      // Update DB
      await env.DB.prepare(`
                UPDATE players SET is_vip = 0, vip_until = NULL WHERE id = ?
            `).bind(playerId).run();

      console.log(`Cleaned up expired VIP for ${playerId}`);
    }
    return playersList.length;
  } catch (err) {
    console.error('Error in VIP cleanup:', err);
    return 0;
  }
}

// 2. Hono API
const app = new Hono<{ Bindings: Env }>();

// CORS-ийг идэвхжүүлэх
app.use('/*', cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://standoff-frontend.pages.dev',
    'https://standoff2.mn',
    'https://www.standoff2.mn',
    'https://main.standoff-frontend.pages.dev',
    'https://a0ab2f80.standoff-frontend.pages.dev'
  ],
  credentials: true,
}));

// Global Error Handler
app.onError((err, c) => {
  console.error('Global App Error:', err);

  // Log to Datadog
  const apiKey = c.env.DD_API_KEY;
  if (apiKey) {
    c.executionCtx.waitUntil(logToDatadog(apiKey, err.message, 'error', {
      stack: err.stack,
      url: c.req.url,
      method: c.req.method,
      userAgent: c.req.header('User-Agent')
    }));
  }

  return c.json({
    success: false,
    message: 'Internal Server Error',
    error: err.message
  }, 500);
});

// Setup routes
setupProfileRoutes(app);
setupLeaderboardRoutes(app);
setupAdminRoutes(app);
setupFriendsRoutes(app);
setupStatsRoutes(app);

app.route('/api/matches', matchesRoutes);
app.route('/api/matches', lobbyInviteRoutes);
app.route('/api/moderator', moderatorRoutes);
app.route('/api/vip-requests', vipRequestsRoutes);
app.route('/api/clans/requests', clanRequestsRoutes);
app.route('/api', uploadRoutes);

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

    // 3. Check Discord roles and membership
    const requiredGuildId = c.env.DISCORD_SERVER_ID;
    const botToken = c.env.DISCORD_BOT_TOKEN;
    let isDiscordMember = false;
    let hasAdminRole = false;
    let hasVipRole = false;
    let hasModeratorRole = false;
    let tierElo = 1000;
    let discordRolesJson = '[]';


    if (requiredGuildId && botToken) {
      try {
        // Fetch guild member info to get roles
        const memberResponse = await fetch(`https://discord.com/api/v10/guilds/${requiredGuildId}/members/${userData.id}`, {
          headers: {
            Authorization: `Bot ${botToken}`
          }
        });

        if (memberResponse.ok) {
          const memberData = await memberResponse.json() as any;
          isDiscordMember = true;
          const roles = memberData.roles || [];
          discordRolesJson = JSON.stringify(roles);

          // Role IDs provided by user:
          // Admin: 1453054732141854751
          // VIP: 1454234806933258382
          hasAdminRole = roles.includes('1453054732141854751');
          hasVipRole = roles.includes('1454234806933258382');

          // Moderator check
          const moderatorRoleId = c.env.MODERATOR_ROLE_ID;
          if (moderatorRoleId) {

            hasModeratorRole = roles.includes(moderatorRoleId);
          }

          // Tier Role IDs:
          // Gold: 1454095406446153839 (1600+)
          // Silver: 1454150874531234065 (1200+)
          // Bronze: 1454150924556570624 (1000+)
          if (roles.includes('1454095406446153839')) {
            tierElo = 1600;
          } else if (roles.includes('1454150874531234065')) {
            tierElo = 1200;
          } else if (roles.includes('1454150924556570624')) {
            tierElo = 1000;
          }

          console.log(`User ${userData.id} profile: Admin=${hasAdminRole}, Mod=${hasModeratorRole}, VIP=${hasVipRole}, TierElo=${tierElo}`);
        }
      } catch (err) {
        console.warn('Could not fetch Discord guild roles:', err);
      }
    }

    // 4. Update Database
    let player: any = null;
    try {
      // Determine role and VIP status
      let roleToSet = 'user';
      if (hasAdminRole) {
        roleToSet = 'admin';
      } else if (hasModeratorRole) {
        roleToSet = 'moderator';
      }

      const eloDefault = 1000;

      // Calculate VIP expiry if they have the role
      const oneMonthFromNow = new Date();
      oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
      const vipUntilDate = oneMonthFromNow.toISOString();

      await c.env.DB.prepare(
        `INSERT INTO players (id, discord_id, discord_username, discord_avatar, is_discord_member, role, is_vip, vip_until, elo, discord_roles) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
         discord_username = excluded.discord_username,
         discord_avatar = excluded.discord_avatar,
         is_discord_member = excluded.is_discord_member,
         role = excluded.role,
         is_vip = CASE WHEN excluded.is_vip = 1 THEN 1 ELSE players.is_vip END,
         vip_until = CASE 
            WHEN excluded.is_vip = 1 AND (players.vip_until IS NULL OR players.vip_until < datetime('now')) 
            THEN excluded.vip_until 
            ELSE players.vip_until 
         END,
         discord_roles = excluded.discord_roles,
         elo = CASE 
            WHEN excluded.elo > 1000 AND excluded.elo > players.elo THEN excluded.elo 
            ELSE players.elo 
          END`
      ).bind(
        userData.id,
        userData.id,
        userData.username,
        userData.avatar,
        isDiscordMember ? 1 : 0,
        roleToSet,
        hasVipRole ? 1 : 0,
        hasVipRole ? vipUntilDate : null,
        tierElo,
        discordRolesJson
      ).run();

      const { results } = await c.env.DB.prepare(
        `SELECT role, elo, is_vip, vip_until, discord_roles, gold FROM players WHERE id = ?`
      ).bind(userData.id).all();

      if (results && results.length > 0) {
        player = results[0];

        // SELF-HEALING DISCORD ROLES
        // If user is VIP in DB, ensure they have the VIP role on Discord
        if (player.is_vip) {
          try {
            // We don't await this to keep the login fast, but we fire-and-forget
            updateDiscordRole(c.env, userData.id, TIERS.VIP, true);
          } catch (discordErr) {
            console.error('Self-healing VIP role failed:', discordErr);
          }
        }
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
    }

    // 5. Redirect to Frontend
    const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173';
    const role = player?.role || 'user';
    const elo = player?.elo || 1000;
    const isMember = player?.is_discord_member || 0;
    const createdAt = player?.created_at || '';
    const isVip = player?.is_vip || 0;
    const vipUntil = player?.vip_until || '';
    const discordRoles = player?.discord_roles || '[]';
    const gold = player?.gold || 0;

    return c.redirect(
      `${frontendUrl}?id=${userData.id}&username=${userData.username}&avatar=${userData.avatar || ''}&role=${role}&elo=${elo}&is_vip=${isVip}&vip_until=${vipUntil}&is_discord_member=${isMember === 1}&created_at=${createdAt}&discord_roles=${encodeURIComponent(String(discordRoles))}&gold=${gold}`
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
// app.get('/api/debug/queue', async (c) => {
//   const id = c.env.MATCH_QUEUE.idFromName('global-matchmaking-v2');
//   const obj = c.env.MATCH_QUEUE.get(id);
//   // We can't call methods directly on the Stub in Hono without RPC or fetching specific URL
//   // So we'll fetch the DO with a special path
//   return obj.fetch(new Request('http://do/debug', c.req.raw));
// });

app.get('/ws', async (c) => {
  if (c.req.header('Upgrade') !== 'websocket') {
    return c.text('Expected Upgrade: websocket', 426);
  }
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

// API endpoint to check online status for multiple users
app.post('/api/users/check-online', async (c) => {
  try {
    const { userIds } = await c.req.json();

    if (!Array.isArray(userIds)) {
      return c.json({ error: 'userIds must be an array' }, 400);
    }

    const id = c.env.MATCH_QUEUE.idFromName('global-matchmaking-v2');
    const obj = c.env.MATCH_QUEUE.get(id);

    const doUrl = new URL(c.req.raw.url);
    doUrl.pathname = '/check-online';
    const doRequest = new Request(doUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds })
    });

    return obj.fetch(doRequest);
  } catch (error: any) {
    console.error('Error checking online status:', error);
    return c.json({ error: 'Failed to check online status' }, 500);
  }
});

// Debug Discord Roles
app.get('/api/admin/debug-discord/:userId', async (c) => {
  const secret = c.req.query('secret');
  if (secret !== (c.env.ADMIN_SECRET || 'admin-secret-123')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userId = c.req.param('userId');
  const guildId = c.env.DISCORD_SERVER_ID;
  const botToken = c.env.DISCORD_BOT_TOKEN;

  if (!guildId || !botToken) {
    return c.json({
      error: 'Missing config',
      hasGuildId: !!guildId,
      hasBotToken: !!botToken
    }, 500);
  }

  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
      headers: { Authorization: `Bot ${botToken}` }
    });

    if (!response.ok) {
      const text = await response.text();
      return c.json({
        ok: false,
        status: response.status,
        statusText: response.statusText,
        errorBody: text,
        guildId,
        botTokenHint: botToken.substring(0, 10) + '...'
      });
    }

    const data = await response.json() as any;
    return c.json({
      ok: true,
      roles: data.roles,
      isAdminRolePresent: data.roles?.includes('1453054732141854751')
    });
  } catch (err: any) {
    return c.json({ ok: false, error: err.message });
  }
});

// Manual VIP cleanup endpoint (for testing/emergency)
app.post('/api/admin/cleanup-vips', async (c) => {
  const secret = c.req.query('secret');
  if (secret !== c.env.ADMIN_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const cleanedCount = await cleanupExpiredVips(c.env);
    return c.json({ success: true, message: `Cleaned up ${cleanedCount} expired VIPs.` });
  } catch (error) {
    console.error('Manual VIP cleanup failed:', error);
    return c.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});

import agoraRoutes from './routes/agora';

// New Manual Matchmaking Routes
app.route('/api', uploadRoutes); // R2 permissions missing, temporarily disabled
app.route('/api/streamers', streamerRoutes);
app.route('/api/clans', clanRoutes);
app.route('/api/clan-requests', clanRequestsRoutes);
app.route('/api/gold', goldRoutes);
app.route('/api/rewards', rewardsRoutes);
app.route('/api/agora', agoraRoutes);

app.get('/api/test-notification', async (c) => {
  const discordId = c.req.query('id') || '1237067681623052288';
  const message = `Hey <@${discordId}>! Match #TEST (TEST) has been running for >20 mins.
Сайн байна уу? Үр дүнгээ илгээнэ үү (Зураг болон Хожсон тал). Website дээрээс явуулаарай! Баярлалаа! 🙏📸✨`;

  await sendDiscordMessage(c.env, '1457019547394773085', message);
  return c.text('Notification sent to ' + discordId);
});

const handler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(cleanupExpiredVips(env));
    ctx.waitUntil(syncDiscordMembers(env));
    ctx.waitUntil(checkStaleMatches(env));
  }

};

export default handler;
