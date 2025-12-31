import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, and, sql } from 'drizzle-orm';
import { matches, matchPlayers, eloHistory, players, clans, clanMembers } from '../db/schema';

interface Env {
    DB: D1Database;
    DISCORD_BOT_TOKEN: string;
    DISCORD_SERVER_ID: string;
}

const moderatorRoutes = new Hono<{ Bindings: Env }>();

// Discord Tier Role IDs
const TIERS = {
    GOLD: '1454095406446153839',   // 1600+
    SILVER: '1454150874531234065', // 1200+
    BRONZE: '1454150924556570624', // 1000+
    VIP: '1454234806933258382'
};

const updateDiscordRole = async (env: Env, userId: string, roleId: string, add: boolean) => {
    try {
        await fetch(
            `https://discord.com/api/v10/guilds/${env.DISCORD_SERVER_ID}/members/${userId}/roles/${roleId}`,
            {
                method: add ? 'PUT' : 'DELETE',
                headers: {
                    'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
                    'Content-Type': 'application/json',
                }
            }
        );
    } catch (err) {
        console.error(`Error ${add ? 'adding' : 'removing'} Discord role ${roleId}:`, err);
    }
};

const syncDiscordTiers = async (env: Env, userId: string, newElo: number) => {
    let targetRole = TIERS.BRONZE;
    if (newElo >= 1600) targetRole = TIERS.GOLD;
    else if (newElo >= 1200) targetRole = TIERS.SILVER;

    // Remove other tier roles and add the target one
    const rolesToRemove = [TIERS.GOLD, TIERS.SILVER, TIERS.BRONZE].filter(r => r !== targetRole);

    for (const roleId of rolesToRemove) {
        await updateDiscordRole(env, userId, roleId, false);
    }
    await updateDiscordRole(env, userId, targetRole, true);
};

// Middleware to check moderator role
const requireModerator = async (c: any, next: () => Promise<void>) => {
    const userId = c.req.header('X-User-Id');

    if (!userId) {
        return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const user = await c.env.DB.prepare(
        'SELECT role FROM players WHERE id = ? OR discord_id = ?'
    ).bind(userId, userId).first();

    if (!user || (user.role !== 'moderator' && user.role !== 'admin')) {
        return c.json({ success: false, error: 'Moderator access required' }, 403);
    }

    await next();
};

// Apply middleware to all routes
moderatorRoutes.use('*', requireModerator);

// ============= PENDING REVIEWS =============

// GET /api/moderator/pending-reviews - Get matches pending review
moderatorRoutes.get('/pending-reviews', async (c) => {
    try {
        const result = await c.env.DB.prepare(`
            SELECT 
                m.*,
                p.discord_username as host_username,
                p.discord_avatar as host_avatar,
                (SELECT COUNT(*) FROM match_players WHERE match_id = m.id) as player_count
            FROM matches m
            LEFT JOIN players p ON m.host_id = p.id
            WHERE m.status = 'pending_review'
            ORDER BY m.updated_at ASC
        `).all();

        return c.json({
            success: true,
            matches: result.results || []
        });
    } catch (error: any) {
        console.error('Error fetching pending reviews:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// GET /api/moderator/cancelled-matches - Get cancelled league lobbies
moderatorRoutes.get('/cancelled-matches', async (c) => {
    try {
        const result = await c.env.DB.prepare(`
            SELECT 
                m.*,
                p.discord_username as host_username,
                p.discord_avatar as host_avatar
            FROM matches m
            LEFT JOIN players p ON m.host_id = p.id
            WHERE m.status = 'cancelled' AND m.match_type = 'league'
            ORDER BY m.updated_at DESC
            LIMIT 50
        `).all();

        return c.json({
            success: true,
            matches: result.results || []
        });
    } catch (error: any) {
        console.error('Error fetching cancelled matches:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// GET /api/moderator/active-matches - Get active matches
moderatorRoutes.get('/active-matches', async (c) => {
    try {
        const result = await c.env.DB.prepare(`
            SELECT 
                m.*,
                p.discord_username as host_username,
                p.discord_avatar as host_avatar,
                (SELECT COUNT(*) FROM match_players WHERE match_id = m.id) as player_count
            FROM matches m
            LEFT JOIN players p ON m.host_id = p.id
            WHERE m.status IN ('in_progress', 'waiting')
            ORDER BY m.created_at DESC
        `).all();

        return c.json({
            success: true,
            matches: result.results || []
        });
    } catch (error: any) {
        console.error('Error fetching active matches:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// GET /api/moderator/matches/:id - Get full match details for review
moderatorRoutes.get('/matches/:id', async (c) => {
    const matchId = c.req.param('id');

    try {
        // Get match details
        const match = await c.env.DB.prepare(`
            SELECT 
                m.*,
                p.discord_username as host_username,
                p.discord_avatar as host_avatar,
                reviewer.discord_username as reviewer_username
            FROM matches m
            LEFT JOIN players p ON m.host_id = p.id
            LEFT JOIN players reviewer ON m.reviewed_by = reviewer.id
            WHERE m.id = ?
        `).bind(matchId).first();

        if (!match) {
            return c.json({ success: false, error: 'Match not found' }, 404);
        }

        // Get all players with their current ELO
        const playersResult = await c.env.DB.prepare(`
            SELECT 
                mp.*,
                p.discord_username,
                p.discord_avatar,
                p.standoff_nickname,
                p.elo,
                p.wins,
                p.losses
            FROM match_players mp
            LEFT JOIN players p ON mp.player_id = p.id
            WHERE mp.match_id = ?
            ORDER BY mp.team, mp.is_captain DESC
        `).bind(matchId).all();

        return c.json({
            success: true,
            match,
            players: playersResult.results || []
        });
    } catch (error: any) {
        console.error('Error fetching match for review:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/moderator/matches/:id/review - Approve/reject match and apply ELO
moderatorRoutes.post('/matches/:id/review', async (c) => {
    const matchId = c.req.param('id');
    const moderatorId = c.req.header('X-User-Id');

    try {
        const body = await c.req.json<{
            approved: boolean;
            winner_team?: 'alpha' | 'bravo';
            alpha_score?: number;
            bravo_score?: number;
            elo_change?: number;
            notes?: string;
        }>();

        // Get match
        const match = await c.env.DB.prepare(
            'SELECT * FROM matches WHERE id = ? AND status = ?'
        ).bind(matchId, 'pending_review').first();

        if (!match) {
            return c.json({ success: false, error: 'Match not found or not pending review' }, 404);
        }

        if (!body.approved) {
            // Reject - set back to in_progress or cancelled
            await c.env.DB.prepare(`
                UPDATE matches 
                SET status = 'cancelled',
                    reviewed_by = ?,
                    reviewed_at = datetime('now'),
                    review_notes = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `).bind(moderatorId, body.notes || 'Rejected by moderator', matchId).run();

            return c.json({
                success: true,
                message: 'Match rejected'
            });
        }

        // Approved - Apply ELO changes
        const winnerTeam = body.winner_team || match.winner_team;
        const eloChange = body.elo_change || 25; // Default ELO change

        if (!winnerTeam) {
            return c.json({ success: false, error: 'Winner team is required' }, 400);
        }

        // Get all players in match
        const matchPlayersResult = await c.env.DB.prepare(`
            SELECT mp.player_id, mp.team, p.elo
            FROM match_players mp
            LEFT JOIN players p ON mp.player_id = p.id
            WHERE mp.match_id = ?
        `).bind(matchId).all();

        const playersList = matchPlayersResult.results || [];

        // Apply ELO changes
        for (const player of playersList) {
            const isWinner = player.team === winnerTeam;
            const change = isWinner ? eloChange : -eloChange;
            const newElo = Math.max(0, (player.elo as number) + change);
            const reason = isWinner ? 'match_win' : 'match_loss';

            // Update player ELO and stats
            if (isWinner) {
                await c.env.DB.prepare(`
                    UPDATE players SET elo = ?, wins = wins + 1 WHERE id = ?
                `).bind(newElo, player.player_id).run();
            } else {
                await c.env.DB.prepare(`
                    UPDATE players SET elo = ?, losses = losses + 1 WHERE id = ?
                `).bind(newElo, player.player_id).run();
            }

            // Record ELO history
            await c.env.DB.prepare(`
                INSERT INTO elo_history (user_id, match_id, elo_before, elo_after, elo_change, reason, created_by, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `).bind(
                player.player_id,
                matchId,
                player.elo,
                newElo,
                change,
                reason,
                moderatorId,
                body.notes || null
            ).run();

            // Sync Discord Tiers
            await syncDiscordTiers(c.env, player.player_id as string, newElo);
        }

        // Update Clan Elo if this was a Clan Match
        if (match.match_type === 'clan_match') {
            const alphaPlayer = playersList.find((p: any) => p.team === 'alpha');
            const bravoPlayer = playersList.find((p: any) => p.team === 'bravo');

            if (alphaPlayer && bravoPlayer) {
                // Find clans for both teams
                const clanAlpha = await c.env.DB.prepare(`SELECT c.* FROM clans c JOIN clan_members cm ON c.id = cm.clan_id WHERE cm.user_id = ?`).bind(alphaPlayer.player_id).first();
                const clanBravo = await c.env.DB.prepare(`SELECT c.* FROM clans c JOIN clan_members cm ON c.id = cm.clan_id WHERE cm.user_id = ?`).bind(bravoPlayer.player_id).first();

                if (clanAlpha && clanBravo && clanAlpha.id !== clanBravo.id) {
                    const clanEloChange = 25; // Standard change for clans
                    const isAlphaWinner = winnerTeam === 'alpha';

                    // Alpha Stats
                    const alphaChange = isAlphaWinner ? clanEloChange : -clanEloChange;
                    const newAlphaElo = Math.max(0, (clanAlpha.elo as number || 1000) + alphaChange);

                    // Bravo Stats
                    const bravoChange = isAlphaWinner ? -clanEloChange : clanEloChange;
                    const newBravoElo = Math.max(0, (clanBravo.elo as number || 1000) + bravoChange);

                    // Update Alpha
                    await c.env.DB.prepare(`
                        UPDATE clans SET elo = ?, wins = wins + ?, losses = losses + ? WHERE id = ?
                    `).bind(newAlphaElo, isAlphaWinner ? 1 : 0, isAlphaWinner ? 0 : 1, clanAlpha.id).run();

                    // Update Bravo
                    await c.env.DB.prepare(`
                        UPDATE clans SET elo = ?, wins = wins + ?, losses = losses + ? WHERE id = ?
                    `).bind(newBravoElo, isAlphaWinner ? 0 : 1, isAlphaWinner ? 1 : 0, clanBravo.id).run();
                }
            }
        }

        // Update match as completed
        await c.env.DB.prepare(`
            UPDATE matches 
            SET status = 'completed',
                winner_team = ?,
                alpha_score = ?,
                bravo_score = ?,
                reviewed_by = ?,
                reviewed_at = datetime('now'),
                review_notes = ?,
                updated_at = datetime('now')
            WHERE id = ?
        `).bind(
            winnerTeam,
            body.alpha_score || 0,
            body.bravo_score || 0,
            moderatorId,
            body.notes || null,
            matchId
        ).run();

        return c.json({
            success: true,
            message: 'Match reviewed and ELO applied',
            eloChange,
            playersAffected: playersList.length
        });
    } catch (error: any) {
        console.error('Error reviewing match:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// ============= PLAYER MANAGEMENT =============

// GET /api/moderator/players - Search/list players
moderatorRoutes.get('/players', async (c) => {
    const search = c.req.query('search');
    const page = parseInt(c.req.query('page') || '1');
    const limit = 50;
    const offset = (page - 1) * limit;

    try {
        let query = `
            SELECT id, discord_username, discord_avatar, standoff_nickname, elo, wins, losses, role, banned, is_vip, vip_until
            FROM players
        `;
        const params: any[] = [];

        if (search) {
            query += ` WHERE discord_username LIKE ? OR standoff_nickname LIKE ?`;
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY elo DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const result = await c.env.DB.prepare(query).bind(...params).all();

        const countResult = await c.env.DB.prepare(
            'SELECT COUNT(*) as count FROM players'
        ).first();

        return c.json({
            success: true,
            players: result.results || [],
            page,
            total: countResult?.count || 0
        });
    } catch (error: any) {
        console.error('Error fetching players:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// GET /api/moderator/players/:id/history - Get player's full history
moderatorRoutes.get('/players/:id/history', async (c) => {
    const playerId = c.req.param('id');

    try {
        // Get player info
        const player = await c.env.DB.prepare(`
            SELECT * FROM players WHERE id = ? OR discord_id = ?
        `).bind(playerId, playerId).first();

        if (!player) {
            return c.json({ success: false, error: 'Player not found' }, 404);
        }

        // Get ELO history
        const eloHistoryResult = await c.env.DB.prepare(`
            SELECT 
                eh.*,
                m.id as match_id,
                m.result_screenshot_url,
                m.winner_team,
                moderator.discord_username as moderator_username
            FROM elo_history eh
            LEFT JOIN matches m ON eh.match_id = m.id
            LEFT JOIN players moderator ON eh.created_by = moderator.id
            WHERE eh.user_id = ?
            ORDER BY eh.created_at DESC
            LIMIT 100
        `).bind(playerId).all();

        // Get match history
        const matchHistoryResult = await c.env.DB.prepare(`
            SELECT 
                m.*,
                mp.team,
                host.discord_username as host_username
            FROM match_players mp
            JOIN matches m ON mp.match_id = m.id
            LEFT JOIN players host ON m.host_id = host.id
            WHERE mp.player_id = ? AND m.status = 'completed'
            ORDER BY m.updated_at DESC
            LIMIT 50
        `).bind(playerId).all();

        return c.json({
            success: true,
            player,
            eloHistory: eloHistoryResult.results || [],
            matchHistory: matchHistoryResult.results || []
        });
    } catch (error: any) {
        console.error('Error fetching player history:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/moderator/players/:id/elo-adjust - Manual ELO adjustment
moderatorRoutes.post('/players/:id/elo-adjust', async (c) => {
    const playerId = c.req.param('id');
    const moderatorId = c.req.header('X-User-Id');

    try {
        const body = await c.req.json<{
            elo_change: number;
            reason: string;
        }>();

        if (!body.elo_change || !body.reason) {
            return c.json({ success: false, error: 'elo_change and reason are required' }, 400);
        }

        // Get current player ELO
        const player = await c.env.DB.prepare(
            'SELECT elo FROM players WHERE id = ? OR discord_id = ?'
        ).bind(playerId, playerId).first();

        if (!player) {
            return c.json({ success: false, error: 'Player not found' }, 404);
        }

        const newElo = Math.max(0, (player.elo as number) + body.elo_change);

        // Update player ELO
        await c.env.DB.prepare(
            'UPDATE players SET elo = ? WHERE id = ? OR discord_id = ?'
        ).bind(newElo, playerId, playerId).run();

        // Record in history
        await c.env.DB.prepare(`
            INSERT INTO elo_history (user_id, match_id, elo_before, elo_after, elo_change, reason, created_by, notes, created_at)
            VALUES (?, NULL, ?, ?, ?, 'manual_adjustment', ?, ?, datetime('now'))
        `).bind(
            playerId,
            player.elo,
            newElo,
            body.elo_change,
            moderatorId,
            body.reason
        ).run();

        // Sync Discord Tiers
        await syncDiscordTiers(c.env, playerId, newElo);

        return c.json({
            success: true,
            message: 'ELO adjusted',
            previousElo: player.elo,
            newElo
        });
    } catch (error: any) {
        console.error('Error adjusting ELO:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/moderator/players/:id/ban - Ban a player
moderatorRoutes.post('/players/:id/ban', async (c) => {
    const playerId = c.req.param('id');

    try {
        await c.env.DB.prepare(
            'UPDATE players SET banned = 1 WHERE id = ? OR discord_id = ?'
        ).bind(playerId, playerId).run();

        return c.json({
            success: true,
            message: 'Player banned'
        });
    } catch (error: any) {
        console.error('Error banning player:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/moderator/players/:id/unban - Unban a player
moderatorRoutes.post('/players/:id/unban', async (c) => {
    const playerId = c.req.param('id');

    try {
        await c.env.DB.prepare(
            'UPDATE players SET banned = 0 WHERE id = ? OR discord_id = ?'
        ).bind(playerId, playerId).run();

        return c.json({
            success: true,
            message: 'Player unbanned'
        });
    } catch (error: any) {
        console.error('Error unbanning player:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/moderator/players/:id/role - Change player role (Admin only)
moderatorRoutes.post('/players/:id/role', async (c) => {
    const playerId = c.req.param('id');
    const requesterId = c.req.header('X-User-Id');

    try {
        const body = await c.req.json<{ role: 'user' | 'moderator' | 'admin' }>();

        if (!['user', 'moderator', 'admin'].includes(body.role)) {
            return c.json({ success: false, error: 'Invalid role' }, 400);
        }

        // Check if requester is admin
        const requester = await c.env.DB.prepare(
            'SELECT role FROM players WHERE id = ? OR discord_id = ?'
        ).bind(requesterId, requesterId).first();

        if (!requester || requester.role !== 'admin') {
            return c.json({ success: false, error: 'Only administrators can change roles' }, 403);
        }

        await c.env.DB.prepare(
            'UPDATE players SET role = ? WHERE id = ? OR discord_id = ?'
        ).bind(body.role, playerId, playerId).run();

        return c.json({
            success: true,
            message: `Role changed to ${body.role}`
        });
    } catch (error: any) {
        console.error('Error changing role:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/moderator/players/:id/vip/grant - Grant VIP status for 1 month (Admin only)
moderatorRoutes.post('/players/:id/vip/grant', async (c) => {
    const playerId = c.req.param('id');
    const adminId = c.req.header('X-User-Id');

    try {
        // Check if requester is admin
        const adminPlayer = await c.env.DB.prepare(
            'SELECT role FROM players WHERE id = ? OR discord_id = ?'
        ).bind(adminId, adminId).first();

        if (!adminPlayer || adminPlayer.role !== 'admin') {
            return c.json({ success: false, error: 'Only administrators can grant VIP status' }, 403);
        }

        // Calculate ISO date in JS for consistency
        const vipUntilDate = new Date();
        vipUntilDate.setMonth(vipUntilDate.getMonth() + 1);
        const isoVipUntil = vipUntilDate.toISOString();

        // Set VIP status for 1 month
        await c.env.DB.prepare(`
            UPDATE players 
            SET is_vip = 1, 
                vip_until = ?
            WHERE id = ? OR discord_id = ?
        `).bind(isoVipUntil, playerId, playerId).run();

        // Instant Discord Role assignment
        await updateDiscordRole(c.env, playerId, TIERS.VIP, true);

        return c.json({
            success: true,
            message: 'VIP status granted for 1 month'
        });
    } catch (error: any) {
        console.error('Error granting VIP:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/moderator/players/:id/vip/revoke - Revoke VIP status (Admin only)
moderatorRoutes.post('/players/:id/vip/revoke', async (c) => {
    const playerId = c.req.param('id');
    const adminId = c.req.header('X-User-Id');

    try {
        // Check if requester is admin
        const adminPlayer = await c.env.DB.prepare(
            'SELECT role FROM players WHERE id = ? OR discord_id = ?'
        ).bind(adminId, adminId).first();

        if (!adminPlayer || adminPlayer.role !== 'admin') {
            return c.json({ success: false, error: 'Only administrators can revoke VIP status' }, 403);
        }

        await c.env.DB.prepare(`
            UPDATE players 
            SET is_vip = 0, 
                vip_until = NULL 
            WHERE id = ? OR discord_id = ?
        `).bind(playerId, playerId).run();

        // Remove Discord Role instantly
        await updateDiscordRole(c.env, playerId, TIERS.VIP, false);

        return c.json({
            success: true,
            message: 'VIP status revoked'
        });
    } catch (error: any) {
        console.error('Error revoking VIP:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// ============= STATS =============

// GET /api/moderator/stats - Get overall statistics
moderatorRoutes.get('/stats', async (c) => {
    try {
        const stats = await c.env.DB.batch([
            c.env.DB.prepare('SELECT COUNT(*) as count FROM players'),
            c.env.DB.prepare('SELECT COUNT(*) as count FROM matches WHERE status = ?').bind('waiting'),
            c.env.DB.prepare('SELECT COUNT(*) as count FROM matches WHERE status = ?').bind('in_progress'),
            c.env.DB.prepare('SELECT COUNT(*) as count FROM matches WHERE status = ?').bind('pending_review'),
            c.env.DB.prepare('SELECT COUNT(*) as count FROM matches WHERE status = ?').bind('completed'),
            c.env.DB.prepare('SELECT COUNT(*) as count FROM players WHERE banned = 1'),
        ]);

        return c.json({
            success: true,
            stats: {
                totalPlayers: (stats[0].results?.[0] as any)?.count || 0,
                waitingMatches: (stats[1].results?.[0] as any)?.count || 0,
                activeMatches: (stats[2].results?.[0] as any)?.count || 0,
                pendingReviews: (stats[3].results?.[0] as any)?.count || 0,
                completedMatches: (stats[4].results?.[0] as any)?.count || 0,
                bannedPlayers: (stats[5].results?.[0] as any)?.count || 0,
            }
        });
    } catch (error: any) {
        console.error('Error fetching stats:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/moderator/matches/:id/cancel - Cancel a match
moderatorRoutes.post('/matches/:id/cancel', async (c) => {
    const matchId = c.req.param('id');
    const moderatorId = c.req.header('X-User-Id');

    if (!moderatorId) {
        return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    try {
        await c.env.DB.prepare(`
            UPDATE matches 
            SET status = 'cancelled', 
                reviewed_by = ?,
                updated_at = datetime('now')
            WHERE id = ?
        `).bind(moderatorId, matchId).run();

        return c.json({ success: true });
    } catch (error: any) {
        console.error('Error cancelling match:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/moderator/matches/:id/force-start - Force start a match
moderatorRoutes.post('/matches/:id/force-start', async (c) => {
    const matchId = c.req.param('id');

    try {
        await c.env.DB.prepare(`
            UPDATE matches 
            SET status = 'in_progress',
                updated_at = datetime('now')
            WHERE id = ?
        `).bind(matchId).run();

        return c.json({ success: true });
    } catch (error: any) {
        console.error('Error force starting match:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/moderator/matches/create - Manual Match Creation
moderatorRoutes.post('/matches/create', async (c) => {
    const body = await c.req.json<{
        host_id: string;
        match_type: 'casual' | 'league' | 'clan_lobby' | 'clan_match';
        map_name: string;
        max_players: number;
        clan_id?: string;
    }>();

    if (!body.host_id) return c.json({ success: false, error: 'host_id is required' }, 400);

    const matchId = crypto.randomUUID();
    const matchType = body.match_type || 'casual';
    const maxPlayers = body.max_players || 10;

    // Check if host exists
    const host = await c.env.DB.prepare('SELECT id FROM players WHERE id = ? OR discord_id = ?').bind(body.host_id, body.host_id).first();
    if (!host) {
        // Warning: if host ID isn't found, we assume it's a valid ID for now? 
        // Or we should enforce existence. This is moderator tool, so maybe enforce.
        return c.json({ success: false, error: 'Host player not found' }, 404);
    }
    const realHostId = host.id;

    try {
        await c.env.DB.prepare(`
            INSERT INTO matches (id, lobby_url, host_id, map_name, match_type, status, player_count, max_players, clan_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'waiting', 1, ?, ?, datetime('now'), datetime('now'))
        `).bind(matchId, 'manual_create', realHostId, body.map_name || null, matchType, maxPlayers, body.clan_id || null).run();

        await c.env.DB.prepare(`
            INSERT INTO match_players (match_id, player_id, team, is_captain, joined_at)
            VALUES (?, ?, 'alpha', 1, datetime('now'))
        `).bind(matchId, realHostId).run();

        return c.json({ success: true, matchId });
    } catch (error: any) {
        console.error('Error creating match:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// ============= CLAN MANAGEMENT =============

// GET /api/moderator/clans - List Clans
moderatorRoutes.get('/clans', async (c) => {
    const search = c.req.query('search');
    const page = parseInt(c.req.query('page') || '1');
    const limit = 50;
    const offset = (page - 1) * limit;

    try {
        let query = `
            SELECT c.*, p.discord_username as leader_username,
            (SELECT COUNT(*) FROM clan_members WHERE clan_id = c.id) as member_count
            FROM clans c
            LEFT JOIN players p ON c.leader_id = p.id
        `;
        const params: any[] = [];

        if (search) {
            query += ` WHERE c.name LIKE ? OR c.tag LIKE ?`;
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const result = await c.env.DB.prepare(query).bind(...params).all();
        const countResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM clans').first();

        return c.json({
            success: true,
            clans: result.results || [],
            page,
            total: countResult?.count || 0
        });
    } catch (error: any) {
        console.error('Error fetching clans:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/moderator/clans/:id/delete - Delete Clan
moderatorRoutes.post('/clans/:id/delete', async (c) => {
    const clanId = c.req.param('id');
    try {
        // Delete members first
        await c.env.DB.prepare('DELETE FROM clan_members WHERE clan_id = ?').bind(clanId).run();
        // Delete clan
        await c.env.DB.prepare('DELETE FROM clans WHERE id = ?').bind(clanId).run();

        return c.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting clan:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// GET /api/moderator/clans/:id - Get full clan details
moderatorRoutes.get('/clans/:id', async (c) => {
    const clanId = c.req.param('id');
    try {
        const clan = await c.env.DB.prepare(`
            SELECT c.*, p.discord_username as leader_username 
            FROM clans c
            LEFT JOIN players p ON c.leader_id = p.id
            WHERE c.id = ?
        `).bind(clanId).first();

        if (!clan) return c.json({ success: false, error: 'Clan not found' }, 404);

        const members = await c.env.DB.prepare(`
            SELECT cm.*, p.discord_username, p.standoff_nickname, p.elo, p.role as player_role
            FROM clan_members cm
            LEFT JOIN players p ON cm.user_id = p.id
            WHERE cm.clan_id = ?
            ORDER BY 
                CASE 
                    WHEN cm.role = 'leader' THEN 1 
                    WHEN cm.role = 'co_leader' THEN 2 
                    ELSE 3 
                END
        `).bind(clanId).all();

        return c.json({ success: true, clan, members: members.results || [] });
    } catch (error: any) {
        console.error('Error fetching clan details:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/moderator/clans/:id/update - Update clan details
moderatorRoutes.post('/clans/:id/update', async (c) => {
    const clanId = c.req.param('id');
    try {
        const body = await c.req.json<{
            name: string;
            tag: string;
            elo: number;
            leader_id: string;
        }>();

        await c.env.DB.prepare(`
            UPDATE clans 
            SET name = ?, tag = ?, elo = ?, leader_id = ?
            WHERE id = ?
        `).bind(body.name, body.tag, body.elo, body.leader_id, clanId).run();

        // Also update the leader role in clan_members table specifically? 
        // For simplicity, we assume the moderator handles role swaps if changing leader_id manually,
        // or we adding logic to ensure the new leader has 'leader' role is complex. 
        // Let's just update the clan record for now.

        return c.json({ success: true });
    } catch (error: any) {
        console.error('Error updating clan:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// ============= CLAN REQUESTS =============

// GET /api/moderator/clan-requests - List Pending Clan Requests
moderatorRoutes.get('/clan-requests', async (c) => {
    try {
        const requests = await c.env.DB.prepare(`
            SELECT cr.*, p.discord_username, p.discord_avatar
            FROM clan_requests cr
            LEFT JOIN players p ON cr.user_id = p.id
            WHERE cr.status = 'pending'
            ORDER BY cr.created_at ASC
        `).all();

        return c.json({
            success: true,
            requests: requests.results || []
        });
    } catch (error: any) {
        console.error('Error fetching clan requests:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/moderator/clan-requests/:id/approve - Approve Request & Create Clan
moderatorRoutes.post('/clan-requests/:id/approve', async (c) => {
    const requestId = c.req.param('id');
    const moderatorId = c.req.header('X-User-Id');

    try {
        const request = await c.env.DB.prepare('SELECT * FROM clan_requests WHERE id = ?').bind(requestId).first();
        if (!request) return c.json({ success: false, error: 'Request not found' }, 404);
        if (request.status !== 'pending') return c.json({ success: false, error: 'Request already processed' }, 400);

        // Check if clan name/tag exists
        const existing = await c.env.DB.prepare('SELECT id FROM clans WHERE name = ? OR tag = ?').bind(request.clan_name, request.clan_tag).first();
        if (existing) return c.json({ success: false, error: 'Clan name or tag already taken' }, 400);

        const clanId = crypto.randomUUID();

        // Transaction: Create Clan -> Add Member -> Update Request -> Deduct Balance? (No, manual payment)
        const batch = await c.env.DB.batch([
            c.env.DB.prepare(`
                INSERT INTO clans (id, name, tag, leader_id, max_members, created_at)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
            `).bind(clanId, request.clan_name, request.clan_tag, request.user_id, request.clan_size),

            c.env.DB.prepare(`
                INSERT INTO clan_members (clan_id, user_id, role, joined_at)
                VALUES (?, ?, 'leader', datetime('now'))
            `).bind(clanId, request.user_id),

            c.env.DB.prepare(`
                UPDATE clan_requests 
                SET status = 'approved', reviewed_by = ?, updated_at = datetime('now')
                WHERE id = ?
            `).bind(moderatorId, requestId)
        ]);

        return c.json({ success: true, message: 'Clan created successfully' });
    } catch (error: any) {
        console.error('Error approving clan request:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/moderator/clan-requests/:id/reject - Reject Request
moderatorRoutes.post('/clan-requests/:id/reject', async (c) => {
    const requestId = c.req.param('id');
    const moderatorId = c.req.header('X-User-Id');
    const { reason } = await c.req.json();

    try {
        await c.env.DB.prepare(`
            UPDATE clan_requests 
            SET status = 'rejected', reviewed_by = ?, rejection_reason = ?, updated_at = datetime('now')
            WHERE id = ?
        `).bind(moderatorId, reason || 'No reason provided', requestId).run();

        return c.json({ success: true, message: 'Request rejected' });
    } catch (error: any) {
        console.error('Error rejecting clan request:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// ============= VIP REQUESTS =============

// GET /api/moderator/vip-requests - Get all VIP requests
moderatorRoutes.get('/vip-requests', async (c) => {
    const status = c.req.query('status') || 'pending';

    try {
        const requests = await c.env.DB.prepare(`
            SELECT 
                vr.*,
                p.discord_username as user_discord_username,
                p.discord_avatar as user_discord_avatar,
                reviewer.discord_username as reviewer_username
            FROM vip_requests vr
            LEFT JOIN players p ON vr.user_id = p.id
            LEFT JOIN players reviewer ON vr.reviewed_by = reviewer.id
            WHERE vr.status = ?
            ORDER BY vr.created_at DESC
        `).bind(status).all();

        return c.json({
            success: true,
            requests: requests.results || []
        });
    } catch (error: any) {
        console.error('Error fetching VIP requests:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/moderator/vip-requests/:id/approve - Approve VIP request (Admin only)
moderatorRoutes.post('/vip-requests/:id/approve', async (c) => {
    const requestId = c.req.param('id');
    const adminId = c.req.header('X-User-Id');

    try {
        // Check if requester is admin
        const adminPlayer = await c.env.DB.prepare(
            'SELECT role FROM players WHERE id = ?'
        ).bind(adminId).first();

        if (!adminPlayer || adminPlayer.role !== 'admin') {
            return c.json({ success: false, error: 'Only administrators can approve VIP requests' }, 403);
        }

        // Get request details
        const request = await c.env.DB.prepare(
            'SELECT user_id, status FROM vip_requests WHERE id = ?'
        ).bind(requestId).first();

        if (!request) {
            return c.json({ success: false, error: 'Request not found' }, 404);
        }

        if (request.status !== 'pending') {
            return c.json({ success: false, error: 'Request has already been reviewed' }, 400);
        }

        const now = new Date();
        const vipUntilDate = new Date(now);
        vipUntilDate.setMonth(vipUntilDate.getMonth() + 1);
        const isoVipUntil = vipUntilDate.toISOString();
        const isoNow = now.toISOString();

        // Grant VIP to user
        await c.env.DB.prepare(`
            UPDATE players 
            SET is_vip = 1, vip_until = ?
            WHERE id = ? OR discord_id = ?
        `).bind(isoVipUntil, request.user_id, request.user_id).run();

        // Update request status
        await c.env.DB.prepare(`
            UPDATE vip_requests
            SET status = 'approved',
                reviewed_by = ?,
                reviewed_at = ?
            WHERE id = ?
        `).bind(adminId, isoNow, requestId).run();

        // Add Discord VIP role
        await updateDiscordRole(c.env, request.user_id as string, TIERS.VIP, true);

        return c.json({
            success: true,
            message: 'VIP request approved and VIP granted for 1 month'
        });
    } catch (error: any) {
        console.error('Error approving VIP request:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/moderator/vip-requests/:id/reject - Reject VIP request (Admin only)
moderatorRoutes.post('/vip-requests/:id/reject', async (c) => {
    const requestId = c.req.param('id');
    const adminId = c.req.header('X-User-Id');

    try {
        // Check if requester is admin
        const adminPlayer = await c.env.DB.prepare(
            'SELECT role FROM players WHERE id = ?'
        ).bind(adminId).first();

        if (!adminPlayer || adminPlayer.role !== 'admin') {
            return c.json({ success: false, error: 'Only administrators can reject VIP requests' }, 403);
        }

        const body = await c.req.json<{ reason?: string }>();

        // Get request
        const request = await c.env.DB.prepare(
            'SELECT status FROM vip_requests WHERE id = ?'
        ).bind(requestId).first();

        if (!request) {
            return c.json({ success: false, error: 'Request not found' }, 404);
        }

        if (request.status !== 'pending') {
            return c.json({ success: false, error: 'Request has already been reviewed' }, 400);
        }

        const now = new Date().toISOString();

        // Update request status
        await c.env.DB.prepare(`
            UPDATE vip_requests
            SET status = 'rejected',
                reviewed_by = ?,
                reviewed_at = ?,
                rejection_reason = ?
            WHERE id = ?
        `).bind(adminId, now, body.reason || 'No reason provided', requestId).run();

        return c.json({
            success: true,
            message: 'VIP request rejected'
        });
    } catch (error: any) {
        console.error('Error rejecting VIP request:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});


export { moderatorRoutes };
