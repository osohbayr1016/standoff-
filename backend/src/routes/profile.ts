import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { players } from '../db/schema';
import { nicknameSchema, updateProfileSchema } from '../schemas/profile';

export function setupProfileRoutes(app: Hono<any>) {
    // GET /api/profile/:userId - Get user profile
    app.get('/api/profile/:userId', async (c) => {
        try {
            const userId = c.req.param('userId');
            const db = drizzle(c.env.DB);

            const user = await db.select().from(players).where(eq(players.discord_id, userId)).get();

            if (!user) {
                return c.json({ error: 'User not found' }, 404);
            }

            return c.json(user);
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
            const db = drizzle(c.env.DB);

            // Check if nickname is already taken
            const existing = await db.select().from(players)
                .where(eq(players.standoff_nickname, nickname)).get();

            if (existing && existing.discord_id !== userId) {
                return c.json({ error: 'Nickname already taken' }, 409);
            }

            // Update database
            const result = await db.update(players)
                .set({
                    standoff_nickname: nickname,
                    nickname_updated_at: new Date().toISOString()
                })
                .where(eq(players.discord_id, userId))
                .run();

            if (result.meta.changes === 0) {
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

            const db = drizzle(c.env.DB);
            const existing = await db.select().from(players)
                .where(eq(players.standoff_nickname, nickname)).get();

            return c.json({ available: !existing });
        } catch (error) {
            console.error('Nickname check error:', error);
            return c.json({ available: false, error: 'Check failed' }, 500);
        }
    });
}
