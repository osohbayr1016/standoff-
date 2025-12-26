import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, and, sql } from 'drizzle-orm';
import { matches, matchPlayers, eloHistory, players } from '../db/schema';

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
        'SELECT role FROM players WHERE id = ?'
    ).bind(userId).first();

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
            SELECT * FROM players WHERE id = ?
        `).bind(playerId).first();

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
            'SELECT elo FROM players WHERE id = ?'
        ).bind(playerId).first();

        if (!player) {
            return c.json({ success: false, error: 'Player not found' }, 404);
        }

        const newElo = Math.max(0, (player.elo as number) + body.elo_change);

        // Update player ELO
        await c.env.DB.prepare(
            'UPDATE players SET elo = ? WHERE id = ?'
        ).bind(newElo, playerId).run();

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
            'UPDATE players SET banned = 1 WHERE id = ?'
        ).bind(playerId).run();

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
            'UPDATE players SET banned = 0 WHERE id = ?'
        ).bind(playerId).run();

        return c.json({
            success: true,
            message: 'Player unbanned'
        });
    } catch (error: any) {
        console.error('Error unbanning player:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/moderator/players/:id/role - Change player role
moderatorRoutes.post('/players/:id/role', async (c) => {
    const playerId = c.req.param('id');

    try {
        const body = await c.req.json<{ role: 'user' | 'moderator' | 'admin' }>();

        if (!['user', 'moderator', 'admin'].includes(body.role)) {
            return c.json({ success: false, error: 'Invalid role' }, 400);
        }

        await c.env.DB.prepare(
            'UPDATE players SET role = ? WHERE id = ?'
        ).bind(body.role, playerId).run();

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
            'SELECT role FROM players WHERE id = ?'
        ).bind(adminId).first();

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
            WHERE id = ?
        `).bind(isoVipUntil, playerId).run();

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
            'SELECT role FROM players WHERE id = ?'
        ).bind(adminId).first();

        if (!adminPlayer || adminPlayer.role !== 'admin') {
            return c.json({ success: false, error: 'Only administrators can revoke VIP status' }, 403);
        }

        await c.env.DB.prepare(`
            UPDATE players 
            SET is_vip = 0, 
                vip_until = NULL 
            WHERE id = ?
        `).bind(playerId).run();

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

export { moderatorRoutes };
