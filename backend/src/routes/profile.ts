
import { Hono } from 'hono';
import { nicknameSchema, updateProfileSchema } from '../schemas/profile';

export function setupProfileRoutes(app: Hono<any>) {
    // GET /api/profile/:userId - Get user profile
    app.get('/api/profile/:userId', async (c) => {
        try {
            const userId = c.req.param('userId');

            // Use raw SQL for simplicity and robustness
            const user = await c.env.DB.prepare(
                'SELECT * FROM players WHERE discord_id = ?'
            ).bind(userId).first();

            if (!user) {
                return c.json({ error: 'User not found' }, 404);
            }

            // Standardize response
            return c.json({
                id: user.discord_id,
                discord_id: user.discord_id,
                discord_username: user.discord_username,
                discord_avatar: user.discord_avatar,
                username: user.discord_username,
                avatar: user.discord_avatar, // Map to avatar
                standoff_nickname: user.standoff_nickname,
                elo: user.elo || 1000,
                wins: user.wins || 0,
                losses: user.losses || 0,
                role: user.role || 'user',
                is_discord_member: user.is_discord_member === 1
            });
        } catch (error) {
            console.error('❌ Profile fetch error:', error);
            if (error instanceof Error) {
                console.error('Error stack:', error.stack);
            }
            return c.json({
                error: 'Failed to fetch profile',
                details: error instanceof Error ? error.message : String(error)
            }, 500);
        }
    });

    // PUT /api/profile/nickname - Update Standoff 2 nickname
    app.put('/api/profile/nickname', async (c) => {
        try {
            const body = await c.req.json();

            // Validate with Zod
            const validation = updateProfileSchema.safeParse(body);
            if (!validation.success) {
                return c.json({
                    error: 'Validation failed',
                    details: validation.error.issues
                }, 400);
            }

            const { userId, nickname } = validation.data;

            // Check if nickname is already taken via raw SQL
            const existing = await c.env.DB.prepare(
                'SELECT * FROM players WHERE standoff_nickname = ?'
            ).bind(nickname).first();

            if (existing && existing.discord_id !== userId) {
                return c.json({ error: 'Nickname already taken' }, 409);
            }

            // Update database via raw SQL
            const result = await c.env.DB.prepare(
                'UPDATE players SET standoff_nickname = ?, nickname_updated_at = ? WHERE discord_id = ?'
            ).bind(nickname, new Date().toISOString(), userId).run();

            if (result.meta?.changes === 0) {
                return c.json({ error: 'User not found in database. Please logout and login again.' }, 404);
            }

            // Update Discord server nickname via bot
            let discordUpdated = false;

            if (c.env.DISCORD_BOT_TOKEN && c.env.DISCORD_SERVER_ID) {
                // Dynamic import to avoid loading utility if not needed
                const { updateDiscordNickname } = await import('../utils/discord');
                discordUpdated = await updateDiscordNickname(
                    userId,
                    nickname,
                    c.env.DISCORD_BOT_TOKEN,
                    c.env.DISCORD_SERVER_ID
                );
            }

            return c.json({
                success: true,
                nickname,
                discord_updated: discordUpdated
            });
        } catch (error) {
            console.error('❌ Nickname update database error:', error);
            if (error instanceof Error) {
                console.error('Error details:', error.message);
                console.error('Error stack:', error.stack);
            }
            return c.json({
                error: 'Failed to update nickname',
                details: error instanceof Error ? error.message : 'Database execution failed'
            }, 500);
        }
    });

    // GET /api/profile/check-nickname/:nickname - Check availability
    app.get('/api/profile/check-nickname/:nickname', async (c) => {
        try {
            const nickname = c.req.param('nickname');

            // Validate with Zod
            const validation = nicknameSchema.safeParse(nickname);
            if (!validation.success) {
                return c.json({
                    available: false,
                    error: validation.error.issues[0].message
                });
            }

            const existing = await c.env.DB.prepare(
                'SELECT * FROM players WHERE standoff_nickname = ?'
            ).bind(nickname).first();

            return c.json({ available: !existing });
        } catch (error) {
            console.error('Nickname check error:', error);
            return c.json({ available: false, error: 'Check failed' }, 500);
        }
    });

    // GET /api/profile/:userId/matches - Get match history
    app.get('/api/profile/:userId/matches', async (c) => {
        try {
            const userId = c.req.param('userId');

            // Find all matches user participated in
            // Find all matches user participated in
            const matches = await c.env.DB.prepare(
                `SELECT 
                    m.id as match_id, 
                    m.map_name, 
                    m.status, 
                    m.winner_team,
                    m.created_at,
                    m.result_screenshot_url,
                    mp.team as player_team,
                    mp.joined_at,
                    m.alpha_score,
                    m.bravo_score,
                    eh.elo_change
                FROM matches m
                JOIN match_players mp ON m.id = mp.match_id
                LEFT JOIN elo_history eh ON m.id = eh.match_id AND eh.user_id = ?
                WHERE mp.player_id = ? AND m.status IN ('completed', 'pending_review')
                ORDER BY m.created_at DESC
                LIMIT 20`
            ).bind(userId, userId).all();

            return c.json({ matches: matches.results || [] });
        } catch (error) {
            console.error('Match history error:', error);
            return c.json({ error: 'Failed to fetch match history' }, 500);
        }
    });

    // GET /api/profile/:userId/elo-history - Get ELO history
    app.get('/api/profile/:userId/elo-history', async (c) => {
        try {
            const userId = c.req.param('userId');

            const history = await c.env.DB.prepare(
                `SELECT * FROM elo_history 
                 WHERE user_id = ? 
                 ORDER BY created_at ASC`
            ).bind(userId).all();

            return c.json({ history: history.results || [] });
        } catch (error) {
            console.error('ELO history error:', error);
            return c.json({ error: 'Failed to fetch ELO history' }, 500);
        }
    });
}
