
import { Hono } from 'hono';

export function setupStatsRoutes(app: Hono<any>) {
    app.get('/api/stats', async (c) => {
        try {
            const db = c.env.DB;

            // Get total matches today
            const matchesToday = await db.prepare(`
                SELECT COUNT(*) as count 
                FROM matches 
                WHERE DATE(created_at) = DATE('now')
            `).first();

            // Get total matches this week
            const matchesWeek = await db.prepare(`
                SELECT COUNT(*) as count 
                FROM matches 
                WHERE created_at >= DATE('now', '-7 days')
            `).first();

            // Get active players (players who played in last 24 hours)
            const activePlayers = await db.prepare(`
                SELECT COUNT(DISTINCT player_id) as count
                FROM match_players mp
                JOIN matches m ON mp.match_id = m.id
                WHERE m.created_at >= DATETIME('now', '-24 hours')
            `).first();

            // Get most popular map
            const popularMap = await db.prepare(`
                SELECT map_name, COUNT(*) as count
                FROM matches
                WHERE map_name IS NOT NULL
                AND created_at >= DATE('now', '-7 days')
                GROUP BY map_name
                ORDER BY count DESC
                LIMIT 1
            `).first();

            // Get average match duration (in minutes)
            const avgDuration = await db.prepare(`
                SELECT AVG(
                    (JULIANDAY(updated_at) - JULIANDAY(created_at)) * 24 * 60
                ) as avg_minutes
                FROM matches
                WHERE status = 'completed'
                AND created_at >= DATE('now', '-7 days')
            `).first();

            // Get Ongoing Matches by Rank (Bronze, Silver, Gold)
            // Using a simplified logic: 
            // Bronze: Avg ELO < 1000
            // Silver: Avg ELO 1000 - 1499
            // Gold: Avg ELO >= 1500
            // We need to join with players to get ELOs, or assume based on some other metric.
            // Since calculating live avg elo is complex in SQL without stored avg, we will fetch active matches and their players' avg ELO.
            // OR simpler: Just count total active matches and distribute them randomly for demo if data is sparse, 
            // BUT let's try to be real. We will fetch active matches and calculate in JS for flexibility.

            // Get Ongoing Matches by Rank (Bronze, Silver, Gold) & Casual
            const activeMatches = await db.prepare(`
                SELECT m.id, m.match_type, AVG(p.elo) as avg_elo
                FROM matches m
                JOIN match_players mp ON m.id = mp.match_id
                JOIN players p ON mp.player_id = p.id
                WHERE m.status IN ('in_progress', 'ready')
                GROUP BY m.id
            `).all();

            const ongoingStats = {
                bronze: 0,
                silver: 0,
                gold: 0,
                casual: 0
            };

            if (activeMatches.results) {
                activeMatches.results.forEach((m: any) => {
                    if (m.match_type === 'casual') {
                        ongoingStats.casual++;
                    } else {
                        const elo = m.avg_elo || 1000;
                        // Bronze: < 1200
                        if (elo < 1200) ongoingStats.bronze++;
                        // Silver: 1200 - 1599
                        else if (elo < 1600) ongoingStats.silver++;
                        // Gold: 1600+
                        else ongoingStats.gold++;
                    }
                });
            }

            return c.json({
                success: true,
                stats: {
                    matches_today: matchesToday?.count || 0,
                    matches_week: matchesWeek?.count || 0,
                    active_players: activePlayers?.count || 0,
                    popular_map: popularMap?.map_name || 'N/A',
                    avg_duration_minutes: Math.round(avgDuration?.avg_minutes || 0),
                    ongoing_matches_by_rank: ongoingStats
                }
            });
        } catch (error) {
            console.error('Stats fetch error:', error);
            return c.json({
                success: false,
                error: 'Failed to fetch stats',
                details: error instanceof Error ? error.message : String(error)
            }, 500);
        }
    });

    app.get('/api/stats/live', async (c) => {
        try {
            const id = c.env.MATCH_QUEUE.idFromName('global');
            const stub = c.env.MATCH_QUEUE.get(id);
            const res = await stub.fetch('http://do/debug');
            const data: any = await res.json();

            // Also get DB count for total registered
            const totalUsersResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM players').first();

            return c.json({
                success: true,
                online_users: data.sessionsCount || 0,
                active_matches: data.activeLobbies ? data.activeLobbies.length : 0,
                active_lobbies: data.activeLobbies ? data.activeLobbies.length : 0, // Alias for clarity
                total_users: totalUsersResult?.count || 0
            });
        } catch (error) {
            console.error('Live stats error:', error);
            // Fallback to 0 if DO is unreachable
            return c.json({ success: true, online_users: 0, active_matches: 0, total_users: 0 });
        }
    });
}
