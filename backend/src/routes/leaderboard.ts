
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { desc, sql } from 'drizzle-orm';
import { players } from '../db/schema';

export function setupLeaderboardRoutes(app: Hono<any>) {
    app.get('/api/leaderboard', async (c) => {
        try {
            const db = drizzle(c.env.DB);
            // Fetch top 500 players sorted by ELO descending
            const topPlayers = await db.select({
                id: players.id,
                discord_id: players.discord_id,
                username: players.discord_username,
                avatar: players.discord_avatar,
                nickname: players.standoff_nickname,
                elo: players.elo,
                wins: players.wins,
                losses: players.losses,
            })
                .from(players)
                .orderBy(desc(players.elo))
                .limit(500)
                .all();

            // Add rank index
            const leaderboard = topPlayers.map((player, index) => ({
                rank: index + 1,
                ...player
            }));

            return c.json(leaderboard);
        } catch (error) {
            console.error('Leaderboard fetch error:', error);
            return c.json({ error: 'Failed to fetch leaderboard' }, 500);
        }
    });
}
