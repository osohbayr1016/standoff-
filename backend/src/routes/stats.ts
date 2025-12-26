
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

            return c.json({
                success: true,
                stats: {
                    matches_today: matchesToday?.count || 0,
                    matches_week: matchesWeek?.count || 0,
                    active_players: activePlayers?.count || 0,
                    popular_map: popularMap?.map_name || 'N/A',
                    avg_duration_minutes: Math.round(avgDuration?.avg_minutes || 0)
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
