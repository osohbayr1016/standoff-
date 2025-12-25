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

// 1. Durable Object - Real-time системд хэрэгтэй
export class MatchQueueDO {
  sessions: Set<WebSocket> = new Set();
  userSockets: Map<string, WebSocket> = new Map(); // Global User Registry: UserId -> WebSocket
  localQueue: Map<string, any> = new Map(); // Local Web Users: ID -> { id, username, avatar, mmr }
  remoteQueue: any[] = []; // Cache of NeatQueue players

  constructor(public state: DurableObjectState, public env: any) { }

  async fetch(request: Request) {
    const url = new URL(request.url);
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

  matchState: 'IDLE' | 'LOBBY' | 'GAME' = 'IDLE';
  currentLobby: any = null;

  async alarm() {
    await this.syncWithNeatQueue(); // Updates this.remoteQueue
    const merged = this.getMergedQueue();

    // MATCH TRIGGER LOGIC
    // Threshold: 10 players (5v5)
    if (this.matchState === 'IDLE' && merged.length >= 10) {
      this.startMatch(merged.slice(0, 10)); // Top 10 players
    } else {
      // Just broadcast queue if match isn't starting
      this.broadcastMergedQueue();
    }

    // Schedule next run in 5 seconds
    const SECONDS = 5;
    await this.state.storage.setAlarm(Date.now() + SECONDS * 1000);
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

  startMatch(players: any[]) {
    console.log("Starting Match with:", players.length, "players");
    this.matchState = 'LOBBY';

    // Select Captains (Random for now, or highest MMR)
    // For test with 2 players, both are captains
    const captain1 = players[0];
    const captain2 = players[1] || players[0]; // Fallback

    this.currentLobby = {
      id: crypto.randomUUID(),
      players: players,
      captainA: captain1,
      captainB: captain2,
      teamA: [captain1],
      teamB: [captain2],
      readyPlayers: [], // Initialize ready list
      mapBanState: {
        step: 0,
        bannedMaps: [],
        turn: captain1.id // First turn to Captain A
      }
    };

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

  broadcastLobbyUpdate() {
    if (!this.currentLobby) return;

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
      const response = await fetch(
        `https://api.neatqueue.com/api/v1/queue/${this.env.DISCORD_CHANNEL_ID}/players`,
        {
          headers: {
            'Authorization': `Bearer ${this.env.NEATQUEUE_API_KEY}`
          }
        }
      );

      if (response.ok) {
        // Queue item: { id, name, ... } - check API spec for exact fields
        // API spec says "players currently in a queue channel", assuming array of objects
        const players = await response.json() as any[];

        // Update local cache
        this.remoteQueue = players || [];
        // Note: We do NOT broadcast here anymore; alarm() calls broadcastMergedQueue() immediately after.
      }
    } catch (e) {
      console.error("Failed to sync with NeatQueue:", e);
    }
  }

  handleSession(ws: WebSocket) {
    ws.accept();
    this.sessions.add(ws);

    // Ensure the alarm is running!
    this.state.storage.getAlarm().then(currentAlarm => {
      if (!currentAlarm) {
        // First connection starts the loop
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
              mmr: data.mmr
            };
            this.userSockets.set(data.userId, ws);
            // Confirm registration to client
            ws.send(JSON.stringify({ type: 'REGISTER_ACK', userId: data.userId }));

            // Catch-up: If match is already loading/started, send them to it
            if (this.matchState === 'LOBBY' && this.currentLobby) {
              ws.send(JSON.stringify({
                type: 'MATCH_READY',
                lobbyId: this.currentLobby.id,
                players: this.currentLobby.players,
                captains: [this.currentLobby.captainA, this.currentLobby.captainB]
              }));
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
            mmr: data.mmr || (currentUserData ? currentUserData.mmr : 1000)
          };

          if (userId) {
            this.localQueue.set(userId, user);
            // console.log("User joined local queue:", userId);
            this.broadcastMergedQueue();
          }
        }

        // PLAYER_READY - User confirms ready in Match Lobby
        if (data.type === 'PLAYER_READY') {
          if (this.currentLobby && (this.matchState === 'LOBBY' || this.matchState === 'GAME')) {
            // Defensive: Ensure readyPlayers array exists
            if (!this.currentLobby.readyPlayers) {
              this.currentLobby.readyPlayers = [];
            }

            // Validate userId exists
            const userId = data.userId;
            if (userId && !this.currentLobby.readyPlayers.includes(userId)) {
              this.currentLobby.readyPlayers.push(userId);
              this.broadcastLobbyUpdate();
            }
          }
        }

        // BAN_MAP - Captain bans a map
        if (data.type === 'BAN_MAP') {
          if (this.currentLobby && this.matchState === 'LOBBY') {
            const { map, team } = data;

            // Defensive: Ensure mapBanState exists
            if (!this.currentLobby.mapBanState) {
              this.currentLobby.mapBanState = {
                step: 0,
                bannedMaps: [],
                turn: this.currentLobby.captainA?.id || ''
              };
            }

            const banState = this.currentLobby.mapBanState;

            // Defensive: Ensure bannedMaps array exists
            if (!banState.bannedMaps) {
              banState.bannedMaps = [];
            }

            if (map && !banState.bannedMaps.includes(map)) {
              banState.bannedMaps.push(map);
              this.broadcastLobbyUpdate();
            }
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

// Setup profile routes
// Setup routes
setupProfileRoutes(app);
setupLeaderboardRoutes(app);
setupAdminRoutes(app);
setupFriendsRoutes(app);

app.get('/', (c) => c.text('Standoff 2 Platform API is Online!'));

// Discord OAuth2 Callback
app.get('/api/auth/callback', async (c) => {
  const code = c.req.query('code');

  if (!code) {
    return c.text("Code not found", 400);
  }

  try {
    // 1. Кодоо "Access Token" болгож солих
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: c.env.DISCORD_CLIENT_ID,
        client_secret: c.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: c.env.DISCORD_REDIRECT_URI,
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
        sent_redirect_uri: c.env.DISCORD_REDIRECT_URI
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


// NOTE: NeatQueue doesn't have a public API endpoint to add players to queue
// Players must use Discord bot commands (/join) to join the queue
// This endpoint is commented out as it's not supported by the official API
/*
app.post('/api/join-queue', async (c) => {
  try {
    const { userId } = await c.req.json();

    if (!userId) {
      return c.json({ success: false, message: "User ID шаардлагатай" }, 400);
    }

    // NeatQueue doesn't support this via API - users must use Discord commands
    return c.json({ 
      success: false, 
      message: "Please use Discord bot command /join to join the queue" 
    }, 501);
  } catch (error) {
    console.error('Join queue error:', error);
    return c.json({ 
      success: false, 
      message: "Дараалалд нэгдэх үед алдаа гарлаа" 
    }, 500);
  }
});
*/


// Get Live Queue Status - Дараалалд байгаа тоглогчдын тоо
app.get('/api/queue-status', async (c) => {
  try {
    const CHANNEL_ID = c.env.DISCORD_CHANNEL_ID || '';

    const response = await fetch(
      `https://api.neatqueue.com/api/v1/queue/${CHANNEL_ID}/players`,
      {
        headers: {
          'Authorization': `Bearer ${c.env.NEATQUEUE_API_KEY}`
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

// Old NeatQueue Leaderboard endpoint replacement by setupLeaderboardRoutes
/*
// Get Leaderboard - Шилдэг тоглогчдын жагсаалт
app.get('/api/leaderboard', async (c) => {
  try {
    const SERVER_ID = c.env.DISCORD_SERVER_ID || '';
    const CHANNEL_ID = c.env.DISCORD_CHANNEL_ID || '';

    const response = await fetch(
      `https://api.neatqueue.com/api/v2/leaderboard/${SERVER_ID}/${CHANNEL_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${c.env.NEATQUEUE_API_KEY}`
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      return c.json({
        success: true,
        leaderboard: data
      });
    } else {
      return c.json({ success: false, leaderboard: [] }, 400);
    }
  } catch (error) {
    console.error('Leaderboard error:', error);
    return c.json({ success: false, leaderboard: [] }, 500);
  }
});
*/

// Get Player Stats - Тоглогчийн статистик
app.get('/api/player-stats/:playerId', async (c) => {
  try {
    const playerId = c.req.param('playerId');
    const SERVER_ID = c.env.DISCORD_SERVER_ID || '';

    const response = await fetch(
      `https://api.neatqueue.com/api/v1/playerstats/${SERVER_ID}/${playerId}`,
      {
        headers: {
          'Authorization': `Bearer ${c.env.NEATQUEUE_API_KEY}`
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

export default {
  fetch: app.fetch,
  MatchQueueDO
};
