
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc } from 'drizzle-orm';
import { clanRequests, players } from '../db/schema';
import { verifyAuth } from '../middleware/auth';

// Define Env and Variables (copied/adapted from index.ts)
interface Env {
    DB: D1Database;
}

interface Variables {
    userId: string;
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use('*', verifyAuth);

// Submit a new clan request
app.post('/', async (c) => {
    const userId = c.get('userId') as string;
    const { clan_name, clan_tag, clan_size, screenshot_url } = await c.req.json();
    const db = drizzle(c.env.DB);

    // Validate inputs
    if (!clan_name || typeof clan_name !== 'string' ||
        !clan_tag || typeof clan_tag !== 'string' ||
        !screenshot_url || typeof screenshot_url !== 'string' ||
        !clan_size || typeof clan_size !== 'number') {
        return c.json({ success: false, error: 'Missing or invalid fields' }, 400);
    }

    try {
        await db.insert(clanRequests).values({
            user_id: userId,
            clan_name: clan_name,
            clan_tag: clan_tag,
            clan_size: clan_size,
            screenshot_url: screenshot_url,
            status: 'pending'
        }).run();

        return c.json({ success: true, message: 'Clan request submitted successfully' });

    } catch (e: any) {
        console.error('Submit clan request error:', e);
        return c.json({ success: false, error: e.message || 'Failed to submit request' }, 500);
    }
});

// Get my request status
app.get('/my-request', async (c) => {
    const userId = c.get('userId') as string;
    const db = drizzle(c.env.DB);

    try {
        const request = await db.select()
            .from(clanRequests)
            .where(eq(clanRequests.user_id, userId))
            .orderBy(desc(clanRequests.created_at))
            .limit(1)
            .get();

        return c.json({ success: true, request });
    } catch (e: any) {
        console.error('Get my request error:', e);
        return c.json({ success: false, error: 'Failed to fetch request' }, 500);
    }
});

export const clanRequestsRoutes = app;
