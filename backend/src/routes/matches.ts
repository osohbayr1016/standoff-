import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';
import { matches, matchPlayers, eloHistory, players } from '../db/schema';

interface Env {
    DB: D1Database;
    MATCH_QUEUE: DurableObjectNamespace;
    TURNSTILE_SECRET_KEY?: string;
}

const matchesRoutes = new Hono<{ Bindings: Env }>();

// ============= HELPERS =============

async function notifyLobbyUpdate(matchId: string, env: Env, type: string = 'LOBBY_UPDATED') {
    try {
        // Get all players in this match
        const players = await env.DB.prepare(
            'SELECT player_id FROM match_players WHERE match_id = ?'
        ).bind(matchId).all();

        const userIds = (players.results || []).map((p: any) => p.player_id);

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
                        matchId
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
            WHERE mp.player_id = ? 
            AND m.status IN ('waiting', 'in_progress')
            ORDER BY m.created_at DESC
            LIMIT 1
        `).bind(userId).first();

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
            match_type?: 'casual' | 'league';
            max_players?: number;
        }>();

        if (!body.lobby_url || !body.host_id) {
            return c.json({ success: false, error: 'lobby_url and host_id are required' }, 400);
        }


        // Check if host exists
        const host = await c.env.DB.prepare(
            'SELECT id, banned, is_vip, vip_until FROM players WHERE id = ?'
        ).bind(body.host_id).first();

        if (!host) {
            return c.json({ success: false, error: 'Host not found' }, 404);
        }

        if (host.banned === 1) {
            return c.json({ success: false, error: 'You are banned from creating matches' }, 403);
        }

        const matchType = body.match_type || 'casual';

        // Check VIP status for League matches
        if (matchType === 'league') {
            const isVip = host.is_vip === 1 || host.is_vip === true;
            const isAdmin = host.role === 'admin';
            const vipUntil = host.vip_until ? new Date(host.vip_until as string) : null;
            const now = new Date();

            const hasActiveVip = isVip && vipUntil && vipUntil > now;

            if (!isAdmin && !hasActiveVip) {
                return c.json({
                    success: false,
                    error: 'League matches require an active VIP membership. Contact an administrator to upgrade.'
                }, 403);
            }
        }

        // Check if host is already in an active match
        const existingMatch = await c.env.DB.prepare(`
            SELECT m.id FROM matches m
            JOIN match_players mp ON m.id = mp.match_id
            WHERE mp.player_id = ? AND m.status IN ('waiting', 'in_progress')
        `).bind(body.host_id).first();

        if (existingMatch) {
            return c.json({
                success: false,
                error: 'You are already in an active match',
                currentMatchId: existingMatch.id
            }, 400);
        }

        const matchId = crypto.randomUUID();
        const maxPlayers = body.max_players || 10;

        // Create match
        await c.env.DB.prepare(`
            INSERT INTO matches (id, lobby_url, host_id, map_name, match_type, status, player_count, max_players, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'waiting', 1, ?, datetime('now'), datetime('now'))
        `).bind(matchId, body.lobby_url, body.host_id, body.map_name || null, matchType, maxPlayers).run();

        // Add host as first player (alpha team, captain)
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
            'SELECT * FROM matches WHERE id = ? AND status = ?'
        ).bind(matchId, 'waiting').first();

        if (!match) {
            return c.json({ success: false, error: 'Match not found or not accepting players' }, 404);
        }

        // Check if player exists and not banned
        const player = await c.env.DB.prepare(
            'SELECT id, banned FROM players WHERE id = ?'
        ).bind(body.player_id).first();

        if (!player) {
            return c.json({ success: false, error: 'Player not found' }, 404);
        }

        if (player.banned === 1) {
            return c.json({ success: false, error: 'You are banned from joining matches' }, 403);
        }

        // Check if already in this match
        const existing = await c.env.DB.prepare(
            'SELECT id FROM match_players WHERE match_id = ? AND player_id = ?'
        ).bind(matchId, body.player_id).first();

        if (existing) {
            return c.json({ success: false, error: 'Already in this match' }, 400);
        }

        // Check if player is in another active match
        const otherMatch = await c.env.DB.prepare(`
            SELECT m.id FROM matches m
            JOIN match_players mp ON m.id = mp.match_id
            WHERE mp.player_id = ? AND m.status IN ('waiting', 'in_progress') AND m.id != ?
        `).bind(body.player_id, matchId).first();

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

        // Add player
        await c.env.DB.prepare(`
            INSERT INTO match_players (match_id, player_id, team, is_captain, joined_at)
            VALUES (?, ?, ?, 0, datetime('now'))
        `).bind(matchId, body.player_id, assignedTeam).run();

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
            'SELECT id FROM match_players WHERE match_id = ? AND player_id = ?'
        ).bind(matchId, body.player_id).first();

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
        if (match.host_id === body.player_id) {
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
            'DELETE FROM match_players WHERE match_id = ? AND player_id = ?'
        ).bind(matchId, body.player_id).run();

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
            'SELECT id FROM match_players WHERE match_id = ? AND player_id = ?'
        ).bind(matchId, body.player_id).first();

        if (!membership) {
            return c.json({ success: false, error: 'Player not in this match' }, 404);
        }

        // Remove player
        await c.env.DB.prepare(
            'DELETE FROM match_players WHERE match_id = ? AND player_id = ?'
        ).bind(matchId, body.player_id).run();

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
            'SELECT team FROM match_players WHERE match_id = ? AND player_id = ?'
        ).bind(matchId, body.player_id).first();

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
            WHERE match_id = ? AND player_id = ?
        `).bind(newTeam, matchId, body.player_id).run();

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

        // Verify host
        const match = await c.env.DB.prepare(
            'SELECT host_id, status, match_type FROM matches WHERE id = ?'
        ).bind(matchId).first();

        if (!match) {
            return c.json({ success: false, error: 'Match not found' }, 404);
        }

        if (match.host_id !== body.host_id) {
            return c.json({ success: false, error: 'Only host can update match status' }, 403);
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
        await notifyLobbyUpdate(matchId, c.env, 'LOBBY_UPDATED');

        return c.json({
            success: true,
            message: 'Match status updated'
        });
    } catch (error: any) {
        console.error('Error updating match status:', error);
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

export { matchesRoutes };
