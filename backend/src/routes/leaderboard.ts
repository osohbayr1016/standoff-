
import { Hono } from 'hono';

export function setupLeaderboardRoutes(app: Hono<any>) {
    // Simple in-memory cache
    let cache: { data: any; timestamp: number } | null = null;
    const CACHE_TTL = 60 * 1000; // 60 seconds

    app.get('/api/leaderboard', async (c) => {
        try {
            const now = Date.now();

            // Return cached data if valid
            if (cache && (now - cache.timestamp < CACHE_TTL)) {
                c.header('X-Cache', 'HIT');
                return c.json(cache.data);
            }

            // Use raw SQL to avoid Drizzle ORM ambiguity
            // Filter only VIP members
            const result = await c.env.DB.prepare(
                "SELECT * FROM players WHERE is_vip = 1 OR is_vip = 'true' OR is_vip = true ORDER BY elo DESC LIMIT 500"
            ).all();

            c.header('X-Debug-Version', 'v2-checking-db');
            c.header('X-Debug-Row-Count', String(result.results?.length || 0));

            // Calculate regional stats
            // Calculate regional stats
            const players = result.results || [];
            const totalPlayers = players.length;

            // Calculate average Elo only from players who have played matches (Elo != 1000)
            const activeEloPlayers = players.filter((p: any) => p.elo && p.elo !== 1000);
            const averageElo = activeEloPlayers.length > 0
                ? Math.round(activeEloPlayers.reduce((sum: number, p: any) => sum + p.elo, 0) / activeEloPlayers.length)
                : 1000;
            const totalMatches = players.reduce((sum: number, p: any) => sum + (p.wins || 0) + (p.losses || 0), 0);

            // Map results to expected format with enhanced fields
            const leaderboard = players.map((player: any, index: number) => {
                const totalPlayerMatches = (player.wins || 0) + (player.losses || 0);
                const winRate = totalPlayerMatches > 0 ? ((player.wins || 0) / totalPlayerMatches) * 100 : 0;

                return {
                    rank: index + 1,
                    id: player.id,
                    discord_id: player.discord_id,
                    username: player.discord_username,
                    avatar: player.discord_avatar,
                    nickname: player.standoff_nickname,
                    elo: player.elo,
                    wins: player.wins,
                    losses: player.losses,
                    allies_elo: player.allies_elo,
                    allies_wins: player.allies_wins,
                    allies_losses: player.allies_losses,
                    total_matches: totalPlayerMatches,
                    win_rate: Math.round(winRate * 10) / 10, // Round to 1 decimal
                    is_discord_member: player.is_discord_member === 1,
                    is_vip: player.is_vip === 1 || player.is_vip === 'true' || player.is_vip === true
                };
            });

            // Response with stats
            const response = {
                players: leaderboard,
                stats: {
                    total_vip_players: totalPlayers,
                    average_elo: averageElo,
                    total_matches: totalMatches
                }
            };

            // Update cache
            cache = {
                data: response,
                timestamp: now
            };

            c.header('X-Cache', 'MISS');
            c.header('Cache-Control', 'public, max-age=60');
            return c.json(response);
        } catch (error) {
            console.error('Leaderboard fetch error:', error);
            // Log full error details
            if (error instanceof Error) {
                console.error(error.message);
                console.error(error.stack);
            }
            return c.json({
                error: 'Failed to fetch leaderboard',
                details: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            }, 500);
        }
    });
}
