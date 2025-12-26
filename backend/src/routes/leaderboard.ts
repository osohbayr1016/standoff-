
import { Hono } from 'hono';

export function setupLeaderboardRoutes(app: Hono<any>) {
    app.get('/api/leaderboard', async (c) => {
        try {
            // Use raw SQL to avoid Drizzle ORM ambiguity
            const result = await c.env.DB.prepare(
                'SELECT * FROM players ORDER BY elo DESC LIMIT 500'
            ).all();

            // Map results to expected format
            // D1 .all() returns { results: [], ... }
            const leaderboard = (result.results || []).map((player: any, index: number) => ({
                rank: index + 1,
                id: player.id,
                discord_id: player.discord_id,
                username: player.discord_username,
                avatar: player.discord_avatar, // Map 'discord_avatar' column to 'avatar' prop
                nickname: player.standoff_nickname,
                elo: player.elo,
                wins: player.wins,
                losses: player.losses,
                is_discord_member: player.is_discord_member === 1
            }));

            return c.json(leaderboard);
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
