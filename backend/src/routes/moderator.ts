import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, and, sql, like, or } from 'drizzle-orm';
import { players, matches, matchPlayers, clans, clanMembers, clanRequests, moderatorLogs, tournaments, tournamentParticipants } from '../db/schema';
import { TIERS, updateDiscordRole } from '../utils/discord';
import { logToDatadog } from '../utils/logger';

interface Env {
    DB: D1Database;
    DISCORD_BOT_TOKEN: string;
    DISCORD_SERVER_ID: string;
    MATCH_QUEUE: DurableObjectNamespace;
    DD_API_KEY: string;
    FRONTEND_URL: string;
}

const moderatorRoutes = new Hono<{ Bindings: Env }>();

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

// Helper to purge lobby from MatchQueueDO memory
async function purgeLobby(matchId: string, env: Env) {
    try {
        const doId = env.MATCH_QUEUE.idFromName('global-matchmaking-v2');
        const doStub = env.MATCH_QUEUE.get(doId);
        await doStub.fetch('http://do/purge-lobby', {
            method: 'POST',
            body: JSON.stringify({ matchId })
        });
        console.log(`🧹 Purge request sent for lobby ${matchId}`);
    } catch (err) {
        console.error('Error purging lobby:', err);
    }
}

// Log Moderator Action Helper
const logModeratorAction = async (c: any, moderatorId: string, actionType: string, targetId: string | null, details: any) => {
    try {
        await c.env.DB.prepare(
            'INSERT INTO moderator_logs (moderator_id, action_type, target_id, details) VALUES (?, ?, ?, ?)'
        ).bind(moderatorId, actionType, targetId, JSON.stringify(details)).run();

        // Datadog Logging with Tracing
        const traceId = c.req.header('x-datadog-trace-id');
        const spanId = c.req.header('x-datadog-parent-id');

        await logToDatadog(
            c.env.DD_API_KEY,
            `Moderator Action: ${actionType}`,
            'info',
            {
                moderator_id: moderatorId,
                action_type: actionType,
                target_id: targetId,
                details,
                trace_id: traceId,
                span_id: spanId
            }
        );

    } catch (e) {
        console.error('Failed to log moderator action:', e);
    }
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
                (SELECT COUNT(*) FROM match_players WHERE match_id = m.id) as player_count,
                (
                    SELECT json_group_array(json_object(
                        'player_id', mp.player_id,
                        'team', mp.team,
                        'is_captain', mp.is_captain,
                        'discord_username', pl.discord_username,
                        'discord_avatar', pl.discord_avatar,
                        'standoff_nickname', pl.standoff_nickname,
                        'elo', pl.elo
                    ))
                    FROM match_players mp
                    JOIN players pl ON mp.player_id = pl.id
                    WHERE mp.match_id = m.id
                ) as players_json
            FROM matches m
            LEFT JOIN players p ON m.host_id = p.id
            WHERE m.status = 'pending_review'
            ORDER BY m.updated_at ASC
        `).all();

        const matches = (result.results || []).map((m: any) => ({
            ...m,
            players: m.players_json ? JSON.parse(m.players_json) : []
        }));

        return c.json({
            success: true,
            matches
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
                p.discord_avatar as host_avatar,
                (SELECT COUNT(*) FROM match_players WHERE match_id = m.id) as player_count
            FROM matches m
            LEFT JOIN players p ON m.host_id = p.id
            WHERE m.status = 'cancelled' 
            AND m.match_type != 'casual'
            AND (SELECT COUNT(*) FROM match_players WHERE match_id = m.id) > 0
            AND (m.review_notes IS NOT NULL OR m.alpha_score IS NOT NULL OR m.bravo_score IS NOT NULL)
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
            WHERE m.status IN('in_progress', 'waiting', 'drafting', 'map_ban')
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

// POST /api/moderator/matches/:id/force-result - Force set winner and advance bracket
moderatorRoutes.post('/matches/:id/force-result', async (c) => {
    const matchId = c.req.param('id');
    const moderatorId = c.req.header('X-User-Id');
    const { winner_team } = await c.req.json<{ winner_team: 'alpha' | 'bravo' }>();
    const db = drizzle(c.env.DB);

    try {
        const match = await db.select().from(matches).where(eq(matches.id, matchId)).get();
        if (!match) return c.json({ error: 'Match not found' }, 404);

        if (match.status === 'completed') {
            // If completed, we just want to ensure it triggered the next match? 
            // Or allow re-setting winner? Let's allow re-setting winner which might be complex.
            // For now, assume this is for STUCK matches.
            // If completed, just return success if winner matches, else error.
            if (match.winner_team === winner_team) return c.json({ success: true, message: 'Already completed with this winner' });
        }

        // Set as Completed
        await db.update(matches)
            .set({
                status: 'completed',
                winner_team: winner_team,
                reviewed_by: moderatorId,
                review_notes: 'Force advanced by moderator',
                updated_at: new Date().toISOString()
            })
            .where(eq(matches.id, matchId))
            .execute();

        // ADVANCE TO NEXT MATCH
        if (match.tournament_id && match.next_match_id) {
            const nextMatchId = match.next_match_id;
            // Determine if we fill Alpha or Bravo slot in next match
            // This depends on the Bracket structure.
            // Usually: (Match A winner) vs (Match B winner) -> Match C
            // We need to know if we are "Top" or "Bottom" seed relative to next match.
            // Simplified: We rely on the `bracket_match_id`.
            // If current is ODD (e.g. 1), it goes to Alpha of next?
            // If current is EVEN (e.g. 2), it goes to Bravo of next?

            // Let's check the next match's current state
            // We need to know WHICH team slot in the next match this winner occupies.
            // We can check `bracket_match_id`.
            // Convention: Match N connects to Match P. 
            // If N is the 2*P-1 child (Odd), it's Alpha.
            // If N is the 2*P child (Even), it's Bravo.
            // Only valid if we number strictly 1..N.

            // Alternate: Just check existing players in next match?
            // If next match is empty, we take Alpha.
            // If Alpha taken, we take Bravo.
            // DANGER: Race condition if both finish same time.

            // Better: Use `bracket_match_id`.
            // Assume Binary Tree numbering: Root=1. Children=2,3. Children of 2=4,5.
            // Parent(k) = floor(k/2).
            // If k is even (2,4,6), it's the RIGHT child (Bravo) of parent.
            // If k is odd (3,5,7), it's the LEFT child (Alpha) of parent.
            // Note: Root is 1. 2 is Alpha child? No, typically 2 vs 3.
            // Let's stick to simple logic: 
            // Determine slot based on current `bracket_match_id` parity if logical, OR
            // Store `next_match_slot` in DB (we didn't adding this column yet).

            // Let's try the "First Empty Slot" approach for now but be careful.
            // Wait, in `start` we generated matches. 

            // Let's update `tournament_round`.
            // If we used standard seeding ID 1..N.

            // FALLBACK: Query next match players.
            const nextMatchPlayers = await db.select().from(matchPlayers).where(eq(matchPlayers.match_id, nextMatchId)).all();
            const hasAlpha = nextMatchPlayers.some(p => p.team === 'alpha');

            // We need to know our specific slot.
            // If we are "Match A" and it is mapped to "Next Match Alpha", we must take Alpha.
            // Since we didn't store mapping, we might guess or just fill.
            // Fill Logic: 
            // If no alpha, take alpha.
            // If alpha exists, take bravo.

            const targetTeam = hasAlpha ? 'bravo' : 'alpha';

            // Get the CLAN ID of the winner
            // The winner_team is 'alpha' or 'bravo' of CURRENT match.
            // We need the Clan ID corresponding to that.
            // We need to fetch current match players to find the clan.

            // 1. Get player from winning team of current match
            const winningPlayer = await db.select().from(matchPlayers)
                .where(and(eq(matchPlayers.match_id, matchId), eq(matchPlayers.team, winner_team)))
                .limit(1).get();

            if (winningPlayer) {
                // 2. Get their clan (or just use their ID to find clan)
                const member = await db.select().from(clanMembers).where(eq(clanMembers.user_id, winningPlayer.player_id)).get();
                if (member) {
                    const winningClanId = member.clan_id;

                    // 3. Find the LEADER of that clan to be the "Captain/Player" in next match?
                    // Or just carry over the exact same player?
                    // Carrying over same player is easiest for now.

                    // Check if already in next match
                    const alreadyIn = nextMatchPlayers.some(p => p.player_id === winningPlayer.player_id);
                    if (!alreadyIn) {
                        await db.insert(matchPlayers).values({
                            match_id: nextMatchId,
                            player_id: winningPlayer.player_id,
                            team: targetTeam,
                            is_captain: 1, // Make them captain of next match representation
                            joined_at: new Date().toISOString()
                        }).execute();
                    }
                }
            }
        }

        return c.json({ success: true, message: 'Match advanced' });
    } catch (e: any) {
        console.error("Force result error", e);
        return c.json({ error: 'Failed' }, 500);
    }
});

// GET /api/moderator/recent-matches - Get recently completed matches
moderatorRoutes.get('/recent-matches', async (c) => {
    try {
        const matches = await c.env.DB.prepare(`
SELECT
m.*,
    p.discord_username as host_username,
    p.discord_avatar as host_avatar
            FROM matches m
            LEFT JOIN players p ON m.host_id = p.id
            WHERE m.status IN('completed', 'cancelled') 
            ORDER BY m.updated_at DESC 
            LIMIT 20
    `).all();

        return c.json({
            success: true,
            matches: matches.results || []
        });
    } catch (error: any) {
        console.error('Error fetching recent matches:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/moderator/matches/:id/edit-result - Edit result of a completed match (Admin/Mod)
moderatorRoutes.post('/matches/:id/edit-result', async (c) => {
    const matchId = c.req.param('id');
    const moderatorId = c.req.header('X-User-Id');

    try {
        const body = await c.req.json<{
            winner_team: 'alpha' | 'bravo';
            alpha_score: number;
            bravo_score: number;
        }>();

        // 1. Fetch match
        const match = await c.env.DB.prepare('SELECT * FROM matches WHERE id = ?').bind(matchId).first();
        if (!match) return c.json({ success: false, error: 'Match not found' }, 404);

        // Allow 'completed' OR 'cancelled' matches to be edited.
        if (match.status !== 'completed' && match.status !== 'cancelled') {
            return c.json({ success: false, error: 'Match is not completed or cancelled. Use review or force-result instead.' }, 400);
        }

        const oldWinner = match.winner_team; // Null if cancelled
        const newWinner = body.winner_team;
        const wasCancelled = match.status === 'cancelled';

        // Check moderator existence for FK safety
        let moderatorExists = null;
        try {
            if (moderatorId) {
                moderatorExists = await c.env.DB.prepare('SELECT id FROM players WHERE id = ?').bind(moderatorId).first();
            }
        } catch (e) {
            console.error('Check moderator error:', e);
        }

        // Optimization: If completed and winner same, just update scores
        if (!wasCancelled && oldWinner === newWinner) {
            await c.env.DB.prepare(`
                UPDATE matches 
                SET alpha_score = ?,
    bravo_score = ?,
    review_notes = review_notes || ' | Score edited by ' || ?,
    updated_at = datetime('now')
                WHERE id = ?
    `).bind(body.alpha_score, body.bravo_score, moderatorId, matchId).run();

            // Log Action
            await logModeratorAction(c, moderatorId || 'system', 'MATCH_EDIT_RESULT', matchId, {
                oldWinner, newWinner, notes: 'Available scores updated', changes: body
            });

            return c.json({ success: true, message: 'Scores updated (No Elo change required)' });
        }

        // Winner changed! Need to revert and re-apply.
        // Get players
        const matchPlayers = await c.env.DB.prepare(`SELECT * FROM match_players WHERE match_id = ? `).bind(matchId).all();
        const playersList = matchPlayers.results || [];

        // Determine Elo Value
        let eloValue = 25;
        if (match.match_type === 'competitive') eloValue = 10;

        for (const player of playersList) {
            const team = player.team;

            // 1. Calculate Old Change (What happened before)
            let oldEloChange = 0;
            let oldWinsChange = 0;
            let oldLossesChange = 0;

            if (!wasCancelled && oldWinner) {
                if (team === oldWinner) {
                    oldEloChange = eloValue;
                    oldWinsChange = 1;
                } else {
                    oldEloChange = -eloValue;
                    oldLossesChange = 1;
                }
            }
            // If wasCancelled, all old changes are 0.

            // 2. Calculate New Change (What should be now)
            let newEloChange = 0;
            let newWinsChange = 0;
            let newLossesChange = 0;

            if (team === newWinner) {
                newEloChange = eloValue;
                newWinsChange = 1;
            } else {
                newEloChange = -eloValue;
                newLossesChange = 1;
            }

            // 3. Diff
            const eloDiff = newEloChange - oldEloChange;
            const winsDiff = newWinsChange - oldWinsChange;
            const lossesDiff = newLossesChange - oldLossesChange;

            if (eloDiff !== 0 || winsDiff !== 0 || lossesDiff !== 0) {
                // Update Player
                await c.env.DB.prepare(`
                    UPDATE players 
                    SET elo = MAX(0, elo + ?),
    wins = MAX(0, wins + ?),
    losses = MAX(0, losses + ?)
                    WHERE id = ?
    `).bind(eloDiff, winsDiff, lossesDiff, player.player_id).run();

                // Get current Elo for history (after update)
                const p = await c.env.DB.prepare('SELECT elo FROM players WHERE id=?').bind(player.player_id).first();
                const currentElo = p?.elo as number;

                // Add History
                await c.env.DB.prepare(`
                    INSERT INTO elo_history(user_id, match_id, elo_before, elo_after, elo_change, reason, created_by, notes, created_at)
VALUES(?, ?, ?, ?, ?, 'correction', ?, 'Result corrected', datetime('now'))
    `).bind(
                    player.player_id,
                    matchId,
                    currentElo - eloDiff,
                    currentElo,
                    eloDiff,
                    moderatorExists ? moderatorId : null
                ).run();

                // Sync Discord
                await syncDiscordTiers(c.env, player.player_id as string, currentElo);
            }
        }

        // Update Match Record
        await c.env.DB.prepare(`
            UPDATE matches 
            SET status = 'completed',
    winner_team = ?,
    alpha_score = ?,
    bravo_score = ?,
    reviewed_by = COALESCE(reviewed_by, ?),
    review_notes = CASE 
                    WHEN review_notes IS NULL THEN 'Result set by ' || ?
    ELSE review_notes || ' | Winner changed by ' || ?
        END,
        updated_at = datetime('now')
            WHERE id = ?
    `).bind(
            newWinner,
            body.alpha_score,
            body.bravo_score,
            moderatorExists ? moderatorId : null,
            moderatorId,
            moderatorId,
            matchId
        ).run();



        // Log Action
        await logModeratorAction(c, moderatorId || 'system', 'MATCH_EDIT_RESULT', matchId, {
            oldWinner, newWinner: body.winner_team, score: `${body.alpha_score} -${body.bravo_score} `
        });

        return c.json({ success: true, message: 'Match result corrected and Elo updated' });

    } catch (error: any) {
        console.error('Error editing result:', error);
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

        // 1. ATTEMPT TO LOCK THE MATCH
        // This prevents double-submissions. We change status from 'pending_review' to 'review_processing'.
        const lockResult = await c.env.DB.prepare(`
            UPDATE matches 
            SET status = 'review_processing' 
            WHERE id = ? AND status = 'pending_review'
    `).bind(matchId).run();

        if (!lockResult.meta.changes) {
            return c.json({ success: false, error: 'Match already reviewed or not in pending state' }, 409);
        }

        // 2. Fetch the locked match details
        const match = await c.env.DB.prepare(
            'SELECT * FROM matches WHERE id = ?'
        ).bind(matchId).first();

        if (!match) {
            // Should not happen if lock succeeded, but safety net
            return c.json({ success: false, error: 'Match data not found' }, 404);
        }

        if (!body.approved) {
            // Reject - set back to in_progress or cancelled
            // Since we locked it, we just update it to cancelled now.
            await c.env.DB.prepare(`
                UPDATE matches 
                SET status = 'cancelled',
    reviewed_by = ?,
    reviewed_at = datetime('now'),
    review_notes = ?,
    updated_at = datetime('now')
                WHERE id = ?
    `).bind(null, body.notes || 'Rejected by moderator', matchId).run();

            return c.json({
                success: true,
                message: 'Match rejected'
            });
        }

        // Approved - Apply ELO changes
        const winnerTeam = body.winner_team || match.winner_team;
        let eloChange = body.elo_change || 25; // Default ELO change

        // For Competitive matches, FORCE rigid +/- 10 ELO change (both VIP and Free)
        if (match.match_type === 'competitive') {
            eloChange = 10;
        } else if (match.match_type === 'league') {
            eloChange = 25;
        }

        if (!winnerTeam) {
            // Rollback lock if data invalid
            await c.env.DB.prepare("UPDATE matches SET status = 'pending_review' WHERE id = ?").bind(matchId).run();
            return c.json({ success: false, error: 'Winner team is required' }, 400);
        }

        // Get all players in match
        const matchPlayersResult = await c.env.DB.prepare(`
            SELECT mp.player_id, mp.team, p.elo
            FROM match_players mp
            JOIN players p ON mp.player_id = p.id
            WHERE mp.match_id = ?
    `).bind(matchId).all();

        const playersList = matchPlayersResult.results || [];

        // Moderator tracking: Use NULL for created_by to avoid FK conflicts
        // The header X-User-Id might be discord_id, not players.id, causing FK errors
        // Since created_by is nullable, we set it to NULL for safety
        const moderatorIdForTracking = null; // Avoid FK constraint issues

        // Verify Host Exists (Fix for deleted host FK error)
        // If host was deleted, we must re-assign match to moderator to satisfy FK constraint
        let safeHostId = match.host_id;
        try {
            const hostExists = await c.env.DB.prepare('SELECT id FROM players WHERE id = ?').bind(match.host_id).first();
            if (!hostExists) {
                if (moderatorIdForTracking) {
                    safeHostId = moderatorIdForTracking;
                    console.log('Match host deleted. Re-assigning to moderator:', moderatorIdForTracking);
                } else {
                    console.warn('Match host deleted and moderator not found. FK error likely.');
                }
            }
        } catch (e) {
            console.error('Check host error:', e);
        }

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
                INSERT INTO elo_history(user_id, match_id, elo_before, elo_after, elo_change, reason, created_by, notes, created_at)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `).bind(
                player.player_id,
                matchId,
                player.elo,
                newElo,
                change,
                reason,
                moderatorIdForTracking,
                body.notes || null
            ).run();

            // Note: Discord tier sync removed to prevent timeouts - will sync via cron job
        }

        // Update Clan Elo if this was a Clan Match
        try {
            if (match.match_type === 'clan_war') {
                const alphaPlayer = playersList.find((p: any) => p.team === 'alpha');
                const bravoPlayer = playersList.find((p: any) => p.team === 'bravo');

                if (alphaPlayer && bravoPlayer) {
                    // Find clans for both teams
                    const clanAlpha = await c.env.DB.prepare(`SELECT c.* FROM clans c JOIN clan_members cm ON c.id = cm.clan_id WHERE cm.user_id = ? `).bind(alphaPlayer.player_id).first();
                    const clanBravo = await c.env.DB.prepare(`SELECT c.* FROM clans c JOIN clan_members cm ON c.id = cm.clan_id WHERE cm.user_id = ? `).bind(bravoPlayer.player_id).first();

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
        } catch (clanError) {
            console.error('Error updating clan Stats (non-fatal):', clanError);
        }

        // Update match as completed
        // Include host_id in update to fix orphan matches
        await c.env.DB.prepare(`
            UPDATE matches 
            SET status = 'completed',
    winner_team = ?,
    alpha_score = ?,
    bravo_score = ?,
    reviewed_by = ?,
    host_id = ?,
    reviewed_at = datetime('now'),
    review_notes = ?,
    updated_at = datetime('now')
            WHERE id = ?
    `).bind(
            winnerTeam,
            body.alpha_score || 0,
            body.bravo_score || 0,
            moderatorIdForTracking,
            safeHostId,
            body.notes || null,
            matchId
        ).run();

        // Check if this match is part of a TOURNAMENT
        if (match.tournament_id && match.next_match_id && winnerTeam) {
            // Advance winner to next match
            // 1. Get the next match
            const nextMatch = await c.env.DB.prepare('SELECT * FROM matches WHERE id = ?').bind(match.next_match_id).first();

            if (nextMatch) {
                // 2. Identify which slot to fill in next match.
                // We need valid player IDs from the winning team to populate match_players?
                // OR we just assume clan-based?

                // For now, tournament logic might require manual "start match" by mod or auto-fill users from clan roster?
                // Let's just Log it for now or Auto-Set the "Clan Name" if we had columns for it.
                // Currently matches rely on match_players. 
                // We might need to invite clan members to the lobby of the next match.

                console.log(`Tournament Match ${matchId} winner ${winnerTeam} advances to ${match.next_match_id}`);

                // TODO: Auto-populate next match or notify admins
            }
        }

        // Log Action
        await logModeratorAction(c, moderatorId || 'system', 'MATCH_REVIEW', matchId, {
            approved: true, winner: winnerTeam, eloChange, notes: body.notes, playersAffected: playersList.length
        });

        return c.json({
            success: true,
            message: 'Match reviewed and processed'
        });
    } catch (e: any) {
        console.error('Error reviewing match:', e);
        return c.json({ success: false, error: e.message }, 500);
    }
});


// ============= TOURNAMENTS =============

// POST /api/moderator/tournaments
moderatorRoutes.post('/tournaments', async (c) => {
    const db = drizzle(c.env.DB);
    const body = await c.req.json();

    try {
        await db.insert(tournaments).values({
            name: body.name,
            start_time: body.start_time,
            max_teams: body.max_teams || 16,
            min_teams: body.min_teams || 4,
            bracket_type: 'single_elimination',
            prizepool: body.prizepool
        }).execute();

        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: 'Failed to create tournament' }, 500);
    }
});

// POST /api/moderator/tournaments/:id/participants - Manually Add Clan
moderatorRoutes.post('/tournaments/:id/participants', async (c) => {
    const tournamentId = c.req.param('id');
    const { clan_tag } = await c.req.json<{ clan_tag: string }>();
    const db = drizzle(c.env.DB);

    try {
        const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).get();
        if (!tournament) return c.json({ error: 'Tournament not found' }, 404);

        // Find clan by tag (case-insensitive via LIKE or just exact match for now)
        const clan = await db.select().from(clans).where(eq(clans.tag, clan_tag)).get();

        if (!clan) {
            return c.json({ error: 'Clan with that tag not found' }, 404);
        }

        // Check if already registered
        const existing = await db.select().from(tournamentParticipants)
            .where(and(eq(tournamentParticipants.tournament_id, tournamentId), eq(tournamentParticipants.clan_id, clan.id)))
            .get();

        if (existing) {
            return c.json({ error: 'Clan already registered' }, 400);
        }

        // Add to tournament
        await db.insert(tournamentParticipants).values({
            tournament_id: tournamentId,
            clan_id: clan.id,
            status: 'registered',
            registered_at: new Date().toISOString()
        }).execute();

        return c.json({ success: true, message: `Added clan ${clan.name} [${clan.tag}]` });

    } catch (e: any) {
        console.error('Error adding participant:', e);
        return c.json({ error: 'Failed to add participant' }, 500);
    }
});

// DELETE /api/moderator/tournaments/:id/participants/:clanId - Remove Clan
moderatorRoutes.delete('/tournaments/:id/participants/:clanId', async (c) => {
    const tournamentId = c.req.param('id');
    const clanId = c.req.param('clanId');
    const db = drizzle(c.env.DB);

    try {
        const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).get();
        if (!tournament) return c.json({ error: 'Tournament not found' }, 404);

        if (tournament.status === 'active' || tournament.status === 'completed') {
            return c.json({ error: 'Cannot remove participants from active/completed tournament' }, 400);
        }

        await db.delete(tournamentParticipants)
            .where(and(eq(tournamentParticipants.tournament_id, tournamentId), eq(tournamentParticipants.clan_id, clanId)))
            .execute();

        return c.json({ success: true, message: 'Clan removed' });
    } catch (e) {
        return c.json({ error: 'Failed to remove participant' }, 500);
    }
});

// POST /api/moderator/tournaments/:id/start
moderatorRoutes.post('/tournaments/:id/start', async (c) => {
    const tournamentId = c.req.param('id');
    const db = drizzle(c.env.DB);

    try {
        const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).get();
        if (!tournament) return c.json({ error: 'Not found' }, 404);
        if (tournament.status !== 'registration') return c.json({ error: 'Tournament already started or finished' }, 400);

        // Get participants
        const participants = await db.select().from(tournamentParticipants)
            .where(eq(tournamentParticipants.tournament_id, tournamentId))
            .all();

        if (participants.length < tournament.min_teams) {
            return c.json({ error: `Not enough teams. Min: ${tournament.min_teams}, Current: ${participants.length}` }, 400);
        }

        // Shuffle & Seed
        const shuffled = participants.sort(() => Math.random() - 0.5);

        // Update seeds
        for (let i = 0; i < shuffled.length; i++) {
            await db.update(tournamentParticipants)
                .set({ seed: i + 1 })
                .where(eq(tournamentParticipants.id, shuffled[i].id))
                .execute();
        }

        // Generate Bracket (Single Elimination)
        // Assume power of 2 for simplicity or handle byes (not doing complex byes now, just simple pairing)
        // We will generate matches for the first round.
        // Round 1 pairs: (1 vs 2), (3 vs 4), etc.

        const totalTeams = shuffled.length;
        const matchesCount = Math.floor(totalTeams / 2);

        // We need to generate the full bracket structure? 
        // Or just the first round?
        // Let's generate the WHOLE bracket structure if possible so we can visualize empty slots.
        // For N teams (power of 2), we have N-1 matches.

        // Simple 8 team bracket:
        // Round 1: 4 matches.
        // Round 2: 2 matches.
        // Round 3: 1 match.

        // Let's create Round 1 matches for now, and subsequent round empty matches

        // Calculate rounds needed
        let rounds = 1;
        let cTeams = totalTeams;
        while (cTeams > 2) {
            cTeams = cTeams / 2;
            rounds++;
        }

        // We will create matches for Round 1 populated with clans.
        // And placeholder matches for future rounds? 
        // For simplicity: Just Create Round 1. Future matches created when both winners exist?
        // Better for visualization: Create empty matches linked.

        // Recursive helper to build bracket?
        // Let's do it iteratively. 
        // Create Final Match -> Create Semis linking to Final -> Created Quarters linking to Semis. (Bottom-Up)

        // Example 4 teams:
        // Final (Round 2, Match 3)
        // -> Semi 1 (Round 1, Match 1) -> (Team 1, Team 2)
        // -> Semi 2 (Round 1, Match 2) -> (Team 3, Team 4)

        const createdMatches: any[] = [];

        // Function to create a match
        const createMatch = async (round: number, bracketId: number, nextMatchId: string | null) => {
            const mId = crypto.randomUUID();
            await db.insert(matches).values({
                id: mId,
                tournament_id: tournamentId,
                tournament_round: round,
                bracket_match_id: bracketId,
                next_match_id: nextMatchId,
                match_type: 'clan_war',
                host_id: tournament.id, // System hosted? Or use mod ID? Using tournament ID might fail FK if not player.
                // We need a dummy host or the moderator who started it.
                // Let's use the first admin/mod found or system default if possible.
                // Hack: Use the requester ID (moderator)
                status: 'waiting',
                lobby_url: `https://standoff2.mn/lobby/${mId}` // Placeholder
            } as any).execute(); // Cast to any to bypass host_id check if we can, or we need real host_id.
            // We need a real host ID.
            return mId;
        };

        // We assume 8 teams for now or 16. Power of 2 padding would be best.
        // Let's just pair 1vs2, 3vs4 for Round 1 and let manual management handle the rest if no full bracket gen.
        // User wants "Beautiful UI", so structure matters.

        // Simple approach: Pair registered teams into Round 1 Matches.
        for (let i = 0; i < matchesCount; i++) {
            const teamA = shuffled[i * 2];
            const teamB = shuffled[i * 2 + 1];

            // Create Match
            const mId = crypto.randomUUID();
            const modId = c.req.header('X-User-Id');
            if (!modId) return c.json({ error: 'Moderator ID missing' }, 400);

            await db.insert(matches).values({
                id: mId,
                tournament_id: tournamentId,
                tournament_round: 1,
                bracket_match_id: i + 1,
                match_type: 'clan_war',
                status: 'waiting',
                host_id: modId, // The moderator who started it becomes Host
                lobby_url: '#'
            }).execute();

            // Add Players (We don't know players yet! Clans join as a group).
            // We need to insert generic placeholder participants? 
            // match_players requires player_id.
            // We can't insert team A/B into match_players yet because they haven't selected their 5 players.
            // BUT we need to show who is playing.

            // Solution: We need `participants` column in `matches` or assume the clans are tracked via `tournament_participants`.
            // We will add `alpha_clan_id` and `bravo_clan_id` to `matches`? No schema change for now if possible.
            // We can insert the LEADER of the clan into `match_players` as captain?

            if (teamA) {
                await db.insert(matchPlayers).values({
                    match_id: mId,
                    player_id: (await getClanLeader(c.env, teamA.clan_id)) || 'unknown',
                    team: 'alpha',
                    is_captain: 1
                }).execute();
            }

            if (teamB) {
                await db.insert(matchPlayers).values({
                    match_id: mId,
                    player_id: (await getClanLeader(c.env, teamB.clan_id)) || 'unknown',
                    team: 'bravo',
                    is_captain: 1
                }).execute();
            }
        }

        await db.update(tournaments)
            .set({ status: 'active' })
            .where(eq(tournaments.id, tournamentId))
            .execute();

        return c.json({ success: true });

    } catch (e: any) {
        console.error(e);
        return c.json({ error: 'Failed to start' }, 500);
    }
});

async function getClanLeader(env: Env, clanId: string): Promise<string | null> {
    const db = drizzle(env.DB);
    const m = await db.select().from(clanMembers)
        .where(and(eq(clanMembers.clan_id, clanId), eq(clanMembers.role, 'leader')))
        .get();
    return m ? m.user_id : null;
}



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

        // 1. ATTEMPT TO LOCK THE MATCH
        const lockResult = await c.env.DB.prepare(`
            UPDATE matches 
            SET status = 'review_processing' 
            WHERE id = ? AND status = 'pending_review'
    `).bind(matchId).run();

        if (!lockResult.meta.changes) {
            // It might already be reviewed or not pending.
            // Check if it's already completed/cancelled
            const m = await c.env.DB.prepare('SELECT status FROM matches WHERE id = ?').bind(matchId).first();
            if (m && (m.status === 'completed' || m.status === 'cancelled')) {
                return c.json({ success: false, error: `Match already ${m.status} ` }, 409);
            }
            return c.json({ success: false, error: 'Match not in pending state or locked' }, 409);
        }

        // 2. Fetch the locked match details
        const match = await c.env.DB.prepare(
            'SELECT * FROM matches WHERE id = ?'
        ).bind(matchId).first();

        if (!match) {
            return c.json({ success: false, error: 'Match data not found' }, 404);
        }

        if (!body.approved) {
            // Reject - set back to cancelled
            await c.env.DB.prepare(`
                UPDATE matches 
                SET status = 'cancelled',
    reviewed_by = ?,
    reviewed_at = datetime('now'),
    review_notes = ?,
    updated_at = datetime('now')
                WHERE id = ?
    `).bind(moderatorId, body.notes || 'Rejected by moderator', matchId).run();

            // Log Action
            await logModeratorAction(c, moderatorId || 'system', 'MATCH_REJECT', matchId, { notes: body.notes });

            return c.json({
                success: true,
                message: 'Match rejected'
            });
        }

        // Approved - Apply ELO changes
        const winnerTeam = body.winner_team || match.winner_team;
        let eloChange = body.elo_change || 25; // Default ELO change

        if (match.match_type === 'competitive') {
            eloChange = 10;
        } else if (match.match_type === 'league') {
            eloChange = 25;
        }

        if (!winnerTeam) {
            // Rollback lock if data invalid
            await c.env.DB.prepare("UPDATE matches SET status = 'pending_review' WHERE id = ?").bind(matchId).run();
            return c.json({ success: false, error: 'Winner team is required' }, 400);
        }

        // Get all players in match
        const matchPlayersResult = await c.env.DB.prepare(`
            SELECT mp.player_id, mp.team, p.elo
            FROM match_players mp
            JOIN players p ON mp.player_id = p.id
            WHERE mp.match_id = ?
    `).bind(matchId).all();

        const playersList = matchPlayersResult.results || [];
        const moderatorIdForTracking = null; // Avoid FK constraint issues
        let safeHostId = match.host_id;

        try {
            const hostExists = await c.env.DB.prepare('SELECT id FROM players WHERE id = ?').bind(match.host_id).first();
            if (!hostExists) {
                console.warn('Match host deleted.');
            }
        } catch (e) {
            console.error('Check host error:', e);
        }

        // Apply ELO changes
        for (const player of playersList) {
            const isWinner = player.team === winnerTeam;
            const change = isWinner ? eloChange : -eloChange;
            const newElo = Math.max(0, (player.elo as number) + change);
            const reason = isWinner ? 'match_win' : 'match_loss';

            // Update player ELO and stats
            await c.env.DB.prepare(`
                UPDATE players SET elo = ?, wins = wins + ?, losses = losses + ? WHERE id = ?
    `).bind(newElo, isWinner ? 1 : 0, isWinner ? 0 : 1, player.player_id).run();

            // Record ELO history
            await c.env.DB.prepare(`
                INSERT INTO elo_history(user_id, match_id, elo_before, elo_after, elo_change, reason, created_by, notes, created_at)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `).bind(
                player.player_id,
                matchId,
                player.elo,
                newElo,
                change,
                reason,
                moderatorIdForTracking,
                body.notes || null
            ).run();
        }

        // Update Clan Elo if this was a Clan Match
        try {
            if (match.match_type === 'clan_war') {
                const alphaPlayer = playersList.find((p: any) => p.team === 'alpha');
                const bravoPlayer = playersList.find((p: any) => p.team === 'bravo');

                if (alphaPlayer && bravoPlayer) {
                    const clanAlpha = await c.env.DB.prepare(`SELECT c.* FROM clans c JOIN clan_members cm ON c.id = cm.clan_id WHERE cm.user_id = ? `).bind(alphaPlayer.player_id).first();
                    const clanBravo = await c.env.DB.prepare(`SELECT c.* FROM clans c JOIN clan_members cm ON c.id = cm.clan_id WHERE cm.user_id = ? `).bind(bravoPlayer.player_id).first();

                    if (clanAlpha && clanBravo && clanAlpha.id !== clanBravo.id) {
                        const clanEloChange = 25;
                        const isAlphaWinner = winnerTeam === 'alpha';

                        const alphaChange = isAlphaWinner ? clanEloChange : -clanEloChange;
                        const newAlphaElo = Math.max(0, (clanAlpha.elo as number || 1000) + alphaChange);

                        const bravoChange = isAlphaWinner ? -clanEloChange : clanEloChange;
                        const newBravoElo = Math.max(0, (clanBravo.elo as number || 1000) + bravoChange);

                        await c.env.DB.prepare(`
                                UPDATE clans SET elo = ?, wins = wins + ?, losses = losses + ? WHERE id = ?
    `).bind(newAlphaElo, isAlphaWinner ? 1 : 0, isAlphaWinner ? 0 : 1, clanAlpha.id).run();

                        await c.env.DB.prepare(`
                                UPDATE clans SET elo = ?, wins = wins + ?, losses = losses + ? WHERE id = ?
    `).bind(newBravoElo, isAlphaWinner ? 0 : 1, isAlphaWinner ? 1 : 0, clanBravo.id).run();
                    }
                }
            }
        } catch (clanError) {
            console.error('Error updating clan Stats (non-fatal):', clanError);
        }

        // Update match as completed
        await c.env.DB.prepare(`
            UPDATE matches 
            SET status = 'completed',
    winner_team = ?,
    alpha_score = ?,
    bravo_score = ?,
    reviewed_by = ?,
    host_id = ?,
    reviewed_at = datetime('now'),
    review_notes = ?,
    updated_at = datetime('now')
            WHERE id = ?
    `).bind(
            winnerTeam,
            body.alpha_score || 0,
            body.bravo_score || 0,
            moderatorIdForTracking,
            safeHostId,
            body.notes || null,
            matchId
        ).run();

        // Log Action
        await logModeratorAction(c, moderatorId || 'system', 'MATCH_REVIEW', matchId, {
            approved: true, winner: winnerTeam, eloChange, notes: body.notes
        });

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
            INSERT INTO elo_history(user_id, match_id, elo_before, elo_after, elo_change, reason, created_by, notes, created_at)
VALUES(?, NULL, ?, ?, ?, 'manual_adjustment', ?, ?, datetime('now'))
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

        // Log Action
        await logModeratorAction(c, moderatorId || 'system', 'MANUAL_ELO_ADJUST', playerId, {
            oldElo: player.elo, newElo, change: body.elo_change, reason: body.reason
        });

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
    const moderatorId = c.req.header('X-User-Id');

    try {
        await c.env.DB.prepare(
            'UPDATE players SET banned = 1 WHERE id = ? OR discord_id = ?'
        ).bind(playerId, playerId).run();

        // Log Action
        await logModeratorAction(c, moderatorId || 'system', 'BAN_USER', playerId, {});

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
    const moderatorId = c.req.header('X-User-Id');

    try {
        await c.env.DB.prepare(
            'UPDATE players SET banned = 0 WHERE id = ? OR discord_id = ?'
        ).bind(playerId, playerId).run();

        // Log Action
        await logModeratorAction(c, moderatorId || 'system', 'UNBAN_USER', playerId, {});

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

        // Log Action
        await logModeratorAction(c, requesterId || 'system', 'ROLE_CHANGE', playerId, { newRole: body.role });

        return c.json({
            success: true,
            message: `Role changed to ${body.role} `
        });
    } catch (error: any) {
        console.error('Error changing role:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// GET /api/moderator/version-check
moderatorRoutes.get('/version-check', (c) => c.json({
    version: 'v5-deployment-check',
    timestamp: Date.now(),
    env: c.env.FRONTEND_URL
}));

// GET /api/moderator/players - Get all players with pagination and search
moderatorRoutes.get('/players', async (c) => {

    // Prevent caching
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    c.header('X-Worker-Version', 'v10-final-fix');

    try {
        const page = Math.max(1, parseInt(c.req.query('page') || '1'));
        const limit = Math.max(1, Math.min(100, parseInt(c.req.query('limit') || '50')));
        const offset = (page - 1) * limit;
        const search = c.req.query('search') || '';

        console.log(`[players-v10] Fetching p=${page} l=${limit} s='${search}'`);

        let query = `
            SELECT id, discord_username, standoff_nickname, elo, role, is_vip, vip_until, discord_avatar, created_at 
            FROM players 
        `;

        const params: any[] = [];

        if (search.trim()) {
            query += ` WHERE (lower(discord_username) LIKE ? OR lower(standoff_nickname) LIKE ? OR id LIKE ?) `;
            const s = `%${search.toLowerCase()}%`;
            params.push(s, s, s);
        }

        query += ` ORDER BY elo DESC LIMIT ${limit} OFFSET ${offset}`;

        const result = await c.env.DB.prepare(query).bind(...params).all();
        const players = result.results || [];

        // Count
        let countQuery = `SELECT COUNT(*) as count FROM players`;
        const countParams: any[] = [];
        if (search.trim()) {
            countQuery += ` WHERE (lower(discord_username) LIKE ? OR lower(standoff_nickname) LIKE ? OR id LIKE ?) `;
            const s = `%${search.toLowerCase()}%`;
            countParams.push(s, s, s);
        }
        const countRes = await c.env.DB.prepare(countQuery).bind(...countParams).first();

        // Sanity Check for 'd'
        const sanity = await c.env.DB.prepare("SELECT * FROM players WHERE discord_username LIKE '%d%' LIMIT 1").first();

        return c.json({
            success: true,
            _version: 'v10-final-fix',
            players: players,
            page,
            total: countRes?.count || 0,
            debug: {
                query_sample: query.substring(0, 100),
                sanity_d_check: sanity
            }
        });
    } catch (error: any) {
        console.error('Fetch error:', error);
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

        // Log Action
        await logModeratorAction(c, moderatorId || 'system', 'MATCH_CANCEL', matchId, {});

        // Explicitly purge from Durable Object memory
        c.executionCtx.waitUntil(purgeLobby(matchId, c.env));

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

// POST /api/moderator/matches/:id/force-result - Force submit match result (Mod/Admin)
moderatorRoutes.post('/matches/:id/force-result', async (c) => {
    const matchId = c.req.param('id');
    const moderatorId = c.req.header('X-User-Id');

    try {
        const body = await c.req.json<{
            winner_team: 'alpha' | 'bravo';
            alpha_score: number;
            bravo_score: number;
            screenshot_url?: string;
        }>();

        if (!body.winner_team || body.alpha_score === undefined || body.bravo_score === undefined) {
            return c.json({ success: false, error: 'Winner team and scores are required' }, 400);
        }

        // Get match
        const match = await c.env.DB.prepare('SELECT * FROM matches WHERE id = ?').bind(matchId).first();
        if (!match) {
            return c.json({ success: false, error: 'Match not found' }, 404);
        }

        if (match.status === 'completed' || match.status === 'cancelled') {
            return c.json({ success: false, error: 'Match is already finished' }, 400);
        }

        // Determine Elo Change
        let eloChange = 25;
        if (match.match_type === 'competitive') {
            eloChange = 10;
        }

        // Get players
        const matchPlayersResult = await c.env.DB.prepare(`
            SELECT mp.player_id, mp.team, p.elo
            FROM match_players mp
            LEFT JOIN players p ON mp.player_id = p.id
            WHERE mp.match_id = ?
    `).bind(matchId).all();

        const playersList = matchPlayersResult.results || [];

        // Apply ELO changes
        for (const player of playersList) {
            const isWinner = player.team === body.winner_team;
            const change = isWinner ? eloChange : -eloChange;
            const newElo = Math.max(0, (player.elo as number) + change);
            const reason = isWinner ? 'match_win' : 'match_loss';

            // Update player
            await c.env.DB.prepare(`
                UPDATE players 
                SET elo = ?,
    wins = wins + ?,
    losses = losses + ?
        WHERE id = ?
            `).bind(newElo, isWinner ? 1 : 0, isWinner ? 0 : 1, player.player_id).run();

            // History
            await c.env.DB.prepare(`
                INSERT INTO elo_history(user_id, match_id, elo_before, elo_after, elo_change, reason, created_by, notes, created_at)
VALUES(?, ?, ?, ?, ?, ?, ?, 'Force result by moderator', datetime('now'))
            `).bind(
                player.player_id,
                matchId,
                player.elo,
                newElo,
                change,
                reason,
                moderatorId
            ).run();

            // Sync Discord
            await syncDiscordTiers(c.env, player.player_id as string, newElo);
        }

        // Clan Logic
        if (match.match_type === 'clan_war') {
            const alphaPlayer = playersList.find((p: any) => p.team === 'alpha');
            const bravoPlayer = playersList.find((p: any) => p.team === 'bravo');

            if (alphaPlayer && bravoPlayer) {
                const clanAlpha = await c.env.DB.prepare(`SELECT c.* FROM clans c JOIN clan_members cm ON c.id = cm.clan_id WHERE cm.user_id = ? `).bind(alphaPlayer.player_id).first();
                const clanBravo = await c.env.DB.prepare(`SELECT c.* FROM clans c JOIN clan_members cm ON c.id = cm.clan_id WHERE cm.user_id = ? `).bind(bravoPlayer.player_id).first();

                if (clanAlpha && clanBravo && clanAlpha.id !== clanBravo.id) {
                    const clanEloChange = 25;
                    const isAlphaWinner = body.winner_team === 'alpha';

                    // Update Alpha
                    const newAlphaElo = Math.max(0, (clanAlpha.elo as number || 1000) + (isAlphaWinner ? clanEloChange : -clanEloChange));
                    await c.env.DB.prepare(`UPDATE clans SET elo = ?, wins = wins + ?, losses = losses + ? WHERE id = ? `)
                        .bind(newAlphaElo, isAlphaWinner ? 1 : 0, isAlphaWinner ? 0 : 1, clanAlpha.id).run();

                    // Update Bravo
                    const newBravoElo = Math.max(0, (clanBravo.elo as number || 1000) + (isAlphaWinner ? -clanEloChange : clanEloChange));
                    await c.env.DB.prepare(`UPDATE clans SET elo = ?, wins = wins + ?, losses = losses + ? WHERE id = ? `)
                        .bind(newBravoElo, isAlphaWinner ? 0 : 1, isAlphaWinner ? 1 : 0, clanBravo.id).run();
                }
            }
        }

        // Complete Match
        await c.env.DB.prepare(`
            UPDATE matches 
            SET status = 'completed',
    winner_team = ?,
    alpha_score = ?,
    bravo_score = ?,
    result_screenshot_url = ?,
    reviewed_by = ?,
    reviewed_at = datetime('now'),
    review_notes = 'Force ended by moderator',
    updated_at = datetime('now')
            WHERE id = ?
    `).bind(
            body.winner_team,
            body.alpha_score,
            body.bravo_score,
            body.screenshot_url || null,
            moderatorId,
            matchId
        ).run();

        // Explicitly purge from Durable Object memory
        c.executionCtx.waitUntil(purgeLobby(matchId, c.env));

        return c.json({ success: true, message: 'Match force ended and results applied' });

    } catch (error: any) {
        console.error('Error force ending match:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/moderator/matches/create - Manual Match Creation
moderatorRoutes.post('/matches/create', async (c) => {
    const body = await c.req.json<{
        host_id: string;
        match_type: 'casual' | 'league' | 'clan_lobby' | 'clan_war' | 'competitive';
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
            INSERT INTO matches(id, lobby_url, host_id, map_name, match_type, status, player_count, max_players, clan_id, created_at, updated_at)
VALUES(?, ?, ?, ?, ?, 'waiting', 1, ?, ?, datetime('now'), datetime('now'))
    `).bind(matchId, 'manual_create', realHostId, body.map_name || null, matchType, maxPlayers, body.clan_id || null).run();

        await c.env.DB.prepare(`
            INSERT INTO match_players(match_id, player_id, team, is_captain, joined_at)
VALUES(?, ?, 'alpha', 1, datetime('now'))
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
            query += ` WHERE c.name LIKE ? OR c.tag LIKE ? `;
            params.push(`% ${search}% `, ` % ${search}% `);
        }

        query += ` ORDER BY c.created_at DESC LIMIT ? OFFSET ? `;
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
                INSERT INTO clans(id, name, tag, leader_id, max_members, created_at)
VALUES(?, ?, ?, ?, ?, datetime('now'))
    `).bind(clanId, request.clan_name, request.clan_tag, request.user_id, request.clan_size),

            c.env.DB.prepare(`
                INSERT INTO clan_members(clan_id, user_id, role, joined_at)
VALUES(?, ?, 'leader', datetime('now'))
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


// GET /api/moderator/audit-logs - Get audit logs
moderatorRoutes.get('/audit-logs', async (c) => {
    const page = parseInt(c.req.query('page') || '1');
    const limit = 50;
    const offset = (page - 1) * limit;

    try {
        const result = await c.env.DB.prepare(`
            SELECT
l.*,
    m.discord_username as moderator_username,
    m.discord_avatar as moderator_avatar
            FROM moderator_logs l
            LEFT JOIN players m ON l.moderator_id = m.id
            ORDER BY l.created_at DESC
LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

        const countResult = await c.env.DB.prepare(
            'SELECT COUNT(*) as count FROM moderator_logs'
        ).first();

        return c.json({
            success: true,
            logs: result.results || [],
            page,
            total: countResult?.count || 0
        });
    } catch (error: any) {
        console.error('Error fetching audit logs:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// ============= CLAN MANAGEMENT =============

// Searching clans
moderatorRoutes.get('/clans', async (c) => {
    const query = c.req.query('q') || '';

    // Simple search
    const results = await c.env.DB.prepare(`
        SELECT c.*, p.discord_username as leader_name,
    (SELECT COUNT(*) FROM clan_members WHERE clan_id = c.id) as member_count
        FROM clans c
        LEFT JOIN players p ON c.leader_id = p.id
        WHERE c.name LIKE ? OR c.tag LIKE ?
    LIMIT 50
        `).bind(` % ${query}% `, ` % ${query}% `).all();

    return c.json({ success: true, clans: results.results });
});

// Create Clan (Bypass costs)
moderatorRoutes.post('/clans', async (c) => {
    const { name, tag, leader_id, max_members, description } = await c.req.json();
    const moderatorId = c.req.header('X-User-Id') || 'unknown';

    // Validation
    if (!name || !tag || !leader_id) return c.json({ error: 'Missing fields' }, 400);

    try {
        const id = crypto.randomUUID();
        // Insert clan
        await c.env.DB.prepare(`
            INSERT INTO clans(id, name, tag, leader_id, max_members, description)
VALUES(?, ?, ?, ?, ?, ?)
    `).bind(id, name, tag, leader_id, max_members || 20, description || '').run();

        // Add leader to members
        await c.env.DB.prepare(`
            INSERT INTO clan_members(clan_id, user_id, role) VALUES(?, ?, 'leader')
    `).bind(id, leader_id).run();

        await logModeratorAction(c, moderatorId, 'create_clan', id, { name, tag, leader_id });

        return c.json({ success: true, clan_id: id });
    } catch (e: any) {
        return c.json({ success: false, error: e.message }, 500);
    }
});

// Update Clan
moderatorRoutes.put('/clans/:id', async (c) => {
    const id = c.req.param('id');
    const { name, tag, description, logo_url } = await c.req.json();
    const moderatorId = c.req.header('X-User-Id') || 'unknown';

    await c.env.DB.prepare(`
        UPDATE clans SET name = ?, tag = ?, description = ?, logo_url = ?
    WHERE id = ?
        `).bind(name, tag, description, logo_url, id).run();

    await logModeratorAction(c, moderatorId, 'edit_clan', id, { name, tag });

    return c.json({ success: true });
});

// Change Leader
moderatorRoutes.put('/clans/:id/leader', async (c) => {
    const id = c.req.param('id');
    const { new_leader_id } = await c.req.json();
    const moderatorId = c.req.header('X-User-Id') || 'unknown';

    // 1. Get old leader
    const clan = await c.env.DB.prepare('SELECT leader_id FROM clans WHERE id = ?').bind(id).first();
    const oldLeader = clan?.leader_id as string;

    if (!new_leader_id) return c.json({ error: 'Missing new_leader_id' }, 400);

    // 2. Update Clan table
    await c.env.DB.prepare('UPDATE clans SET leader_id = ? WHERE id = ?').bind(new_leader_id, id).run();

    // 3. Update Members table
    // Ensure new leader is member
    const isMember = await c.env.DB.prepare('SELECT id FROM clan_members WHERE clan_id = ? AND user_id = ?').bind(id, new_leader_id).first();
    if (!isMember) {
        await c.env.DB.prepare('INSERT INTO clan_members (clan_id, user_id, role) VALUES (?, ?, "leader")').bind(id, new_leader_id).run();
    } else {
        await c.env.DB.prepare('UPDATE clan_members SET role = "leader" WHERE clan_id = ? AND user_id = ?').bind(id, new_leader_id).run();
    }

    // Demote old leader to member
    if (oldLeader && oldLeader !== new_leader_id) {
        await c.env.DB.prepare('UPDATE clan_members SET role = "member" WHERE clan_id = ? AND user_id = ?').bind(id, oldLeader).run();
    }

    await logModeratorAction(c, moderatorId, 'change_clan_leader', id, { old_leader: oldLeader, new_leader: new_leader_id });

    return c.json({ success: true });
});

// Delete Clan
moderatorRoutes.delete('/clans/:id', async (c) => {
    const id = c.req.param('id');
    const moderatorId = c.req.header('X-User-Id') || 'unknown';
    // Delete members first
    await c.env.DB.prepare('DELETE FROM clan_members WHERE clan_id = ?').bind(id).run();
    await c.env.DB.prepare('DELETE FROM clans WHERE id = ?').bind(id).run();

    await logModeratorAction(c, moderatorId, 'delete_clan', id, {});

    return c.json({ success: true });
});

export { moderatorRoutes };

// POST /api/moderator/players/:id/elo-adjust - Manual Elo Adjustment
moderatorRoutes.post('/players/:id/elo-adjust', async (c) => {
    const userId = c.req.param('id');
    const moderatorId = c.req.header('X-User-Id');
    const body = await c.req.json<{ elo_change: number; reason: string }>();

    if (!moderatorId) return c.json({ error: 'Unauthorized' }, 401);
    if (!body.elo_change || isNaN(body.elo_change)) return c.json({ error: 'Valid elo_change is required' }, 400);

    try {
        const player = await c.env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(userId).first();
        if (!player) return c.json({ error: 'Player not found' }, 404);

        const currentElo = player.elo as number;
        const newElo = Math.max(0, currentElo + body.elo_change); // Ensure Elo doesn't go below 0
        const actualChange = newElo - currentElo;

        // Update Player Elo
        await c.env.DB.prepare('UPDATE players SET elo = ? WHERE id = ?')
            .bind(newElo, userId)
            .run();

        // Record History
        await c.env.DB.prepare(`
            INSERT INTO elo_history(user_id, elo_before, elo_after, elo_change, reason, created_by, notes, created_at)
VALUES(?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
            userId,
            currentElo,
            newElo,
            actualChange,
            'manual_adjustment',
            moderatorId,
            body.reason || 'Manual Adjustment via Moderator Dashboard'
        ).run();

        // Sync Discord Role
        // We fire and forget this to not block the response
        c.executionCtx.waitUntil(syncDiscordTiers(c.env, userId, newElo));

        // Log Action
        c.executionCtx.waitUntil(logModeratorAction(c.env, moderatorId, 'ELO_ADJUST', userId, {
            old_elo: currentElo,
            new_elo: newElo,
            change: actualChange,
            reason: body.reason
        }));

        return c.json({
            success: true,
            message: `Elo adjusted by ${actualChange} (New Elo: ${newElo})`
        });

    } catch (error: any) {
        console.error('Error adjusting elo:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});
