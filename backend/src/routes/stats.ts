
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

            const activeMatches = await db.prepare(`
                SELECT m.id, AVG(p.elo) as avg_elo
                FROM matches m
                JOIN match_players mp ON m.id = mp.match_id
                JOIN players p ON mp.player_id = p.id
                WHERE m.status IN ('in_progress', 'ready')
                GROUP BY m.id
            `).all();

            const ongoingByRank = {
                bronze: 0,
                silver: 0,
                gold: 0
            };

            if (activeMatches.results) {
                activeMatches.results.forEach((m: any) => {
                    const elo = m.avg_elo || 1000;
                    // Bronze: Level 1-3 (Max 900)
                    if (elo <= 900) ongoingByRank.bronze++;
                    // Silver: Level 4-7 (Max 1530)
                    else if (elo <= 1530) ongoingByRank.silver++;
                    // Gold: Level 8-10 (1531+)
                    else ongoingByRank.gold++;
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
                    ongoing_matches_by_rank: ongoingByRank
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
}
