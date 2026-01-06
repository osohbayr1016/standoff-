import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { matches, matchPlayers, eloHistory, players, clans, clanMembers } from '../db/schema';

interface Env {
    DB: D1Database;
    MATCH_QUEUE: DurableObjectNamespace;
    TURNSTILE_SECRET_KEY?: string;
}

const matchesRoutes = new Hono<{ Bindings: Env }>();

// ============= HELPERS =============

// Helper to retry D1 queries on network failure
async function queryWithRetry<T>(operation: () => Promise<T>, retries = 3, delay = 100): Promise<T> {
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (err: any) {
            const isNetworkError = err.message && (
                err.message.includes('Network connection lost') ||
                err.message.includes('D1_ERROR') ||
                err.message.includes('internal error')
            );

            if (i === retries - 1 || !isNetworkError) throw err;
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))); // Exponential backoff
        }
    }
    throw new Error('Retries failed');
}

async function getMatchPlayers(matchId: string, env: Env) {
    return queryWithRetry(async () => {
        const playersResult = await env.DB.prepare(`
            SELECT 
                mp.*,
                p.discord_username,
                p.discord_avatar,
                p.standoff_nickname,
                p.elo,
                p.role,
                p.is_discord_member,
                p.discord_id
            FROM match_players mp
            LEFT JOIN players p ON mp.player_id = p.id
            WHERE mp.match_id = ?
            ORDER BY mp.team, mp.joined_at
        `).bind(matchId).all();
        return playersResult.results || [];
    });
}

async function validateMatchAction(
    userId: string,
    matchType: string,
    env: Env,
    action: 'create' | 'join',
    matchData?: any
) {
    // 1. Fetch Player
    const player = await env.DB.prepare(
        'SELECT id, discord_id, banned, is_vip, vip_until, elo, role, discord_roles FROM players WHERE id = ? OR discord_id = ?'
    ).bind(userId, userId).first();

    if (!player) return { allowed: false, error: 'Player not found', status: 404 };
    if (player.banned === 1) return { allowed: false, error: 'You are banned from this action', status: 403 };

    // Check for existing active matches (waiting or in_progress)
    if (action === 'create') {
        const activeMatch = await env.DB.prepare(
            "SELECT id FROM matches WHERE host_id = ? AND status IN ('waiting', 'in_progress')"
        ).bind(userId).first();

        if (activeMatch) {
            return {
                allowed: false,
                error: 'You already have an active match. Please finish or cancel it before creating a new one.',
                status: 400
            };
        }
    }

    const isAdmin = player.role === 'admin';
    const isVip = player.is_vip === 1 || player.is_vip === true || String(player.is_vip) === '1' || String(player.is_vip) === 'true';
    const vipUntil = player.vip_until ? new Date(player.vip_until as string) : null;
    const now = new Date();
    const hasActiveVip = isVip && (!vipUntil || vipUntil > now);

    // 2. League Restrictions
    if (matchType === 'league') {
        if (!isAdmin && !hasActiveVip) {
            return { allowed: false, error: 'League matches require an active VIP membership. Contact an administrator to upgrade.', status: 403 };
        }

        const elo = (player.elo as number) || 1000; // Default to Level 3 (1000)
        let playerRank = 'Bronze';
        if (elo >= 2001) playerRank = 'Gold'; // Level 10
        else if (elo >= 1401) playerRank = 'Silver'; // Levels 6-9

        if (action === 'join' && matchData?.min_rank && playerRank !== matchData.min_rank) {
            return { allowed: false, error: `Rank mismatch. This lobby is for ${matchData.min_rank} players (You are ${playerRank}).`, status: 403 };
        }
    }

    // 3. Competitive Restrictions
    if (matchType === 'competitive') {
        const elo = (player.elo as number) || 1000;
        if (elo >= 2001) {
            return { allowed: false, error: 'Competitive matches are for Bronze/Silver players only (Elo < 2001). Gold players cannot participate.', status: 403 };
        }

        if (!isAdmin && !hasActiveVip) {
            const today = new Date().toISOString().split('T')[0];

            // Count completed matches
            const countResult = await env.DB.prepare(`
                SELECT COUNT(*) as count FROM matches m
                JOIN match_players mp ON m.id = mp.match_id
                WHERE (mp.player_id = ? OR mp.player_id = ?)
                AND m.match_type = 'competitive'
                AND m.status = 'completed'
                AND m.updated_at LIKE ?
            `).bind(player.id, player.discord_id, `${today}%`).first<{ count: number }>();

            // Get bonus matches from ad rewards
            const rewardResult = await env.DB.prepare(`
                SELECT COUNT(*) as count FROM reward_claims 
                WHERE user_id = ? AND reward_type = 'competitive_match' AND claimed_at LIKE ?
            `).bind(player.id, `${today}%`).first<{ count: number }>();

            const bonusMatches = rewardResult?.count || 0;
            const totalAllowed = 3 + bonusMatches;

            if ((countResult?.count || 0) >= totalAllowed) {
                return {
                    allowed: false,
                    error: bonusMatches >= 2
                        ? 'Daily limit reached (including bonus matches). Upgrade to VIP for unlimited access.'
                        : 'Daily limit reached. Basic members can play 3 competitive matches per day. You can watch an AD to get +1 match (limited twice) or upgrade to VIP for unlimited access.',
                    status: 403
                };
            }
        }
    }

    return { allowed: true, player };
}

async function notifyLobbyUpdate(matchId: string, env: Env, type: string = 'LOBBY_UPDATED', extraData: any = {}) {
    try {
        const players = await getMatchPlayers(matchId, env);
        const userIds = players.map((p: any) => p.player_id);

        if (userIds.length > 0) {
            const doId = env.MATCH_QUEUE.idFromName('global-matchmaking-v2');
            const doStub = env.MATCH_QUEUE.get(doId);

            await doStub.fetch('http://do/broadcast', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'LOBBY_ACTION',
                    data: {
                        userIds,
                        type,
                        matchId,
                        players,
                        ...extraData
                    }
                })
            });
        }
    } catch (err) {
        console.error('Error notifying lobby update:', err);
    }
}

async function notifyGlobalUpdate(env: Env, type: string = 'NEATQUEUE_LOBBY_CREATED') {
    try {
        const doId = env.MATCH_QUEUE.idFromName('global-matchmaking-v2');
        const doStub = env.MATCH_QUEUE.get(doId);
        await doStub.fetch('http://do/broadcast', {
            method: 'POST',
            body: JSON.stringify({
                type,
                data: {}
            })
        });
    } catch (err) {
        console.error('Error notifying global update:', err);
    }
}

// ============= MATCH CRUD =============

// Status-based cache for matches list
const matchesListCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 3000; // 3 seconds

// GET /api/matches - List all active matches
matchesRoutes.get('/', async (c) => {
    const status = c.req.query('status') || 'waiting';

    // Check Cache
    const cached = matchesListCache.get(status);
    const now = Date.now();
    if (cached && (now - cached.timestamp < CACHE_TTL)) {
        return c.json(cached.data);
    }

    try {
        const result = await c.env.DB.prepare(`
            SELECT 
                m.*,
                p.discord_username as host_username,
                p.discord_avatar as host_avatar,
                p.elo as host_elo,
                (SELECT COUNT(*) FROM match_players WHERE match_id = m.id) as current_players
            FROM matches m
            LEFT JOIN players p ON m.host_id = p.id
            WHERE m.status = ?
            ORDER BY m.created_at DESC
        `).bind(status).all();

        const matches = result.results || [];
        const matchIds = matches.map((m: any) => m.id);

        // Optimization: Batch fetch players in ONE query instead of N queries
        let allPlayers: any[] = [];
        if (matchIds.length > 0) {
            const placeholders = matchIds.map(() => '?').join(',');
            const playersResult = await c.env.DB.prepare(`
                SELECT 
                    mp.*,
                    p.discord_username,
                    p.discord_avatar,
                    p.standoff_nickname,
                    p.elo,
                    p.role,
                    p.is_discord_member,
                    p.discord_id
                FROM match_players mp
                LEFT JOIN players p ON mp.player_id = p.id
                WHERE mp.match_id IN (${placeholders})
                ORDER BY mp.team, mp.joined_at
            `).bind(...matchIds).all();
            allPlayers = playersResult.results || [];
        }

        // Map players back to their matches
        const matchesWithPlayers = matches.map((match: any) => {
            return {
                ...match,
                players: allPlayers.filter((p: any) => p.match_id === match.id)
            };
        });

        const responseData = {
            success: true,
            matches: matchesWithPlayers
        };

        // Update Cache
        matchesListCache.set(status, {
            data: responseData,
            timestamp: Date.now()
        });

        return c.json(responseData);
    } catch (error: any) {
        console.error('Error fetching matches:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// GET /api/matches/:id - Get single match details
matchesRoutes.get('/:id', async (c) => {
    const matchId = c.req.param('id');

    try {
        // Get match details with retry
        const matchResult = await queryWithRetry(async () => {
            return await c.env.DB.prepare(`
                SELECT 
                    m.*,
                    p.discord_username as host_username,
                    p.discord_avatar as host_avatar
                FROM matches m
                LEFT JOIN players p ON m.host_id = p.id
                WHERE m.id = ?
            `).bind(matchId).first();
        });

        if (!matchResult) {
            return c.json({ success: false, error: 'Match not found' }, 404);
        }

        // Check for Live State (Draft/MapBan) from Durable Object
        let liveState = null;
        if (matchResult.status === 'drafting' || matchResult.status === 'map_ban' || matchResult.status === 'waiting' || matchResult.status === 'in_progress') {
            try {
                const doId = c.env.MATCH_QUEUE.idFromName('global-matchmaking-v2');
                const doStub = c.env.MATCH_QUEUE.get(doId);
                const doRes = await doStub.fetch(`http://do/lobby/${matchId}`);

                if (doRes.ok) {
                    liveState = await doRes.json() as any;
                }
            } catch (e) {
                console.warn(`Failed to fetch live state for ${matchId}`, e);
            }
        }


        const players = await getMatchPlayers(matchId, c.env);

        // Calculate team stats
        let alphaElo = 0, alphaCount = 0;
        let bravoElo = 0, bravoCount = 0;

        players.forEach((p: any) => {
            if (p.team === 'alpha') {
                alphaElo += (p.elo || 1000);
                alphaCount++;
            } else if (p.team === 'bravo') {
                bravoElo += (p.elo || 1000);
                bravoCount++;
            }
        });

        return c.json({
            success: true,
            match: {
                ...matchResult,
                ...liveState, // Merge live state (draftState, mapBanState) over DB result
                alpha_avg_elo: alphaCount > 0 ? Math.round(alphaElo / alphaCount) : 1000,
                bravo_avg_elo: bravoCount > 0 ? Math.round(bravoElo / bravoCount) : 1000
            },
            players
        });
    } catch (error: any) {
        console.error('Error fetching match:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// GET /api/matches/user/:userId/active - Get user's active match
matchesRoutes.get('/user/:userId/active', async (c) => {
    const userId = c.req.param('userId');

    try {
        const activeMatch = await c.env.DB.prepare(`
            SELECT DISTINCT m.*
            FROM matches m
            JOIN match_players mp ON m.id = mp.match_id
            WHERE (mp.player_id = ? OR mp.player_id IN (SELECT discord_id FROM players WHERE id = ?))
            AND m.status IN ('waiting', 'in_progress', 'drafting')
            ORDER BY 
                CASE 
                    WHEN m.status IN ('drafting', 'in_progress') THEN 0 
                    ELSE 1 
                END ASC,
                m.created_at DESC
            LIMIT 1
        `).bind(userId, userId).first();

        return c.json({
            success: true,
            match: activeMatch || null
        });
    } catch (error: any) {
        console.error('Error fetching user active match:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/matches - Create new match/lobby
matchesRoutes.post('/', async (c) => {
    try {
        const body = await c.req.json<{
            lobby_url: string;
            host_id: string;
            map_name?: string;
            match_type?: 'casual' | 'league' | 'clan_lobby' | 'clan_war' | 'competitive';
            max_players?: number;
        }>();

        if (!body.lobby_url || !body.host_id) {
            return c.json({ success: false, error: 'lobby_url and host_id are required' }, 400);
        }

        const matchType = body.match_type || 'casual';

        // Unified Validation
        const validation = await validateMatchAction(body.host_id as string, matchType, c.env, 'create');
        if (!validation.allowed) {
            return c.json({ success: false, error: validation.error }, (validation.status || 400) as any);
        }

        const host = validation.player!;
        let clanId: string | null = null;
        let maxPlayers = body.max_players || 10;
        let minRank = null;

        if (matchType === 'league') {
            // Calculate Rank
            const elo = (host.elo as number) || 1000;
            if (elo >= 2001) minRank = 'Gold';
            else if (elo >= 1401) minRank = 'Silver';
            else minRank = 'Bronze';
        }

        if (matchType === 'clan_lobby' || matchType === 'clan_war') {
            const member = await c.env.DB.prepare('SELECT clan_id, role FROM clan_members WHERE user_id = ?').bind(body.host_id).first<{ clan_id: string, role: string }>();
            if (!member) return c.json({ success: false, error: 'You must be in a clan to start this match type' }, 403);

            if (matchType === 'clan_lobby') {
                if (!['leader', 'coleader'].includes(member.role)) return c.json({ success: false, error: 'Only Clan Leaders/Co-Leaders can start a lobby' }, 403);
                maxPlayers = 5;
            } else {
                // Clan War role check
                const CLAN_WAR_ROLE_ID = '1454773734073438362';
                let hasRequiredRole = false;
                try {
                    const roles = JSON.parse(host.discord_roles as string || '[]');
                    hasRequiredRole = Array.isArray(roles) && roles.includes(CLAN_WAR_ROLE_ID);
                } catch (e) { }

                if (!hasRequiredRole) return c.json({ success: false, error: 'You do not have permission to create Clan War lobbies.' }, 403);
                maxPlayers = 10;
            }
            clanId = member.clan_id;
        }

        // Check if host is already in an active match
        const existingMatch = await c.env.DB.prepare(`
            SELECT m.id FROM matches m
            JOIN match_players mp ON m.id = mp.match_id
            WHERE (mp.player_id = ? OR mp.player_id IN (SELECT discord_id FROM players WHERE id = ?)) AND m.status IN ('waiting', 'in_progress', 'queuing')
        `).bind(body.host_id, body.host_id).first();

        if (existingMatch) {
            return c.json({
                success: false,
                error: 'You are already in an active match',
                currentMatchId: existingMatch.id
            }, 400);
        }

        const matchId = crypto.randomUUID();

        // Create match (Atomic Batch)
        const insertMatch = c.env.DB.prepare(`
            INSERT INTO matches (id, lobby_url, host_id, map_name, match_type, status, player_count, max_players, min_rank, clan_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'waiting', 1, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(matchId, body.lobby_url, host.id, body.map_name || null, matchType, maxPlayers, minRank, clanId);

        // Add host as first player (alpha team, captain)
        const insertPlayer = c.env.DB.prepare(`
            INSERT INTO match_players (match_id, player_id, team, is_captain, joined_at)
            VALUES (?, ?, 'alpha', 1, datetime('now'))
        `).bind(matchId, host.id);

        await c.env.DB.batch([insertMatch, insertPlayer]);

        // Notify real-time
        await notifyGlobalUpdate(c.env);

        return c.json({
            success: true,
            matchId,
            message: 'Match created successfully'
        }, 201);
    } catch (error: any) {
        console.error('Error creating match:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/matches/:id/join - Join a match
matchesRoutes.post('/:id/join', async (c) => {
    const matchId = c.req.param('id');

    try {
        const body = await c.req.json<{
            player_id: string;
            team?: 'alpha' | 'bravo';
        }>();

        if (!body.player_id) {
            return c.json({ success: false, error: 'player_id is required' }, 400);
        }

        // Check if match exists and is waiting
        const match = await c.env.DB.prepare(
            'SELECT id, status, max_players, match_type, min_rank, clan_id FROM matches WHERE id = ? AND status = ?'
        ).bind(matchId, 'waiting').first();

        if (!match) {
            return c.json({ success: false, error: 'Match not found or not accepting players' }, 404);
        }

        // Unified Validation
        const validation = await validateMatchAction(body.player_id as string, match.match_type as string, c.env, 'join', match);
        if (!validation.allowed) {
            return c.json({ success: false, error: validation.error }, (validation.status || 400) as any);
        }

        const player = validation.player!;

        // Clan Lobby Restriction
        if (match.match_type === 'clan_lobby') {
            const member = await c.env.DB.prepare('SELECT clan_id FROM clan_members WHERE user_id = ?').bind(player.id).first<{ clan_id: string }>();
            if (!member || member.clan_id !== match.clan_id) {
                return c.json({ success: false, error: 'You must be a member of this clan to join the lobby' }, 403);
            }
        }

        // Clan War Restriction: Enforce 5v5 clan-based teams
        if (match.match_type === 'clan_war') {
            // Player must be in a clan
            const playerClan = await c.env.DB.prepare('SELECT clan_id FROM clan_members WHERE user_id = ?').bind(player.id).first<{ clan_id: string }>();
            if (!playerClan) {
                return c.json({ success: false, error: 'You must be in a clan to join Clan War matches' }, 403);
            }

            // Get host clan (Team Alpha)
            const hostClanId = match.clan_id as string;

            // Get all current players and their clans
            const currentPlayers = await c.env.DB.prepare(`
                SELECT mp.player_id, mp.team, cm.clan_id
                FROM match_players mp
                LEFT JOIN clan_members cm ON mp.player_id = cm.user_id
                WHERE mp.match_id = ?
            `).bind(matchId).all();

            // Determine opponent clan (Team Bravo)
            let opponentClanId: string | null = null;
            for (const p of (currentPlayers.results || [])) {
                const pClanId = (p as any).clan_id;
                if (pClanId && pClanId !== hostClanId) {
                    opponentClanId = pClanId;
                    break;
                }
            }

            // Determine which team this player should join
            let assignedTeam: 'alpha' | 'bravo';
            if (playerClan.clan_id === hostClanId) {
                // Player is from host clan -> Team Alpha
                assignedTeam = 'alpha';
            } else if (!opponentClanId) {
                // No opponent clan set yet, this player's clan becomes Team Bravo
                assignedTeam = 'bravo';
            } else if (playerClan.clan_id === opponentClanId) {
                // Player is from opponent clan -> Team Bravo
                assignedTeam = 'bravo';
            } else {
                // Player is from a third clan, not allowed
                return c.json({
                    success: false,
                    error: 'This Clan War is between two specific clans. You cannot join from a different clan.'
                }, 403);
            }

            // Override body.team for clan_war matches
            body.team = assignedTeam;
        }

        // Check if already in this match
        const existing = await c.env.DB.prepare(
            'SELECT id FROM match_players WHERE match_id = ? AND (player_id = ? OR player_id = ?)'
        ).bind(matchId, player.id, player.discord_id).first();

        if (existing) {
            return c.json({ success: false, error: 'Already in this match' }, 400);
        }

        // Check if player is in another active match
        const otherMatch = await c.env.DB.prepare(`
            SELECT m.id FROM matches m
            JOIN match_players mp ON m.id = mp.match_id
            WHERE (mp.player_id = ? OR mp.player_id = ?) AND m.status IN ('waiting', 'in_progress') AND m.id != ?
        `).bind(player.id, player.discord_id, matchId).first();

        if (otherMatch) {
            return c.json({ success: false, error: 'Already in another active match' }, 400);
        }

        // Count current players per team
        const teamCounts = await c.env.DB.prepare(`
            SELECT team, COUNT(*) as count FROM match_players 
            WHERE match_id = ? GROUP BY team
        `).bind(matchId).all();

        const counts = { alpha: 0, bravo: 0 };
        (teamCounts.results || []).forEach((r: any) => {
            if (r.team === 'alpha') counts.alpha = r.count;
            if (r.team === 'bravo') counts.bravo = r.count;
        });

        // Auto-assign team if not specified
        const assignedTeam = body.team || (counts.alpha <= counts.bravo ? 'alpha' : 'bravo');

        // Check max players
        if (counts.alpha + counts.bravo >= (match.max_players as number)) {
            return c.json({ success: false, error: 'Match is full' }, 400);
        }

        // Add player (Store the actual primary key/discord_id consistently)
        await c.env.DB.prepare(`
            INSERT INTO match_players (match_id, player_id, team, is_captain, joined_at)
            VALUES (?, ?, ?, 0, datetime('now'))
        `).bind(matchId, player.id, assignedTeam).run();

        // Update player count
        await c.env.DB.prepare(`
            UPDATE matches SET player_count = player_count + 1, updated_at = datetime('now')
            WHERE id = ?
        `).bind(matchId).run();

        // Check if lobby is full to AUTO-START
        const newTotal = counts.alpha + counts.bravo + 1; // current in DB before this + 1
        // Actually, we just updated the DB, so let's re-verify or use the logic. 
        // We know we added one.
        const maxPlayers = (match.max_players as number) || 10;

        if (newTotal >= maxPlayers && match.status === 'waiting' && (match.match_type === 'competitive' || match.match_type === 'league')) {
            // AUTO-START MATCH
            await startMatchInternal(matchId, match.match_type as string, c.env);
        } else {
            // Just notify update
            await notifyLobbyUpdate(matchId, c.env, 'PLAYER_JOINED');
        }

        return c.json({
            success: true,
            team: assignedTeam,
            message: 'Joined match successfully'
        });
    } catch (error: any) {
        console.error('Error joining match:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/matches/:id/leave - Leave a match
matchesRoutes.post('/:id/leave', async (c) => {
    const matchId = c.req.param('id');

    try {
        const body = await c.req.json<{ player_id: string }>();

        if (!body.player_id) {
            return c.json({ success: false, error: 'player_id is required' }, 400);
        }

        // Check if in match
        const membership = await c.env.DB.prepare(
            'SELECT id FROM match_players WHERE match_id = ? AND (player_id = ? OR player_id IN (SELECT discord_id FROM players WHERE id= ?))'
        ).bind(matchId, body.player_id, body.player_id).first();

        if (!membership) {
            return c.json({ success: false, error: 'Not in this match' }, 404);
        }

        // Check if match is still waiting
        const match = await c.env.DB.prepare(
            'SELECT host_id, status FROM matches WHERE id = ?'
        ).bind(matchId).first();

        if (!match || match.status !== 'waiting') {
            return c.json({ success: false, error: 'Cannot leave match in progress' }, 400);
        }

        // If host leaves, cancel the match
        if (match.host_id === body.player_id || (await c.env.DB.prepare('SELECT id FROM players WHERE id = ? AND discord_id = ?').bind(match.host_id, body.player_id).first())) {
            await c.env.DB.prepare(
                'UPDATE matches SET status = ?, updated_at = datetime(\'now\') WHERE id = ?'
            ).bind('cancelled', matchId).run();

            await c.env.DB.prepare(
                'DELETE FROM match_players WHERE match_id = ?'
            ).bind(matchId).run();

            await notifyLobbyUpdate(matchId, c.env, 'LOBBY_UPDATED');
            return c.json({
                success: true,
                message: 'Match cancelled (host left)'
            });
        }

        // Remove player
        await c.env.DB.prepare(
            'DELETE FROM match_players WHERE match_id = ? AND (player_id = ? OR player_id IN (SELECT discord_id FROM players WHERE id = ?))'
        ).bind(matchId, body.player_id, body.player_id).run();

        // Update player count
        await c.env.DB.prepare(`
            UPDATE matches SET player_count = player_count - 1, updated_at = datetime('now')
            WHERE id = ?
        `).bind(matchId).run();

        // Notify real-time
        await notifyLobbyUpdate(matchId, c.env, 'PLAYER_LEFT');

        return c.json({
            success: true,
            message: 'Left match successfully'
        });
    } catch (error: any) {
        console.error('Error leaving match:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/matches/:id/kick - Kick a player from match (host only)
matchesRoutes.post('/:id/kick', async (c) => {
    const matchId = c.req.param('id');

    try {
        const body = await c.req.json<{ player_id: string; host_id: string }>();

        if (!body.player_id || !body.host_id) {
            return c.json({ success: false, error: 'player_id and host_id are required' }, 400);
        }

        // Verify host
        const match = await c.env.DB.prepare(
            'SELECT host_id, status FROM matches WHERE id = ?'
        ).bind(matchId).first();

        if (!match) {
            return c.json({ success: false, error: 'Match not found' }, 404);
        }

        if (match.host_id !== body.host_id) {
            // Check if requester is admin/mod
            const requester = await c.env.DB.prepare('SELECT role FROM players WHERE id = ?').bind(body.host_id).first();
            const isStaff = requester?.role === 'admin' || requester?.role === 'moderator';

            if (!isStaff) {
                return c.json({ success: false, error: 'Only the host or staff can kick players' }, 403);
            }
        }

        if (match.status !== 'waiting') {
            return c.json({ success: false, error: 'Cannot kick players after match started' }, 400);
        }

        // Cannot kick host
        if (match.host_id === body.player_id) {
            return c.json({ success: false, error: 'Cannot kick the host' }, 400);
        }

        // Check if player is in match
        const membership = await c.env.DB.prepare(
            'SELECT id FROM match_players WHERE match_id = ? AND (player_id = ? OR player_id IN (SELECT discord_id FROM players WHERE id = ?))'
        ).bind(matchId, body.player_id, body.player_id).first();

        if (!membership) {
            return c.json({ success: false, error: 'Player not in this match' }, 404);
        }

        // Remove player
        await c.env.DB.prepare(
            'DELETE FROM match_players WHERE match_id = ? AND (player_id = ? OR player_id IN (SELECT discord_id FROM players WHERE id = ?))'
        ).bind(matchId, body.player_id, body.player_id).run();

        // Update player count
        await c.env.DB.prepare(`
            UPDATE matches SET player_count = player_count - 1, updated_at = datetime('now')
            WHERE id = ?
        `).bind(matchId).run();

        // Notify real-time
        await notifyLobbyUpdate(matchId, c.env, 'PLAYER_KICKED');

        return c.json({
            success: true,
            message: 'Player kicked successfully'
        });
    } catch (error: any) {
        console.error('Error kicking player:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/matches/:id/switch-team - Switch between teams
matchesRoutes.post('/:id/switch-team', async (c) => {
    const matchId = c.req.param('id');

    try {
        const body = await c.req.json<{ player_id: string }>();

        if (!body.player_id) {
            return c.json({ success: false, error: 'player_id is required' }, 400);
        }

        // Check if player is in match
        const membership = await c.env.DB.prepare(
            'SELECT team FROM match_players WHERE match_id = ? AND (player_id = ? OR player_id IN (SELECT discord_id FROM players WHERE id = ?))'
        ).bind(matchId, body.player_id, body.player_id).first();

        if (!membership) {
            return c.json({ success: false, error: 'Not in this match' }, 404);
        }

        // Check if match is still in waiting status
        const match = await c.env.DB.prepare(
            'SELECT status, max_players FROM matches WHERE id = ?'
        ).bind(matchId).first();

        if (!match || match.status !== 'waiting') {
            return c.json({ success: false, error: 'Cannot switch teams after match started' }, 400);
        }

        // Get current team and calculate new team
        const currentTeam = membership.team as string;
        const newTeam = currentTeam === 'alpha' ? 'bravo' : 'alpha';

        // Check if new team is full
        const newTeamCount = await c.env.DB.prepare(`
            SELECT COUNT(*) as count FROM match_players 
            WHERE match_id = ? AND team = ?
        `).bind(matchId, newTeam).first();

        const maxTeamSize = Math.floor((match.max_players as number || 10) / 2);
        if ((newTeamCount?.count as number) >= maxTeamSize) {
            return c.json({ success: false, error: `Team ${newTeam} is full (max ${maxTeamSize} players)` }, 400);
        }

        // Update team
        await c.env.DB.prepare(`
            UPDATE match_players SET team = ? 
            WHERE match_id = ? AND (player_id = ? OR player_id IN (SELECT discord_id FROM players WHERE id = ?))
        `).bind(newTeam, matchId, body.player_id, body.player_id).run();

        // Notify real-time
        await notifyLobbyUpdate(matchId, c.env, 'LOBBY_UPDATED');

        return c.json({
            success: true,
            newTeam,
            message: `Switched to team ${newTeam}`
        });
    } catch (error: any) {
        console.error('Error switching team:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// PATCH /api/matches/:id/status - Update match status (host only)
matchesRoutes.patch('/:id/status', async (c) => {
    const matchId = c.req.param('id');

    try {
        const body = await c.req.json<{
            host_id: string;
            status: 'in_progress' | 'cancelled';
        }>();

        // Verify host OR moderator/admin
        const match = await c.env.DB.prepare(
            'SELECT host_id, status, match_type FROM matches WHERE id = ?'
        ).bind(matchId).first();

        if (!match) {
            return c.json({ success: false, error: 'Match not found' }, 404);
        }

        const requester = await c.env.DB.prepare(
            'SELECT role FROM players WHERE id = ? OR discord_id = ?'
        ).bind(body.host_id, body.host_id).first<{ role: string }>();

        const isHost = match.host_id === body.host_id;
        const isMod = requester && (requester.role === 'moderator' || requester.role === 'admin');

        if (!isHost && !isMod) {
            return c.json({ success: false, error: 'Only host or moderator can update match status' }, 403);
        }

        // Validate status transition
        const validTransitions: Record<string, string[]> = {
            'waiting': ['in_progress', 'cancelled'],
            'drafting': ['cancelled'],
            'in_progress': match.match_type === 'casual' ? ['completed', 'cancelled'] : ['pending_review', 'cancelled']
        };

        const allowed = validTransitions[match.status as string] || [];
        if (!allowed.includes(body.status)) {
            return c.json({ success: false, error: `Cannot change status from ${match.status} to ${body.status}` }, 400);
        }

        // If starting match, verify at least 2 players
        if (body.status === 'in_progress') {
            const playerCount = await c.env.DB.prepare(
                'SELECT COUNT(*) as count FROM match_players WHERE match_id = ?'
            ).bind(matchId).first();

            const count = playerCount?.count as number || 0;
            // Get max_players from match
            const matchInfo = await c.env.DB.prepare(
                'SELECT max_players FROM matches WHERE id = ?'
            ).bind(matchId).first();
            const maxPlayers = (matchInfo?.max_players as number) || 10;

            if (count < maxPlayers) {
                return c.json({
                    success: false,
                    error: `Cannot start match with ${count} players. Need exactly ${maxPlayers} players.`
                }, 400);
            }

            // Start Match Logic (Draft or Normal)
            await startMatchInternal(matchId, match.match_type as string, c.env);

            return c.json({
                success: true,
                message: 'Match started successfully'
            });
        }

        // Handle other statuses (cancelled, completed)
        await c.env.DB.prepare(
            'UPDATE matches SET status = ?, updated_at = datetime(\'now\') WHERE id = ?'
        ).bind(body.status, matchId).run();

        // Notify real-time
        await notifyLobbyUpdate(matchId, c.env, 'LOBBY_UPDATED', { status: body.status });

        return c.json({
            success: true,
            message: 'Match status updated'
        });
    } catch (error: any) {
        console.error('Error updating match status:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// PATCH /api/matches/:id/link - Update match lobby link (host only)
matchesRoutes.patch('/:id/link', async (c) => {
    const matchId = c.req.param('id');

    try {
        const body = await c.req.json<{
            host_id: string;
            lobby_url: string;
        }>();

        if (!body.lobby_url) {
            return c.json({ success: false, error: 'lobby_url is required' }, 400);
        }

        // Verify host OR moderator/admin
        const match = await c.env.DB.prepare(
            'SELECT host_id, status FROM matches WHERE id = ?'
        ).bind(matchId).first();

        if (!match) {
            return c.json({ success: false, error: 'Match not found' }, 404);
        }

        const requester = await c.env.DB.prepare(
            'SELECT role FROM players WHERE id = ? OR discord_id = ?'
        ).bind(body.host_id, body.host_id).first<{ role: string }>();

        const isHost = match.host_id === body.host_id;
        const isMod = requester && (requester.role === 'moderator' || requester.role === 'admin');

        if (!isHost && !isMod) {
            return c.json({ success: false, error: 'Only host or moderator can update match link' }, 403);
        }

        if (match.status !== 'waiting') {
            return c.json({ success: false, error: 'Cannot update link after match started' }, 400);
        }

        await c.env.DB.prepare(
            'UPDATE matches SET lobby_url = ?, updated_at = datetime(\'now\') WHERE id = ?'
        ).bind(body.lobby_url, matchId).run();

        // Notify real-time
        await notifyLobbyUpdate(matchId, c.env, 'LOBBY_UPDATED');

        return c.json({
            success: true,
            message: 'Match link updated'
        });
    } catch (error: any) {
        console.error('Error updating match link:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/matches/:id/result - Submit match result (host only)
matchesRoutes.post('/:id/result', async (c) => {
    const matchId = c.req.param('id');

    try {
        const body = await c.req.json<{
            host_id: string;
            screenshot_url: string;
            winner_team: 'alpha' | 'bravo';
            alpha_score?: number;
            bravo_score?: number;
        }>();

        // Screenshot is optional for casual matches, required for league
        const match = await c.env.DB.prepare(
            'SELECT host_id, status, match_type FROM matches WHERE id = ?'
        ).bind(matchId).first();

        if (!match) {
            return c.json({ success: false, error: 'Match not found' }, 404);
        }

        // Validate screenshot requirement based on match type
        if ((match.match_type === 'league' || match.match_type === 'competitive') && !body.screenshot_url) {
            return c.json({ success: false, error: 'Screenshot is required for league and competitive matches' }, 400);
        }

        if (!body.winner_team) {
            return c.json({ success: false, error: 'winner_team is required' }, 400);
        }

        if (match.host_id !== body.host_id) {
            return c.json({ success: false, error: 'Only host can submit result' }, 403);
        }

        if (match.status !== 'in_progress') {
            return c.json({ success: false, error: 'Match must be in progress to submit result' }, 400);
        }

        // Update match with result
        await c.env.DB.prepare(`
            UPDATE matches 
            SET status = 'pending_review',
                result_screenshot_url = ?,
                winner_team = ?,
                alpha_score = ?,
                bravo_score = ?,
                updated_at = datetime('now')
            WHERE id = ?
        `).bind(
            body.screenshot_url,
            body.winner_team,
            body.alpha_score ?? 0,
            body.bravo_score ?? 0,
            matchId
        ).run();

        // Notify real-time
        await notifyLobbyUpdate(matchId, c.env, 'MATCH_COMPLETED');

        return c.json({
            success: true,
            message: 'Result submitted, pending moderator review'
        });
    } catch (error: any) {
        console.error('Error submitting result:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/matches/:id/queue - Queue for Clan Match (Host Only)
matchesRoutes.post('/:id/queue', async (c) => {
    const matchId = c.req.param('id');
    try {
        const body = await c.req.json<{ host_id: string }>();
        if (!body.host_id) return c.json({ error: 'host_id required' }, 400);

        // 1. Get Match
        const match = await c.env.DB.prepare('SELECT * FROM matches WHERE id = ?').bind(matchId).first();
        if (!match) return c.json({ error: 'Match not found' }, 404);

        // 2. Validate
        if (match.match_type !== 'clan_lobby') return c.json({ error: 'Only Clan Lobbies can queue' }, 400);
        if (match.host_id !== body.host_id) return c.json({ error: 'Only Host can queue' }, 403);
        if (match.player_count !== 5) return c.json({ error: 'Need exactly 5 players to queue' }, 400);
        if (match.status !== 'waiting') return c.json({ error: 'Lobby must be waiting' }, 400);

        // 3. Search for Opponent
        // Must be queuing, clan_lobby, diff ID, diff Clan? (Ideally differeny clan)
        // match.clan_id should be checked.
        const opponent = await c.env.DB.prepare(`
            SELECT * FROM matches 
            WHERE status = 'queuing' 
            AND match_type = 'clan_lobby' 
            AND id != ? 
            AND (clan_id != ? OR clan_id IS NULL)
            LIMIT 1
        `).bind(matchId, match.clan_id || 'same_clan_check').first();

        if (opponent) {
            // MATCH FOUND
            const gameId = crypto.randomUUID();

            // Create Game Match (10 Players)
            await c.env.DB.prepare(`
                INSERT INTO matches (id, lobby_url, host_id, map_name, match_type, status, player_count, max_players, clan_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'clan_match', 'waiting', 10, 10, ?, datetime('now'), datetime('now'))
            `).bind(gameId, 'pending', match.host_id, match.map_name, match.clan_id).run();

            // Move Team A (Alpha)
            await c.env.DB.prepare(`
                INSERT INTO match_players (match_id, player_id, team, is_captain, joined_at)
                SELECT ?, player_id, 'alpha', is_captain, datetime('now') FROM match_players WHERE match_id = ?
            `).bind(gameId, matchId).run();

            // Move Team B (Bravo)
            await c.env.DB.prepare(`
                INSERT INTO match_players (match_id, player_id, team, is_captain, joined_at)
                SELECT ?, player_id, 'bravo', is_captain, datetime('now') FROM match_players WHERE match_id = ?
            `).bind(gameId, opponent.id).run();

            // Update Lobbies status (Merged)
            await c.env.DB.prepare("UPDATE matches SET status = 'cancelled' WHERE id IN (?, ?)").bind(matchId, opponent.id).run();

            // Notify
            await notifyLobbyUpdate(matchId, c.env, 'MATCH_FOUND', { newMatchId: gameId });
            await notifyLobbyUpdate(opponent.id as string, c.env, 'MATCH_FOUND', { newMatchId: gameId });

            return c.json({ success: true, matchFound: true, newMatchId: gameId });

        } else {
            // No Opponent -> Set Queuing
            await c.env.DB.prepare("UPDATE matches SET status = 'queuing', updated_at = datetime('now') WHERE id = ?").bind(matchId).run();
            await notifyLobbyUpdate(matchId, c.env, 'LOBBY_UPDATED'); // Status changed
            return c.json({ success: true, matchFound: false, message: 'Queued for Clan Match' });
        }
    } catch (e: any) {
        return c.json({ success: false, error: e.message }, 500);
    }
});

// POST /api/matches/:id/balance - Balance teams by Elo (host only)
matchesRoutes.post('/:id/balance', async (c) => {
    const matchId = c.req.param('id');
    try {
        const body = await c.req.json<{ host_id: string }>();
        const match = await c.env.DB.prepare('SELECT host_id, status FROM matches WHERE id = ?').bind(matchId).first();
        if (!match || match.host_id !== body.host_id) return c.json({ success: false, error: 'Unauthorized' }, 403);
        if (match.status !== 'waiting') return c.json({ success: false, error: 'Cannot balance after match started' }, 400);

        const players = await getMatchPlayers(matchId, c.env);
        // Sort by Elo descending
        const sorted = [...players].sort((a: any, b: any) => (b.elo || 1000) - (a.elo || 1000));

        // Snake draft distribution
        const alpha: string[] = [];
        const bravo: string[] = [];

        sorted.forEach((p, i) => {
            if (i % 2 === 0) alpha.push(String(p.player_id));
            else bravo.push(String(p.player_id));
        });

        // Update DB
        const queries = [];
        for (const pid of alpha) {
            queries.push(c.env.DB.prepare('UPDATE match_players SET team = "alpha" WHERE match_id = ? AND player_id = ?').bind(matchId as string, String(pid)));
        }
        for (const pid of bravo) {
            queries.push(c.env.DB.prepare('UPDATE match_players SET team = "bravo" WHERE match_id = ? AND player_id = ?').bind(matchId as string, String(pid)));
        }

        if (queries.length > 0) {
            await c.env.DB.batch(queries);
        }

        await notifyLobbyUpdate(matchId, c.env);
        return c.json({ success: true, message: 'Teams balanced successfully' });
    } catch (e: any) {
        return c.json({ success: false, error: e.message }, 500);
    }
});



// POST /api/matches/:id/fill-bots - Fill match with bot players for testing (admin/host only)
matchesRoutes.post('/:id/fill-bots', async (c) => {
    const matchId = c.req.param('id');
    try {
        const body = await c.req.json<{ host_id: string }>();

        const match = await c.env.DB.prepare('SELECT host_id, max_players, status, match_type FROM matches WHERE id = ?').bind(matchId).first();
        if (!match) return c.json({ success: false, error: 'Match not found' }, 404);
        if (match.status !== 'waiting') return c.json({ success: false, error: 'Match already started' }, 400);

        const requester = await c.env.DB.prepare('SELECT role FROM players WHERE id = ?').bind(body.host_id).first();
        const isHost = match.host_id === body.host_id;
        const isAdmin = requester?.role === 'admin';

        if (!isHost && !isAdmin) {
            return c.json({ success: false, error: 'Only host or admin can fill with bots' }, 403);
        }

        const currentPlayers = await c.env.DB.prepare('SELECT COUNT(*) as count FROM match_players WHERE match_id = ?').bind(matchId).first();
        const currentCount = (currentPlayers?.count as number) || 0;
        const maxPlayers = (match.max_players as number) || 10;
        const botsNeeded = maxPlayers - currentCount;

        if (botsNeeded <= 0) {
            return c.json({ success: false, error: 'Match is already full' }, 400);
        }

        const botNames = ['AlphaBot', 'BravoBot', 'CharlieBot', 'DeltaBot', 'EchoBot', 'FoxtrotBot', 'GolfBot', 'HotelBot', 'IndiaBot', 'JulietBot'];
        const botPlayerQueries = [];
        const matchPlayerQueries = [];

        for (let i = 0; i < botsNeeded; i++) {
            const botId = `bot_${matchId}_${i}_${Date.now()}`;
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            const botName = `${botNames[i % botNames.length]} ${randomSuffix}`;
            const botElo = 800 + Math.floor(Math.random() * 600);
            const matchType = match.match_type as string;
            const team = (matchType === 'competitive' || matchType === 'league') ? null : (i % 2 === 0 ? 'alpha' : 'bravo');

            // Step 1: Create bot in players table
            botPlayerQueries.push(
                c.env.DB.prepare(`
                    INSERT OR REPLACE INTO players (id, discord_id, discord_username, standoff_nickname, elo, created_at, is_discord_member) 
                    VALUES (?, ?, ?, ?, ?, datetime('now'), 0)
                `).bind(botId, botId, botName, botName, botElo)
            );

            // Step 2: Add bot to match (will execute after players are created)
            matchPlayerQueries.push(
                c.env.DB.prepare(`
                    INSERT INTO match_players (match_id, player_id, team, is_captain, joined_at) 
                    VALUES (?, ?, ?, 0, datetime('now'))
                `).bind(matchId, botId, team)
            );
        }

        // Execute in TWO stages to ensure foreign key constraints are satisfied
        // Stage 1: Create all bot players
        await c.env.DB.batch(botPlayerQueries);

        // Stage 2: Add bots to match and update player count
        matchPlayerQueries.push(
            c.env.DB.prepare('UPDATE matches SET player_count = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(maxPlayers, matchId)
        );
        await c.env.DB.batch(matchPlayerQueries);

        const matchType = match.match_type as string;
        if (matchType === 'competitive' || matchType === 'league') {
            await startMatchInternal(matchId, matchType, c.env);
        } else {
            await notifyLobbyUpdate(matchId, c.env, 'LOBBY_UPDATED');
        }

        return c.json({ success: true, botsAdded: botsNeeded });
    } catch (e: any) {
        return c.json({ success: false, error: e.message }, 500);
    }
});

// Helper to start match (Draft or Normal)
async function startMatchInternal(matchId: string, matchType: string, env: any) {
    try {
        console.log(`[startMatchInternal] Starting match ${matchId} (${matchType})`);

        // If ALREADY in progress or drafting, ignore (concurrency safety)
        const current = await env.DB.prepare('SELECT status, map_name FROM matches WHERE id = ?').bind(matchId).first();
        console.log(`[startMatchInternal] Current status: ${current?.status}, Map: ${current?.map_name}`);

        if (current?.status !== 'waiting') {
            console.log(`[startMatchInternal] Skipping - status is ${current?.status}`);
            return;
        }

        if (matchType === 'league' || matchType === 'competitive') {
            const players = await getMatchPlayers(matchId, env);
            console.log(`[startMatchInternal] Found ${players.length} players`);

            // Sort by Elo (Descending)
            const sortedPlayers = [...players].sort((a: any, b: any) => (b.elo || 1000) - (a.elo || 1000));

            if (sortedPlayers.length >= 2) {
                const captainA = sortedPlayers[0];
                const captainB = sortedPlayers[1];

                // Update DB captains
                await env.DB.batch([
                    env.DB.prepare('UPDATE match_players SET is_captain = 1, team = "alpha" WHERE match_id = ? AND player_id = ?').bind(matchId, captainA.player_id),
                    env.DB.prepare('UPDATE match_players SET is_captain = 1, team = "bravo" WHERE match_id = ? AND player_id = ?').bind(matchId, captainB.player_id),
                ]);

                // Trigger Draft in DO
                const doId = env.MATCH_QUEUE.idFromName('global-matchmaking-v2');
                const doStub = env.MATCH_QUEUE.get(doId);

                const mapName = current?.map_name || "Sandstone"; // Fallback to avoid null errors

                console.log(`[startMatchInternal] Triggering draft on DO with map ${mapName}`);
                await doStub.fetch('http://do/broadcast', {
                    method: 'POST',
                    body: JSON.stringify({
                        type: 'START_DRAFT',
                        data: {
                            matchId,
                            captainAlpha: captainA,
                            captainBravo: captainB,
                            players: sortedPlayers,
                            mapName: mapName
                        }
                    })
                });
            }
        }

        let newStatus = 'in_progress';
        if (matchType === 'league' || matchType === 'competitive') {
            newStatus = 'drafting';
        }

        // Update Status to In Progress or Drafting
        await env.DB.prepare(
            'UPDATE matches SET status = ?, updated_at = datetime(\'now\') WHERE id = ?'
        ).bind(newStatus, matchId).run();

        const extraData: any = {
            status: newStatus, // DO will broadcast drafting if draft started
            startedAt: Date.now(),
            matchType: matchType
        };

        await notifyLobbyUpdate(matchId, env, 'LOBBY_UPDATED', extraData);
    } catch (e) {
        console.error(`[startMatchInternal] Failed:`, e);
        throw e;
    }
}

export { matchesRoutes };
