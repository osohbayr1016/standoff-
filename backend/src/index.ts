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

// 1. Durable Object - Real-time системд хэрэгтэй
export class MatchQueueDO {
  sessions: Set<WebSocket> = new Set();
  userSockets: Map<string, WebSocket> = new Map(); // Global User Registry: UserId -> WebSocket
  localQueue: Map<string, any> = new Map(); // Local Web Users: ID -> { id, username, avatar, elo }
  remoteQueue: any[] = []; // Cache of NeatQueue players

  constructor(public state: DurableObjectState, public env: any) { }

  async fetch(request: Request) {
    const url = new URL(request.url);

    // Handle API endpoints
    if (url.pathname.endsWith('/server-info') && request.method === 'POST') {
      return this.handleServerInfo(request);
    }

    if (url.pathname.endsWith('/debug')) {
      return new Response(JSON.stringify({
        localQueueSize: this.localQueue.size,
        sessionsCount: this.sessions.size,
        remoteQueueCount: this.remoteQueue.length,
        localPlayers: Array.from(this.localQueue.values()),
        remotePlayers: this.remoteQueue
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    // 1. WebSocket холболт үүсгэх
    const [client, server] = Object.values(new WebSocketPair());

    this.handleSession(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async handleServerInfo(request: Request) {
    try {
      const body = await request.json() as { lobbyId: string; serverInfo: { ip: string; password: string; matchLink?: string } };

      // Load match state if not initialized
      if (!this.initialized || !this.currentLobby) {
        await this.loadMatchState();
      }

      // Validate lobbyId
      if (!this.currentLobby || this.currentLobby.id !== body.lobbyId) {
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
      this.currentLobby.serverInfo = {
        ...body.serverInfo,
        matchLink
      };

      // Save state
      await this.saveMatchState();

      // Check if all players are ready
      const readyPhaseState = this.currentLobby.readyPhaseState;
      const players = this.currentLobby.players || [];
      const allPlayersReady = readyPhaseState.readyPlayers.length >= players.length;

      // Broadcast to all connected clients
      if (allPlayersReady && this.matchState === 'GAME') {
        // All players ready and match started - send MATCH_START
        this.broadcastToAll(JSON.stringify({
          type: 'MATCH_START',
          lobbyId: this.currentLobby.id,
          selectedMap: this.currentLobby.mapBanState?.selectedMap,
          matchData: this.currentLobby,
          serverInfo: this.currentLobby.serverInfo
        }));
      } else {
        // Server ready but waiting for players - send SERVER_READY
        this.broadcastToAll(JSON.stringify({
          type: 'SERVER_READY',
          lobbyId: body.lobbyId,
          serverInfo: this.currentLobby.serverInfo
        }));
      }

      // Also send LOBBY_UPDATE to sync state
      await this.broadcastLobbyUpdate();

      console.log('✅ Server info received via API:', this.currentLobby.serverInfo);

      return new Response(JSON.stringify({
        success: true,
        message: 'Server info updated successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error: any) {
      console.error('❌ Error handling server info:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  matchState: 'IDLE' | 'LOBBY' | 'GAME' = 'IDLE';
  currentLobby: any = null; // Will include: { id, players, captains, teams, readyPlayers, mapBanState, readyPhaseState, serverInfo }
  readyPhaseTimer: any = null; // Timer for ready phase countdown
  initialized: boolean = false; // Track if we've loaded from storage

  // Load match state from storage
  async loadMatchState() {
    try {
      const savedState = await this.state.storage.get<{ matchState: string; currentLobby: any }>('matchState');
      if (savedState) {
        this.matchState = savedState.matchState as 'IDLE' | 'LOBBY' | 'GAME';
        this.currentLobby = savedState.currentLobby;
        console.log('✅ Loaded match state from storage:', this.matchState, this.currentLobby?.id);
      }
    } catch (error) {
      console.error('❌ Error loading match state:', error);
    }
    this.initialized = true;
  }

  // Save match state to storage
  async saveMatchState() {
    try {
      await this.state.storage.put('matchState', {
        matchState: this.matchState,
        currentLobby: this.currentLobby
      });
      console.log('💾 Saved match state to storage:', this.matchState, this.currentLobby?.id);
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

      // MATCH TRIGGER LOGIC
      // Threshold: 10 players (5v5)
      if (this.matchState === 'IDLE' && merged.length >= 10) {
        await this.startMatch(merged.slice(0, 10)); // Top 10 players
      } else if (this.matchState === 'LOBBY') {
        // Check if in map ban phase
        if (this.currentLobby?.mapBanState?.mapBanPhase) {
          // MAP BAN TIMEOUT CHECK
          const banState = this.currentLobby.mapBanState;
          const lastActivity = banState.currentTurnStartTimestamp || banState.lastBanTimestamp || Date.now();
          const elapsed = (Date.now() - lastActivity) / 1000;
          const TIMEOUT_BUFFER = 5; // 5 seconds buffer

          if (elapsed > (banState.banTimeout + TIMEOUT_BUFFER)) {
            console.log("⏰ Map Ban Timeout detected, auto-banning...");

            const ALL_MAPS = ['Hanami', 'Rust', 'Zone 7', 'Dune', 'Breeze', 'Province', 'Sandstone'];
            const availableMaps = ALL_MAPS.filter(m => !banState.bannedMaps.includes(m));

            if (availableMaps.length > 1) {
              const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];

              // Perform Auto-Ban
              banState.bannedMaps.push(randomMap);
              banState.banHistory.push({
                team: banState.currentBanTeam,
                map: randomMap,
                timestamp: Date.now()
              });
              banState.lastBanTimestamp = Date.now();

              // Switch Teams
              const previousTeam = banState.currentBanTeam;
              banState.currentBanTeam = banState.currentBanTeam === 'alpha' ? 'bravo' : 'alpha';
              banState.currentTurnStartTimestamp = Date.now(); // Reset timer for next turn

              await this.broadcastLobbyUpdate();
            } else if (availableMaps.length === 1) {
              // If only 1 map left, we should have finished already, but force finish here
              const remainingMap = availableMaps[0];
              banState.selectedMap = remainingMap;
              banState.mapBanPhase = false;

              // Start ready phase instead of immediately starting match
              const readyPhaseState = this.currentLobby.readyPhaseState;
              readyPhaseState.phaseActive = true;
              readyPhaseState.readyPlayers = [];
              readyPhaseState.readyPhaseStartTimestamp = Date.now();
              readyPhaseState.readyPhaseTimeout = 30; // 30 seconds

              // Save state before broadcasting
              await this.saveMatchState();
              this.broadcastToAll(JSON.stringify({
                type: 'READY_PHASE_STARTED',
                lobbyId: this.currentLobby.id,
                selectedMap: remainingMap,
                readyPhaseTimeout: 30
              }));
              // Also send LOBBY_UPDATE to sync state
              await this.broadcastLobbyUpdate();
            }
          }
        } else if (this.currentLobby?.readyPhaseState?.phaseActive) {
          // READY PHASE TIMEOUT CHECK
          const readyPhaseState = this.currentLobby.readyPhaseState;
          const players = this.currentLobby.players || [];
          const allPlayersReady = readyPhaseState.readyPlayers.length >= players.length;

          if (readyPhaseState.readyPhaseStartTimestamp) {
            const elapsed = (Date.now() - readyPhaseState.readyPhaseStartTimestamp) / 1000;
            const timeRemaining = readyPhaseState.readyPhaseTimeout - elapsed;

            if (timeRemaining <= 0 && !allPlayersReady) {
              // Timeout - cancel match and re-enter players to queue
              console.log("⏰ Ready phase timeout, cancelling match...");

              const lobbyId = this.currentLobby.id;

              // Re-enter players to queue
              players.forEach((p: any) => {
                const playerId = p.id || p.discord_id;
                if (playerId && !this.localQueue.has(playerId)) {
                  this.localQueue.set(playerId, p);
                }
              });

              // Broadcast cancellation before clearing state
              this.broadcastToAll(JSON.stringify({
                type: 'MATCH_CANCELLED',
                reason: 'Ready phase timeout',
                lobbyId: lobbyId
              }));

              // Clear match state
              this.matchState = 'IDLE';
              this.currentLobby = null;
              await this.saveMatchState();

              // Broadcast updated queue
              this.broadcastMergedQueue();
            }
          }
        }
      } else {
        // Just broadcast queue if match isn't starting
        this.broadcastMergedQueue();
      }
    } catch (error) {
      console.error('❌ Error in DO alarm:', error);
    } finally {
      const SECONDS = 5;

      // Optimization: Only reschedule if we have active users OR an active match
      // If no one is connected and no match is running, let the DO sleep.
      // It will wake up on next fetch() / WebSocket connection.
      const hasActiveUsers = this.sessions.size > 0;
      // Also check remote queue count? No, because we only care if someone is WATCHING the queue.
      // But if we want to keep syncing remote queue even if no one is watching... maybe not needed.
      // Let's safe-guard: If we have local users OR we are in a match.

      const shouldReschedule = hasActiveUsers || this.matchState !== 'IDLE';

      if (shouldReschedule) {
        await this.state.storage.setAlarm(Date.now() + SECONDS * 1000);
      } else {
        console.log("💤 No active users or match, stopping alarm loop.");
      }
    }
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

  async startMatch(players: any[]) {
    console.log("Starting Match with:", players.length, "players");
    this.matchState = 'LOBBY';

    // Select Captains (first 2 players, or random/highest ELO)
    const captain1 = players[0];
    const captain2 = players[1] || players[0]; // Fallback

    // Distribute all 10 players into 5v5 teams
    // Simple distribution: alternate players (captain1, captain2, p3, p4, ...)
    // Or use snake draft, or random, or ELO-balanced
    const teamA = [];
    const teamB = [];

    for (let i = 0; i < players.length; i++) {
      if (i % 2 === 0) {
        teamA.push(players[i]);
      } else {
        teamB.push(players[i]);
      }
    }

    this.currentLobby = {
      id: crypto.randomUUID(),
      players: players,
      captainA: captain1,
      captainB: captain2,
      teamA: teamA, // Now contains 5 players
      teamB: teamB, // Now contains 5 players
      readyPlayers: [], // Initialize ready list
      mapBanState: {
        bannedMaps: [],
        currentBanTeam: 'alpha',
        banHistory: [],
        selectedMap: undefined,
        mapBanPhase: true,
        lastBanTimestamp: undefined,
        currentTurnStartTimestamp: Date.now(), // Track when current turn started
        banTimeout: 15 // 15 seconds
      },
      readyPhaseState: {
        phaseActive: false,
        readyPlayers: [],
        readyPhaseStartTimestamp: undefined,
        readyPhaseTimeout: 30 // 30 seconds
      }
    };

    // Save to storage
    await this.saveMatchState();

    // ... (rest of startMatch)

    this.broadcastLobbyUpdate(); // Send initial state (replaces MATCH_READY? No, keep MATCH_READY for transition)
    // Actually MATCH_READY is for transition to MapBan.
    // LOBBY_UPDATE is for sync within pages.

    // We keep sending MATCH_READY to trigger the page switch initially.
    const message = JSON.stringify({
      type: 'MATCH_READY',
      lobbyId: this.currentLobby.id,
      players: players,
      captains: [captain1, captain2]
    });

    this.broadcastToAll(message);

    // Cleanup Local Queue (Web users enter match)
    players.forEach(p => {
      if (this.localQueue.has(p.id)) {
        this.localQueue.delete(p.id);
      }
    });
  }

  async broadcastLobbyUpdate() {
    if (!this.currentLobby) return;

    // Save state before broadcasting
    await this.saveMatchState();

    const message = JSON.stringify({
      type: 'LOBBY_UPDATE',
      lobby: this.currentLobby
    });
    this.broadcastToAll(message);
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

    // Load match state from storage on first connection
    if (!this.initialized) {
      await this.loadMatchState();
    }

    // Ensure the alarm is running!
    this.state.storage.getAlarm().then(currentAlarm => {
      if (!currentAlarm) {
        console.log("⏰ Waking up DO alarm loop...");
        this.state.storage.setAlarm(Date.now() + 1000);
      }
    });

    let currentUserId: string | null = null;
    let currentUserData: any = null;

    ws.addEventListener('message', async (msg: MessageEvent) => {
      try {
        const data = JSON.parse(msg.data as string);

        // REGISTER: User connects and identifies themselves
        if (data.type === 'REGISTER') {
          if (data.userId) {
            currentUserId = data.userId;
            currentUserData = {
              id: data.userId,
              username: data.username,
              avatar: data.avatar,
              elo: data.elo
            };
            this.userSockets.set(data.userId, ws);
            // Confirm registration to client
            ws.send(JSON.stringify({ type: 'REGISTER_ACK', userId: data.userId }));

            // Catch-up: If match is already loading/started, send them to it
            if ((this.matchState === 'LOBBY' || this.matchState === 'GAME') && this.currentLobby) {
              const players = this.currentLobby.players || [];
              const isUserInMatch = players.some((p: any) => p.id === data.userId || p.discord_id === data.userId);

              if (isUserInMatch) {
                // Send MATCH_READY to trigger navigation
                ws.send(JSON.stringify({
                  type: 'MATCH_READY',
                  lobbyId: this.currentLobby.id,
                  players: this.currentLobby.players,
                  captains: [this.currentLobby.captainA, this.currentLobby.captainB]
                }));
                // Also send LOBBY_UPDATE immediately with current state
                ws.send(JSON.stringify({
                  type: 'LOBBY_UPDATE',
                  lobby: this.currentLobby
                }));
              } else {
                // Not in match, send normal queue status
                this.broadcastMergedQueue();
              }
            } else {
              // Normal: Send queue status
              this.broadcastMergedQueue();
            }
          }
        }

        // ... rest of handlers ...

        // JOIN_QUEUE - Add to LOCAL queue
        if (data.type === 'JOIN_QUEUE') {
          // Robust Join: Accept data from payload if available, or fallback to register data
          const userId = data.userId || currentUserId;
          const user = {
            id: userId,
            username: data.username || (currentUserData ? currentUserData.username : 'Unknown Player'),
            avatar: data.avatar || (currentUserData ? currentUserData.avatar : undefined),
            elo: data.elo || (currentUserData ? currentUserData.elo : 1000)
          };

          if (userId) {
            this.localQueue.set(userId, user);
            // console.log("User joined local queue:", userId);
            this.broadcastMergedQueue();
          }
        }



        // BAN_MAP - Captain bans a map
        if (data.type === 'BAN_MAP') {
          if (this.currentLobby && this.matchState === 'LOBBY') {
            const { map, team } = data;

            // Defensive: Ensure mapBanState exists
            if (!this.currentLobby.mapBanState) {
              this.currentLobby.mapBanState = {
                bannedMaps: [],
                currentBanTeam: 'alpha',
                banHistory: [],
                selectedMap: undefined,
                mapBanPhase: true,
                lastBanTimestamp: undefined,
                currentTurnStartTimestamp: Date.now(),
                banTimeout: 15
              };
            }

            const banState = this.currentLobby.mapBanState;

            // Defensive: Ensure arrays exist
            if (!banState.bannedMaps) banState.bannedMaps = [];
            if (!banState.banHistory) banState.banHistory = [];

            // Validate ban
            if (map && !banState.bannedMaps.includes(map) && banState.mapBanPhase) {
              // Add to banned maps
              banState.bannedMaps.push(map);

              // Add to ban history
              banState.banHistory.push({
                team: team || banState.currentBanTeam,
                map: map,
                timestamp: Date.now()
              });

              // Update last ban timestamp
              banState.lastBanTimestamp = Date.now();

              // Check if ban phase should end (6 maps banned, 1 remaining)
              const ALL_MAPS = ['Hanami', 'Rust', 'Zone 7', 'Dune', 'Breeze', 'Province', 'Sandstone'];
              if (banState.bannedMaps.length >= 6) {
                // Find remaining map
                const remainingMap = ALL_MAPS.find(m => !banState.bannedMaps.includes(m));
                if (remainingMap) {
                  banState.selectedMap = remainingMap;
                  banState.mapBanPhase = false;

                  // Start ready phase instead of immediately starting match
                  const readyPhaseState = this.currentLobby.readyPhaseState;
                  readyPhaseState.phaseActive = true;
                  readyPhaseState.readyPlayers = [];
                  readyPhaseState.readyPhaseStartTimestamp = Date.now();
                  readyPhaseState.readyPhaseTimeout = 30; // 30 seconds

                  // Save state before broadcasting
                  this.saveMatchState().then(() => {
                    this.broadcastToAll(JSON.stringify({
                      type: 'READY_PHASE_STARTED',
                      lobbyId: this.currentLobby.id,
                      selectedMap: remainingMap,
                      readyPhaseTimeout: 30
                    }));
                    // Also send LOBBY_UPDATE to sync state
                    this.broadcastLobbyUpdate();
                  });
                }
              } else {
                // Switch teams for next ban (alternating: alpha -> bravo -> alpha -> ...)
                const previousTeam = banState.currentBanTeam;
                banState.currentBanTeam = banState.currentBanTeam === 'alpha' ? 'bravo' : 'alpha';

                // Reset turn start timestamp when team switches
                if (previousTeam !== banState.currentBanTeam) {
                  banState.currentTurnStartTimestamp = Date.now();
                }
              }

              this.broadcastLobbyUpdate();
            }
          }
        }

        // PLAYER_READY - Player marks themselves as ready
        if (data.type === 'PLAYER_READY') {
          const userId = data.userId || currentUserId;
          if (!userId || !this.currentLobby) {
            return;
          }

          // Validate player is in the match
          const players = this.currentLobby.players || [];
          const player = players.find((p: any) => p.id === userId || p.discord_id === userId);

          if (!player) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              message: 'Player not in match'
            }));
            return;
          }

          // Check if ready phase is active
          const readyPhaseState = this.currentLobby.readyPhaseState;
          if (!readyPhaseState.phaseActive) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              message: 'Ready phase not active'
            }));
            return;
          }

          // Add player to ready list if not already present
          if (!readyPhaseState.readyPlayers.includes(userId)) {
            readyPhaseState.readyPlayers.push(userId);

            // Check if all players are ready
            const allPlayersReady = readyPhaseState.readyPlayers.length >= players.length;

            if (allPlayersReady) {
              // All players ready - trigger server creation
              readyPhaseState.phaseActive = false;
              this.matchState = 'GAME';

              // Broadcast ALL_PLAYERS_READY message
              await this.saveMatchState();
              this.broadcastToAll(JSON.stringify({
                type: 'ALL_PLAYERS_READY',
                lobbyId: this.currentLobby.id
              }));

              // Trigger server creation by notifying Discord Bot
              const botWs = this.userSockets.get('discord-bot');
              if (botWs) {
                botWs.send(JSON.stringify({
                  type: 'CREATE_MATCH',
                  lobbyId: this.currentLobby.id,
                  matchData: {
                    id: this.currentLobby.id,
                    lobbyId: this.currentLobby.id,
                    players: this.currentLobby.players,
                    teamAlpha: this.currentLobby.teamA,
                    teamBravo: this.currentLobby.teamB,
                    captainA: this.currentLobby.captainA,
                    captainB: this.currentLobby.captainB,
                    map: this.currentLobby.mapBanState?.selectedMap
                  }
                }));
                console.log('🎮 Sent CREATE_MATCH to Discord bot');
              } else {
                console.warn('⚠️ Discord bot not connected, cannot trigger match creation');
              }

              // For now, we'll wait for SERVER_CREATED message from Discord bot
              // When server is ready, we'll send MATCH_START
            } else {
              // Not all ready yet, just update state
              await this.saveMatchState();
              this.broadcastLobbyUpdate();
            }
          } else {
            // Player already ready, just send update
            this.broadcastLobbyUpdate();
          }
        }

        // SERVER_CREATED - Discord bot created game server via NeatQueue
        if (data.type === 'SERVER_CREATED') {
          if (this.currentLobby && data.lobbyId === this.currentLobby.id) {
            // Store server info in lobby
            this.currentLobby.serverInfo = data.serverInfo;

            // Save state
            await this.saveMatchState();

            // If all players are ready, send MATCH_START
            const readyPhaseState = this.currentLobby.readyPhaseState;
            const players = this.currentLobby.players || [];
            const allPlayersReady = readyPhaseState.readyPlayers.length >= players.length;

            if (allPlayersReady && this.matchState === 'GAME') {
              // Send MATCH_START with server info
              this.broadcastToAll(JSON.stringify({
                type: 'MATCH_START',
                lobbyId: this.currentLobby.id,
                selectedMap: this.currentLobby.mapBanState?.selectedMap,
                matchData: this.currentLobby,
                serverInfo: data.serverInfo
              }));
            } else {
              // Just send SERVER_READY (server ready but waiting for players)
              this.broadcastToAll(JSON.stringify({
                type: 'SERVER_READY',
                lobbyId: data.lobbyId,
                serverInfo: data.serverInfo
              }));
            }

            console.log('✅ Game server ready:', data.serverInfo);
          }
        }

        // SERVER_CREATION_FAILED - Failed to create server
        if (data.type === 'SERVER_CREATION_FAILED') {
          if (this.currentLobby && data.lobbyId === this.currentLobby.id) {
            // Notify all players
            this.broadcastToAll(JSON.stringify({
              type: 'SERVER_ERROR',
              lobbyId: data.lobbyId,
              error: data.error || 'Failed to create game server'
            }));

            console.error('❌ Server creation failed:', data.error);
          }
        }

        // LEAVE_QUEUE - Remove from LOCAL queue
        if (data.type === 'LEAVE_QUEUE') {
          const userId = data.userId || currentUserId;
          if (userId) {
            this.localQueue.delete(userId);
            this.broadcastMergedQueue();
          }
        }

        // SEND_INVITE: User A invites User B
        if (data.type === 'SEND_INVITE') {
          const { targetId, fromUser, lobbyId } = data; // fromUser contains { id, username, avatar }
          const targetWs = this.userSockets.get(targetId);

          if (targetWs && targetWs.readyState === WebSocket.READY_STATE_OPEN) {
            targetWs.send(JSON.stringify({
              type: 'INVITE_RECEIVED',
              fromUser: fromUser,
              lobbyId: lobbyId, // If inviting to a specific lobby
              timestamp: Date.now()
            }));
            // console.log(`Invite sent from ${fromUser.username} to ${targetId}`);
          } else {
            // Optional: Send back "User offline" message
          }
        }

        // FILL_BOTS: Fill queue with bots to reach 10 players and start match
        if (data.type === 'FILL_BOTS') {
          if (this.matchState !== 'IDLE') {
            // Already in a match, ignore
            return;
          }

          const merged = this.getMergedQueue();
          const currentCount = merged.length;
          const needed = 10 - currentCount;

          if (needed <= 0) {
            // Already have 10+, just start the match
            if (merged.length >= 10) {
              this.startMatch(merged.slice(0, 10));
            }
            return;
          }

          // Generate bot players
          const botNames = [
            'Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta', 'Bot Echo',
            'Bot Foxtrot', 'Bot Golf', 'Bot Hotel', 'Bot India', 'Bot Juliet'
          ];

          const bots = [];
          for (let i = 0; i < needed; i++) {
            const botId = `bot_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;
            bots.push({
              id: botId,
              discord_id: botId,
              username: botNames[i % botNames.length],
              name: botNames[i % botNames.length],
              avatar: undefined,
              elo: 1000 + Math.floor(Math.random() * 500) // Random ELO between 1000-1500
            });
          }

          // Combine real players with bots
          const allPlayers = [...merged, ...bots].slice(0, 10);

          // Start the match with filled players
          this.startMatch(allPlayers);
        }

        // REQUEST_MATCH_STATE: Request current match state by lobbyId
        if (data.type === 'REQUEST_MATCH_STATE') {
          const requestedLobbyId = data.lobbyId;
          const userId = currentUserId || data.userId;

          // Load from storage if not initialized or currentLobby is null
          if (!this.initialized || !this.currentLobby) {
            await this.loadMatchState();
          }

          if (this.currentLobby && this.currentLobby.id === requestedLobbyId) {
            // Check if user is in this match
            const players = this.currentLobby.players || [];
            const isUserInMatch = userId && players.some((p: any) => p.id === userId || p.discord_id === userId);

            if (isUserInMatch) {
              // User is in match, send appropriate state
              if (this.matchState === 'LOBBY') {
                // Send MATCH_READY to trigger navigation
                ws.send(JSON.stringify({
                  type: 'MATCH_READY',
                  lobbyId: this.currentLobby.id,
                  players: this.currentLobby.players,
                  captains: [this.currentLobby.captainA, this.currentLobby.captainB]
                }));
                // Also send LOBBY_UPDATE with current state
                ws.send(JSON.stringify({
                  type: 'LOBBY_UPDATE',
                  lobby: this.currentLobby
                }));
              } else if (this.matchState === 'GAME') {
                // Match has started, send MATCH_START
                ws.send(JSON.stringify({
                  type: 'MATCH_START',
                  lobbyId: this.currentLobby.id,
                  selectedMap: this.currentLobby.mapBanState?.selectedMap,
                  matchData: this.currentLobby
                }));
              }
            } else {
              // User not in match
              ws.send(JSON.stringify({
                type: 'MATCH_STATE_ERROR',
                error: 'User not in match',
                lobbyId: requestedLobbyId
              }));
            }
          } else {
            // Match doesn't exist or different lobbyId
            ws.send(JSON.stringify({
              type: 'MATCH_STATE_ERROR',
              error: 'Match not found',
              lobbyId: requestedLobbyId
            }));
          }
        }

        // DEBUG_DUMP: Request full state for debugging
        if (data.type === 'DEBUG_DUMP') {
          ws.send(JSON.stringify({
            type: 'DEBUG_STATE',
            localQueue: Array.from(this.localQueue.values()),
            remoteQueue: this.remoteQueue,
            currentLobby: this.currentLobby,
            matchState: this.matchState,
            timestamp: Date.now()
          }));
        }

        // RESET_MATCH: Force clear match state (Admin/Debug only)
        if (data.type === 'RESET_MATCH') {
          console.log('⚠️ RESET_MATCH requested! Clearing lobby state...');

          this.matchState = 'IDLE';
          this.currentLobby = null;
          this.state.storage.delete('matchState');
          this.state.storage.delete('currentLobby');

          // Broadcast update to all connected clients
          this.broadcastToAll(JSON.stringify({
            type: 'MATCH_RESET',
            timestamp: Date.now()
          }));

          // Force update queue status
          this.broadcastMergedQueue();
        }

      } catch (err) {
        console.error('WebSocket Error:', err);
      }
    });

    ws.addEventListener('close', () => {
      this.sessions.delete(ws);
      if (currentUserId) {
        this.userSockets.delete(currentUserId);
      }
    });
  }

  broadcastMergedQueue() {
    // Convert local map to array
    const localPlayers = Array.from(this.localQueue.values());

    // Combine lists (avoid duplicates if same user is in both)
    // We assume ID is common key. If NeatQueue uses Discord ID and we store Discord ID as `id`, it works.
    const merged = [...this.remoteQueue];

    localPlayers.forEach(lp => {
      // Avoid adding if already in remote (by ID)
      // Check both 'id' and 'discord_id' fields just in case
      const inRemote = merged.find(rp => rp.id === lp.id || rp.discord_id === lp.id);
      if (!inRemote) {
        merged.push(lp);
      }
    });

    const message = JSON.stringify({
      type: 'QUEUE_UPDATE',
      count: merged.length,
      players: merged,
      source: 'Merged'
    });

    this.broadcastToAll(message);
  }

  broadcastToAll(msg: string) {
    this.sessions.forEach(s => {
      try {
        if (s.readyState === WebSocket.READY_STATE_OPEN) s.send(msg);
      } catch (e) { /* ignore */ }
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

    // 3. Хэрэглэгчийг Database-д хадгалах
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
    } catch (dbError) {
      console.error('Database error:', dbError);
    }

    // 4. Хэрэглэгчийг Frontend рүү нь буцаах
    const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173';
    return c.redirect(
      `${frontendUrl}?id=${userData.id}&username=${userData.username}&avatar=${userData.avatar || ''}`
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
