
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc } from 'drizzle-orm';
import { clanRequests, players } from '../db/schema';
import { verifyAuth } from '../middleware/auth';
import { QPayService } from '../utils/qpay';

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

// POST /api/clan-requests/invoice - Create QPay invoice for Clan Creation
app.post('/invoice', async (c) => {
    const userId = c.get('userId') as string;
    const { clan_size } = await c.req.json<{ clan_size: number }>();

    if (!clan_size || ![20, 50].includes(clan_size)) {
        return c.json({ success: false, error: 'Invalid clan size' }, 400);
    }

    const price = clan_size === 20 ? 20000 : 50000;

    try {
        const invoice = await QPayService.createInvoice(price, `Clan Creation (${clan_size} slots)`, userId);
        return c.json({ success: true, invoice });
    } catch (e: any) {
        return c.json({ success: false, error: e.message }, 500);
    }
});

// POST /api/clan-requests/check-payment
app.post('/check-payment', async (c) => {
    const userId = c.get('userId') as string;
    const {
        invoice_id,
        clan_name,
        clan_tag,
        clan_size
    } = await c.req.json<{
        invoice_id: string;
        clan_name: string;
        clan_tag: string;
        clan_size: number;
    }>();

    try {
        const isPaid = await QPayService.checkInvoice(invoice_id);

        if (isPaid) {
            const db = drizzle(c.env.DB);
            const { clans, clanMembers } = await import('../db/schema');

            // 1. Safety Checks
            // Check if user is already in a clan
            const existingMember = await db.select()
                .from(clanMembers)
                .where(eq(clanMembers.user_id, userId))
                .get();

            if (existingMember) {
                return c.json({ success: false, error: 'You are already in a clan' }, 400);
            }

            // Check if clan name or tag is already taken
            const existingClan = await db.select()
                .from(clans)
                .where(eq(clans.name, clan_name))
                .get();

            if (existingClan) {
                return c.json({ success: false, error: 'Clan name already exists' }, 400);
            }

            // 2. Automated Clan Creation
            const clanId = crypto.randomUUID();

            // Insert into clans
            await db.insert(clans).values({
                id: clanId,
                name: clan_name,
                tag: clan_tag,
                leader_id: userId,
                max_members: clan_size,
                elo: 1000
            }).run();

            // Insert into clan_members as leader
            await db.insert(clanMembers).values({
                id: crypto.randomUUID(),
                clan_id: clanId,
                user_id: userId,
                role: 'leader'
            }).run();

            // 3. Log the request as auto-approved
            await db.insert(clanRequests).values({
                user_id: userId,
                clan_name: clan_name,
                clan_tag: clan_tag,
                clan_size: clan_size,
                screenshot_url: `QPAY:${invoice_id}`, // QPay Marker
                status: 'approved',
                updated_at: new Date().toISOString()
            }).run();

            return c.json({ success: true, paid: true, message: 'Payment confirmed. Clan created successfully!' });
        } else {
            return c.json({ success: true, paid: false, message: 'Payment not found yet.' });
        }
    } catch (e: any) {
        console.error('Check payment error:', e);
        return c.json({ success: false, error: e.message }, 500);
    }
});

export const clanRequestsRoutes = app;
