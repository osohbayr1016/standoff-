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

async function notifyLobbyUpdate(matchId: string, env: Env, type: string = 'LOBBY_UPDATED', extraData: any = {}) {
    try {
        // Get all players in this match with their Discord info
        const playersResult = await env.DB.prepare(`
            SELECT 
                mp.player_id as id,
                p.discord_username as username,
                p.discord_id
            FROM match_players mp
            LEFT JOIN players p ON mp.player_id = p.id
            WHERE mp.match_id = ?
        `).bind(matchId).all();

        const players = playersResult.results || [];
        const userIds = players.map((p: any) => p.id);

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
                        players, // Include full player list for DO state sync
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

// GET /api/matches - List all active matches
matchesRoutes.get('/', async (c) => {
    const db = drizzle(c.env.DB);
    const status = c.req.query('status') || 'waiting';

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

        // Fetch players for each match
        const matchesWithPlayers = await Promise.all(
            (result.results || []).map(async (match: any) => {
                const playersResult = await c.env.DB.prepare(`
                    SELECT 
                        mp.*,
                        p.discord_username,
                        p.discord_avatar,
                        p.standoff_nickname,
                        p.elo,
                        p.standoff_nickname,
                        p.elo,
                        p.standoff_nickname,
                        p.elo,
                        p.standoff_nickname,
                        p.elo,
                        p.discord_id,
                        p.is_discord_member,
                        p.is_discord_member,
                        p.is_discord_member
                    FROM match_players mp
                    LEFT JOIN players p ON mp.player_id = p.id
                    WHERE mp.match_id = ?
                    ORDER BY mp.team, mp.joined_at
                `).bind(match.id).all();

                return {
                    ...match,
                    players: playersResult.results || []
                };
            })
        );

        return c.json({
            success: true,
            matches: matchesWithPlayers
        });
    } catch (error: any) {
        console.error('Error fetching matches:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// GET /api/matches/:id - Get single match details
matchesRoutes.get('/:id', async (c) => {
    const matchId = c.req.param('id');

    try {
        // Get match details
        const matchResult = await c.env.DB.prepare(`
            SELECT 
                m.*,
                p.discord_username as host_username,
                p.discord_avatar as host_avatar
            FROM matches m
            LEFT JOIN players p ON m.host_id = p.id
            WHERE m.id = ?
        `).bind(matchId).first();

        if (!matchResult) {
            return c.json({ success: false, error: 'Match not found' }, 404);
        }

        // Get match players
        const playersResult = await c.env.DB.prepare(`
            SELECT 
                mp.*,
                p.discord_username,
                p.discord_avatar,
                p.standoff_nickname,
                p.elo,
                p.standoff_nickname,
                p.elo,
                p.standoff_nickname,
                p.elo,
                p.standoff_nickname,
                p.elo,
                p.role,
                p.is_discord_member,
                p.is_discord_member,
                p.is_discord_member
            FROM match_players mp
            LEFT JOIN players p ON mp.player_id = p.id
            WHERE mp.match_id = ?
            ORDER BY mp.team, mp.joined_at
        `).bind(matchId).all();

        return c.json({
            success: true,
            match: matchResult,
            players: playersResult.results || []
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
            AND m.status IN ('waiting', 'in_progress')
            ORDER BY m.created_at DESC
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


        // Check if host exists
        const host = await c.env.DB.prepare(
            'SELECT id, banned, is_vip, vip_until, elo, role, discord_roles FROM players WHERE id = ? OR discord_id = ?'
        ).bind(body.host_id, body.host_id).first();

        if (!host) {
            return c.json({ success: false, error: 'Host not found' }, 404);
        }

        if (host.banned === 1) {
            return c.json({ success: false, error: 'You are banned from creating matches' }, 403);
        }

        const matchType = body.match_type || 'casual';
        let clanId: string | null = null;
        let maxPlayers = body.max_players || 10;
        let minRank = null;


        // Check VIP status for League matches
        if (matchType === 'league') {
            const isVip = host.is_vip === 1 || host.is_vip === true || host.is_vip === '1' || host.is_vip === 'true';
            const isAdmin = host.role === 'admin';
            const vipUntil = host.vip_until ? new Date(host.vip_until as string) : null;
            const now = new Date();

            // Allow if isVip is true AND (either no expiry date OR expiry is in the future)
            const hasActiveVip = isVip && (!vipUntil || vipUntil > now);

            if (!isAdmin && !hasActiveVip) {
                return c.json({
                    success: false,
                    error: 'League matches require an active VIP membership. Contact an administrator to upgrade.'
                }, 403);
            }

            // Calculate Rank
            const elo = (host.elo as number) || 1000;
            if (elo >= 1600) minRank = 'Gold'; // Harmonized to 1600
            else if (elo >= 1201) minRank = 'Silver';
            else minRank = 'Bronze';
        }

        // Competitive Match Logic
        if (matchType === 'competitive') {
            // 1. Elo Check: Host must be < 1600
            const elo = (host.elo as number) || 1000;
            if (elo >= 1600) {
                return c.json({
                    success: false,
                    error: 'Competitive matches are for Bronze/Silver players only (Elo < 1600). Gold players cannot participate.'
                }, 403);
            }

            // 2. Daily Limit Check for Free Users
            const isVip = host.is_vip === 1 || host.is_vip === true || host.is_vip === '1' || host.is_vip === 'true';
            const vipUntil = host.vip_until ? new Date(host.vip_until as string) : null;
            const now = new Date();
            const hasActiveVip = isVip && (!vipUntil || vipUntil > now);
            const isAdmin = host.role === 'admin';

            if (!isAdmin && !hasActiveVip) {
                const today = new Date().toISOString().split('T')[0];
                const countResult = await c.env.DB.prepare(`
                    SELECT COUNT(*) as count FROM matches m
                    JOIN match_players mp ON m.id = mp.match_id
                    WHERE (mp.player_id = ? OR mp.player_id = ?)
                    AND m.match_type = 'competitive'
                    AND m.status = 'completed'
                    AND m.updated_at LIKE ?
                `).bind(body.host_id, body.host_id, `${today}%`).first<{ count: number }>();

                // Get bonus matches from ad rewards
                const rewardResult = await c.env.DB.prepare(`
                    SELECT COUNT(*) as count FROM reward_claims 
                    WHERE user_id = ? AND reward_type = 'competitive_match' AND claimed_at LIKE ?
                `).bind(body.host_id, `${today}%`).first<{ count: number }>();

                const bonusMatches = rewardResult?.count || 0;
                const totalAllowed = 3 + bonusMatches;

                if ((countResult?.count || 0) >= totalAllowed) {
                    return c.json({
                        success: false,
                        error: bonusMatches >= 2
                            ? 'Daily limit reached (including bonus matches). Upgrade to VIP for unlimited access.'
                            : 'Daily limit reached. Basic members can play 3 competitive matches per day. You can watch an AD to get +1 match (limited twice) or upgrade to VIP for unlimited access.'
                    }, 403);
                }
            }
        }

        if (matchType === 'clan_lobby') {
            const member = await c.env.DB.prepare('SELECT clan_id, role FROM clan_members WHERE user_id = ?').bind(body.host_id).first<{ clan_id: string, role: string }>();
            if (!member) return c.json({ success: false, error: 'You must be in a clan to start a Clan Lobby' }, 403);
            if (!['leader', 'coleader'].includes(member.role)) return c.json({ success: false, error: 'Only Clan Leaders/Co-Leaders can start a lobby' }, 403);

            clanId = member.clan_id;
            maxPlayers = 5; // Clan Lobby is for 5 members
        }

        // Clan War: 5v5 Clan vs Clan matches
        if (matchType === 'clan_war') {
            // Check if host has required Discord role (1454773734073438362)
            const CLAN_WAR_ROLE_ID = '1454773734073438362';
            let hasRequiredRole = false;

            try {
                const rolesJson = host.discord_roles as string | null;
                if (rolesJson) {
                    const roles = JSON.parse(rolesJson);
                    hasRequiredRole = Array.isArray(roles) && roles.includes(CLAN_WAR_ROLE_ID);
                }
            } catch (e) {
                console.error('Error parsing discord_roles:', e);
            }

            if (!hasRequiredRole) {
                return c.json({
                    success: false,
                    error: 'You do not have permission to create Clan War lobbies. Contact an administrator.'
                }, 403);
            }

            // Check if host is in a clan
            const member = await c.env.DB.prepare('SELECT clan_id FROM clan_members WHERE user_id = ?').bind(body.host_id).first<{ clan_id: string }>();
            if (!member) {
                return c.json({ success: false, error: 'You must be in a clan to create a Clan War lobby' }, 403);
            }

            clanId = member.clan_id;
            maxPlayers = 10; // Clan War is 5v5
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

        // Create match
        await c.env.DB.prepare(`
            INSERT INTO matches (id, lobby_url, host_id, map_name, match_type, status, player_count, max_players, min_rank, clan_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'waiting', 1, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(matchId, body.lobby_url, body.host_id, body.map_name || null, matchType, maxPlayers, minRank, clanId).run();

        // Add host as first player (alpha team, captain) - For Clan Lobby, team is irrelevant initially, but let's say 'alpha'
        await c.env.DB.prepare(`
            INSERT INTO match_players (match_id, player_id, team, is_captain, joined_at)
            VALUES (?, ?, 'alpha', 1, datetime('now'))
        `).bind(matchId, body.host_id).run();

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

        // Check if player exists and not banned
        const player = await c.env.DB.prepare(
            'SELECT id, discord_id, banned, is_vip, vip_until, role, elo FROM players WHERE id = ? OR discord_id = ?'
        ).bind(body.player_id, body.player_id).first<{
            id: string;
            discord_id: string;
            banned: number;
            is_vip: any;
            vip_until: string | null;
            role: string;
            elo: number;
        }>();

        if (!player) {
            return c.json({ success: false, error: 'Player not found' }, 404);
        }

        if (player.banned === 1) {
            return c.json({ success: false, error: 'You are banned from joining matches' }, 403);
        }

        // ============================================
        // Start: Faceit-style Restrictions (VIP & Rank)
        // ============================================
        if (match.match_type === 'league') {
            // 1. VIP Check
            const isVip = player.is_vip === 1 || player.is_vip === true || String(player.is_vip) === '1' || String(player.is_vip) === 'true';
            const isAdmin = player.role === 'admin';
            const vipUntil = player.vip_until ? new Date(player.vip_until) : null;
            const now = new Date();

            const hasActiveVip = isVip && (!vipUntil || vipUntil > now);

            if (!isAdmin && !hasActiveVip) {
                return c.json({
                    success: false,
                    error: 'VIP status required to join League matches. Please upgrade to VIP.'
                }, 403);
            }

            // 2. Rank Check (Min Rank Enforcement)
            if (match.min_rank) {
                const playerElo = player.elo || 1000;
                let playerRank = 'Bronze';
                if (playerElo >= 1600) playerRank = 'Gold'; // Harmonized to 1600
                else if (playerElo >= 1200) playerRank = 'Silver';

                if (playerRank !== match.min_rank) {
                    return c.json({
                        success: false,
                        error: `Rank mismatch. This lobby is for ${match.min_rank} players (You are ${playerRank}).`
                    }, 403);
                }
            }
        }

        // Competitive Match Logic
        if (match.match_type === 'competitive') {
            // 1. Elo Check: Player must be < 1600
            const elo = (player.elo as number) || 1000;
            if (elo >= 1600) {
                return c.json({
                    success: false,
                    error: 'Competitive matches are for Bronze/Silver players only (Elo < 1600). Gold players cannot participate.'
                }, 403);
            }

            // 2. Daily Limit Check for Free Users
            const isVip = player.is_vip === 1 || player.is_vip === true || String(player.is_vip) === '1' || String(player.is_vip) === 'true';
            const vipUntil = player.vip_until ? new Date(player.vip_until) : null;
            const now = new Date();
            const hasActiveVip = isVip && (!vipUntil || vipUntil > now);
            const isAdmin = player.role === 'admin';

            if (!isAdmin && !hasActiveVip) {
                const today = new Date().toISOString().split('T')[0];
                const countResult = await c.env.DB.prepare(`
                     SELECT COUNT(*) as count FROM matches m
                     JOIN match_players mp ON m.id = mp.match_id
                     WHERE (mp.player_id = ? OR mp.player_id = ?)
                     AND m.match_type = 'competitive'
                     AND m.status = 'completed'
                     AND m.updated_at LIKE ?
                 `).bind(player.id, player.discord_id, `${today}%`).first<{ count: number }>();

                if ((countResult?.count || 0) >= 3) {
                    return c.json({
                        success: false,
                        error: 'Daily limit reached. Basic members can only play 3 competitive matches per day. Upgrade to VIP for unlimited access.'
                    }, 403);
                }
            }
        }
        // ============================================
        // End: Faceit-style Restrictions
        // ============================================

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

        // Notify real-time
        await notifyLobbyUpdate(matchId, c.env, 'PLAYER_JOINED');

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
            return c.json({ success: false, error: 'Only the host can kick players' }, 403);
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
        }

        await c.env.DB.prepare(
            'UPDATE matches SET status = ?, updated_at = datetime(\'now\') WHERE id = ?'
        ).bind(body.status, matchId).run();

        // Notify real-time
        const extraData: any = { status: body.status };
        if (body.status === 'in_progress') {
            extraData.startedAt = Date.now();
            extraData.matchType = match.match_type;
        }
        await notifyLobbyUpdate(matchId, c.env, 'LOBBY_UPDATED', extraData);

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
        if (match.match_type === 'league' && !body.screenshot_url) {
            return c.json({ success: false, error: 'Screenshot is required for league matches' }, 400);
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
            body.alpha_score || null,
            body.bravo_score || null,
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

export { matchesRoutes };
