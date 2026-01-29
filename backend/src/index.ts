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

import { Env, DiscordTokenResponse, DiscordUser, DiscordGuildMember } from './types/shared';

// Re-export MatchQueueDO so Worker binding finds it
export { MatchQueueDO } from './durable-objects/MatchQueue';

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

// Debug Version Check (Public)
app.get('/api/debug-version', (c) => {
  return c.json({
    version: 'v7-public-check',
    timestamp: Date.now(),
    worker_url: c.req.url
  });
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

import { tournamentRoutes } from './routes/tournaments';
app.route('/api/tournaments', tournamentRoutes);

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

    const tokens = await tokenResponse.json() as DiscordTokenResponse;

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

    const userData = await userResponse.json() as DiscordUser;

    // 3. Check Discord roles and membership
    const requiredGuildId = c.env.DISCORD_SERVER_ID;
    const botToken = c.env.DISCORD_BOT_TOKEN;
    let isDiscordMember = false;
    let hasAdminRole = false;
    let hasVipRole = false;
    let hasModeratorRole = false;
    let tierElo = 1000;
    let discordRolesJson = '[]';

    // Server Profile Data
    let serverBanner: string | null | undefined = null;
    let serverAvatar: string | null | undefined = null;

    if (requiredGuildId && botToken) {
      try {
        // Fetch guild member info
        const memberResponse = await fetch(`https://discord.com/api/v10/guilds/${requiredGuildId}/members/${userData.id}`, {
          headers: {
            Authorization: `Bot ${botToken}`
          }
        });

        if (memberResponse.ok) {
          const memberData = await memberResponse.json() as DiscordGuildMember;
          isDiscordMember = true;
          const roles = memberData.roles || [];
          discordRolesJson = JSON.stringify(roles);

          // Capture Server Profile Data
          serverBanner = memberData.banner;
          serverAvatar = memberData.avatar;

          console.log(`[DEBUG] User ${userData.id} Discord Data:`, {
            globalBanner: userData.banner,
            globalAvatar: userData.avatar,
            globalAccentColor: userData.accent_color,
            serverBanner: memberData.banner,
            serverAvatar: memberData.avatar
          });

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

    // Determine finalized Banner/Avatar (Prioritize Server Profile)
    const finalBanner = serverBanner || userData.banner;
    const finalAvatar = serverAvatar || userData.avatar;
    const isGuildBanner = !!serverBanner;
    const isGuildAvatar = !!serverAvatar;

    // 4. Update Database
    // Define the type inline to avoid 'never' issues from typeof
    type PlayerDBRow = { role: string; elo: number; is_discord_member: number; created_at: string; is_vip: number; vip_until: string; discord_roles: string; gold: number; discord_banner: string; discord_accent_color: number; is_guild_banner: number; is_guild_avatar: number };
    let player: PlayerDBRow | null = null;
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
        `INSERT INTO players (id, discord_id, discord_username, discord_avatar, is_discord_member, role, is_vip, vip_until, elo, discord_roles, discord_banner, discord_accent_color, is_guild_banner, is_guild_avatar) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
         discord_banner = excluded.discord_banner,
         discord_accent_color = excluded.discord_accent_color,
         is_guild_banner = excluded.is_guild_banner,
         is_guild_avatar = excluded.is_guild_avatar,
         elo = CASE 
            WHEN excluded.elo > 1000 AND excluded.elo > players.elo THEN excluded.elo 
            ELSE players.elo 
          END`
      ).bind(
        userData.id,
        userData.id,
        userData.username,
        finalAvatar,
        isDiscordMember ? 1 : 0,
        roleToSet,
        hasVipRole ? 1 : 0,
        hasVipRole ? vipUntilDate : null,
        tierElo,
        discordRolesJson,
        finalBanner || null,
        userData.accent_color || null,
        isGuildBanner ? 1 : 0,
        isGuildAvatar ? 1 : 0
      ).run();

      const { results } = await c.env.DB.prepare(
        `SELECT role, elo, is_vip, vip_until, discord_roles, gold, discord_banner, discord_accent_color FROM players WHERE id = ?`
      ).bind(userData.id).all();

      if (results && results.length > 0) {
        player = results[0] as PlayerDBRow;

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
    const banner = player?.discord_banner || '';
    const accentColor = player?.discord_accent_color || '';

    return c.redirect(
      `${frontendUrl}?id=${userData.id}&username=${userData.username}&avatar=${userData.avatar || ''}&role=${role}&elo=${elo}&is_vip=${isVip}&vip_until=${vipUntil}&is_discord_member=${isMember === 1}&created_at=${createdAt}&discord_roles=${encodeURIComponent(String(discordRoles))}&gold=${gold}&banner=${banner}&accent_color=${accentColor}`
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
