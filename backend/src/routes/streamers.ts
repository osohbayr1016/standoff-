
import { Hono } from 'hono';
import { eq, desc, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { streamers, players } from '../db/schema';
import { verifyAuth } from '../middleware/auth';

type Env = {
    DB: D1Database;
    DISCORD_SERVER_ID: string;
    DISCORD_BOT_TOKEN: string;
}

type Variables = {
    userId: string;
}

const app = new Hono<{ Bindings: Env, Variables: Variables }>();

const STREAMER_ROLE_ID = '1454759078592122890';

// Check if user has streamer role via Discord API
async function hasStreamerRole(userId: string, env: Env): Promise<boolean> {
    try {
        const db = drizzle(env.DB);
        const player = await db.select().from(players).where(eq(players.id, userId)).get();

        if (!player?.discord_id) return false;

        const response = await fetch(`https://discord.com/api/v10/guilds/${env.DISCORD_SERVER_ID}/members/${player.discord_id}`, {
            headers: {
                Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`
            }
        });

        if (response.ok) {
            const member = await response.json() as any;
            return member.roles.includes(STREAMER_ROLE_ID);
        }

        return false;
    } catch (e) {
        console.error('Error checking streamer role:', e);
        return false;
    }
}

// Public: Get all live streamers
app.get('/', async (c) => {
    const db = drizzle(c.env.DB);
    try {
        const liveStreamers = await db.select({
            id: streamers.id,
            platform: streamers.platform,
            channelUrl: streamers.channel_url,
            streamTitle: streamers.stream_title,
            username: players.discord_username, // Fixing column name from 'username' to 'discord_username'
            nickname: players.standoff_nickname,
            avatar: players.discord_avatar,
            discordId: players.discord_id,
            isLive: streamers.is_live,
        })
            .from(streamers)
            .innerJoin(players, eq(streamers.user_id, players.id))
            .where(eq(streamers.is_live, true))
            .orderBy(desc(streamers.last_live_at))
            .all();

        return c.json(liveStreamers);
    } catch (error) {
        console.error('Error fetching streamers:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

// Protected: Get my streamer profile
app.get('/my-profile', verifyAuth, async (c) => {
    const userId = c.get('userId') as string;
    const db = drizzle(c.env.DB);

    // Verify Role
    const isStreamer = await hasStreamerRole(userId, c.env);
    if (!isStreamer) {
        return c.json({ error: 'Unauthorized: You do not have the Streamer role.' }, 403);
    }

    try {
        const profile = await db.select().from(streamers).where(eq(streamers.user_id, userId)).get();
        return c.json(profile || null);
    } catch (error) {
        return c.json({ error: 'Server error' }, 500);
    }
});

// Protected: Update streamer profile
app.post('/profile', verifyAuth, async (c) => {
    const userId = c.get('userId') as string;
    const db = drizzle(c.env.DB);
    const { platform, channelUrl, streamTitle } = await c.req.json();

    // Verify Role
    const isStreamer = await hasStreamerRole(userId, c.env);
    if (!isStreamer) {
        return c.json({ error: 'Unauthorized: You do not have the Streamer role.' }, 403);
    }

    try {
        const existing = await db.select().from(streamers).where(eq(streamers.user_id, userId)).get();

        if (existing) {
            await db.update(streamers)
                .set({
                    platform: platform as string,
                    channel_url: channelUrl as string,
                    stream_title: streamTitle as string,
                    updated_at: new Date().toISOString()
                })
                .where(eq(streamers.user_id, userId))
                .execute();
        } else {
            await db.insert(streamers)
                .values({
                    user_id: userId,
                    platform: platform as string,
                    channel_url: channelUrl as string,
                    stream_title: streamTitle as string
                })
                .execute();
        }

        return c.json({ success: true });
    } catch (error) {
        console.error('Error updating streamer profile:', error);
        return c.json({ error: 'Failed to update profile' }, 500);
    }
});

// Protected: Toggle Live Status
app.post('/live', verifyAuth, async (c) => {
    const userId = c.get('userId') as string;
    const db = drizzle(c.env.DB);
    const { isLive, streamTitle } = await c.req.json();

    // Verify Role
    const isStreamer = await hasStreamerRole(userId, c.env);
    if (!isStreamer) {
        return c.json({ error: 'Unauthorized: You do not have the Streamer role.' }, 403);
    }

    try {
        const updateData: any = { is_live: isLive, updated_at: new Date().toISOString() };
        if (isLive) {
            updateData.last_live_at = new Date().toISOString();
        }
        if (streamTitle) {
            updateData.stream_title = streamTitle; // Typo fix
        }

        const result = await db.update(streamers)
            .set(updateData)
            .where(eq(streamers.user_id, userId))
            .execute();

        if (result.meta.changes > 0) {
            return c.json({ success: true, isLive });
        } else {
            return c.json({ error: 'Streamer profile not found. Please set up your profile first.' }, 404);
        }
    } catch (error) {
        console.error('Error toggling live status:', error);
        return c.json({ error: 'Failed to update status' }, 500);
    }
});

export const streamerRoutes = app;
