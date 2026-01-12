
import { Hono } from 'hono';
import { players, goldTransactions, goldOrders, goldPrices } from '../db/schema';
import { eq, desc, and, asc, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';

interface Env {
    DB: D1Database;
    GOLD_SELLER_ROLE_ID?: string;
}

const goldRoutes = new Hono<{ Bindings: Env }>();
const GOLD_SELLER_ROLE_ID = '1455115991049703579';
const DEFAULT_PRICES = [
    { gold: 100, price: 5000 }, { gold: 200, price: 9000 }, { gold: 300, price: 12000 },
    { gold: 400, price: 15000 }, { gold: 500, price: 17000 }, { gold: 600, price: 20000 },
    { gold: 700, price: 24000 }, { gold: 800, price: 27000 }, { gold: 900, price: 29000 },
    { gold: 1000, price: 31000 }, { gold: 1100, price: 35000 }, { gold: 1200, price: 39000 },
    { gold: 1300, price: 41000 }, { gold: 1400, price: 45000 }, { gold: 1500, price: 48000 },
    { gold: 1600, price: 53000 }, { gold: 1700, price: 56000 }, { gold: 2000, price: 58000 },
    { gold: 2100, price: 63000 }, { gold: 2200, price: 67000 }, { gold: 2300, price: 72000 },
    { gold: 2500, price: 75000 }, { gold: 3000, price: 88000 }, { gold: 3500, price: 108000 },
    { gold: 4000, price: 116000 }, { gold: 4500, price: 135000 }, { gold: 5000, price: 148000 },
    { gold: 6000, price: 178000 }
];

// Middleware to check Gold Seller Role
async function requireGoldSeller(c: any, next: any) {
    const userId = c.req.header('X-User-Id');
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const db = drizzle(c.env.DB);
    const user = await db.select().from(players).where(eq(players.id, userId)).get();

    if (!user) return c.json({ error: 'User not found' }, 404);

    const ALLOWED_SELLERS = ['1237067681623052288', '656126101235695626'];
    const isAllowed = ALLOWED_SELLERS.includes(user.id) || (user.discord_id && ALLOWED_SELLERS.includes(user.discord_id));

    if (!isAllowed) {
        return c.json({ error: 'Permission denied: Gold Seller access restricted' }, 403);
    }

    c.set('user', user);
    await next();
    await next();
}

// GET /api/gold/prices - Get current price list
goldRoutes.get('/prices', async (c) => {
    const db = drizzle(c.env.DB);
    let prices = await db.select().from(goldPrices).orderBy(asc(goldPrices.gold)).all();

    // If empty, return default (and optionally auto-init)
    if (prices.length === 0) {
        return c.json({ success: true, prices: DEFAULT_PRICES });
    }

    return c.json({ success: true, prices });
});

// POST /api/gold/prices/init - Initialize defaults (Admin/Seller only)
goldRoutes.post('/prices/init', requireGoldSeller, async (c) => {
    const db = drizzle(c.env.DB);
    const existing = await db.select().from(goldPrices).limit(1).get();
    if (existing) return c.json({ message: 'Prices already initialized' });

    // Bulk insert not always supported in D1 via drizzle concisely depending on version, loop is safe
    const stmt = c.env.DB.prepare('INSERT INTO gold_prices (gold, price) VALUES (?, ?)');
    const batch = DEFAULT_PRICES.map(p => stmt.bind(p.gold, p.price));
    await c.env.DB.batch(batch);

    return c.json({ success: true, message: 'Prices initialized' });
});

// POST /api/gold/prices - Update a single price (Seller Only)
goldRoutes.post('/prices', requireGoldSeller, async (c) => {
    const { gold, price } = await c.req.json();
    if (!gold || !price) return c.json({ error: 'Missing fields' }, 400);

    const db = drizzle(c.env.DB);

    // Upsert
    await db.insert(goldPrices).values({ gold, price })
        .onConflictDoUpdate({ target: goldPrices.gold, set: { price } })
        .run();

    return c.json({ success: true, message: 'Price updated' });
});

// POST /api/gold/manual - Manual Gold Transfer (Seller Only)
goldRoutes.post('/manual', requireGoldSeller, async (c) => {
    const { userId, amount, reason } = await c.req.json();
    if (!userId || !amount || !reason) return c.json({ error: 'Missing fields' }, 400);

    const db = drizzle(c.env.DB);

    // Check user exists
    const user = await db.select().from(players).where(eq(players.id, userId)).get();
    if (!user) return c.json({ error: 'User not found' }, 404);

    // Update Balance
    await db.update(players)
        .set({ gold: sql`${players.gold} + ${amount}` })
        .where(eq(players.id, userId))
        .run();

    // Log Transaction
    await db.insert(goldTransactions).values({
        user_id: userId,
        amount: amount,
        reason: reason,
        created_by: c.get('user').id
    }).run();

    return c.json({ success: true, message: 'Transaction successful' });
});

// GET /api/gold/balance - Get current user's gold balance
goldRoutes.get('/balance', async (c) => {
    const userId = c.req.header('X-User-Id');
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const db = drizzle(c.env.DB);
    const user = await db.select({ gold: players.gold }).from(players).where(eq(players.id, userId)).get();

    return c.json({ success: true, gold: user?.gold || 0 });
});

// POST /api/gold/add - Add gold to a user (Seller Only)
goldRoutes.post('/add', requireGoldSeller, async (c) => {
    try {
        const { targetUserId, amount, reason } = await c.req.json();
        const sellerId = c.req.header('X-User-Id');

        if (!targetUserId || !amount || !reason) {
            return c.json({ success: false, error: 'targetUserId, amount, and reason are required' }, 400);
        }

        const db = drizzle(c.env.DB);

        // 1. Verify target user
        const target = await db.select().from(players).where(eq(players.id, targetUserId)).get();
        if (!target) {
            // Try searching by discord_id
            const targetByDiscord = await db.select().from(players).where(eq(players.discord_id, targetUserId)).get();
            if (!targetByDiscord) return c.json({ success: false, error: 'Target user not found' }, 404);
            // use the found user
        }

        // We use sql transaction if possible, or just sequential waits
        // D1 supports batch().

        // Update User Balance
        await c.env.DB.prepare('UPDATE players SET gold = gold + ? WHERE id = ? OR discord_id = ?')
            .bind(amount, targetUserId, targetUserId).run();

        // Get updated user id (to ensure we log correct UUID if input was discord_id)
        const updatedUser = await c.env.DB.prepare('SELECT id FROM players WHERE id= ? OR discord_id = ?').bind(targetUserId, targetUserId).first();
        const finalTargetId = updatedUser?.id as string;

        // Log Transaction
        await db.insert(goldTransactions).values({
            user_id: finalTargetId,
            amount: Number(amount),
            reason: reason,
            created_by: sellerId
        }).run();

        return c.json({ success: true, message: 'Gold added successfully', targetId: finalTargetId, amount });
    } catch (e: any) {
        console.error('Add Gold Error:', e);
        return c.json({ success: false, error: e.message }, 500);
    }
});

// GET /api/gold/history - Get transaction history (Seller Only)
goldRoutes.get('/history', requireGoldSeller, async (c) => {
    const db = drizzle(c.env.DB);

    // Fetch last 50 transactions with user details
    const history = await c.env.DB.prepare(`
        SELECT 
            gt.id, gt.amount, gt.reason, gt.created_at,
            recipient.discord_username as recipient_name,
            recipient.discord_avatar as recipient_avatar,
            seller.discord_username as seller_name
        FROM gold_transactions gt
        LEFT JOIN players recipient ON gt.user_id = recipient.id
        LEFT JOIN players seller ON gt.created_by = seller.id
        ORDER BY gt.created_at DESC
        LIMIT 50
    `).all();

    return c.json({ success: true, transactions: history.results });
});

// GET /api/gold/find-user?query=... (Seller Only helper)
goldRoutes.get('/find-user', requireGoldSeller, async (c) => {
    const query = c.req.query('query');
    if (!query || query.length < 3) return c.json({ success: false, users: [] });

    const results = await c.env.DB.prepare(`
        SELECT id, discord_id, discord_username, discord_avatar, gold 
        FROM players 
        WHERE discord_username LIKE ? OR discord_id LIKE ? OR standoff_nickname LIKE ?
        LIMIT 5
    `).bind(`%${query}%`, `%${query}%`, `%${query}%`).all();

    return c.json({ success: true, users: results.results });
});


// POST /api/gold/request - User requests gold (Order)
goldRoutes.post('/request', async (c) => {
    try {
        const userId = c.req.header('X-User-Id');
        if (!userId) return c.json({ error: 'Unauthorized' }, 401);

        const { goldAmount, priceMnt, proofUrl, graffitiUrl } = await c.req.json();
        if (!goldAmount || !proofUrl || !graffitiUrl) {
            return c.json({ success: false, error: 'goldAmount, proofUrl, and graffitiUrl are required' }, 400);
        }

        const db = drizzle(c.env.DB);

        // Check pending orders limit? (Optional)

        await db.insert(goldOrders).values({
            user_id: userId,
            gold_amount: Number(goldAmount),
            price_mnt: Number(priceMnt) || 0,
            proof_url: proofUrl,
            graffiti_url: graffitiUrl,
            status: 'pending'
        }).run();

        return c.json({ success: true, message: 'Gold request submitted' });
    } catch (e: any) {
        console.error('Gold Request Error:', e);
        return c.json({ success: false, error: e.message }, 500);
    }
});

// GET /api/gold/orders - Get orders (Seller Only: All, User: Own)
goldRoutes.get('/orders', async (c) => {
    const userId = c.req.header('X-User-Id');
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const db = drizzle(c.env.DB);
    const user = await db.select().from(players).where(eq(players.id, userId)).get();

    let isSeller = false;
    const ALLOWED_SELLERS = ['1237067681623052288', '656126101235695626'];
    if (user && (ALLOWED_SELLERS.includes(user.id) || (user.discord_id && ALLOWED_SELLERS.includes(user.discord_id)))) {
        isSeller = true;
    }

    if (isSeller) {
        // Seller sees ALL pending/recent orders
        const orders = await c.env.DB.prepare(`
            SELECT go.*, p.discord_username, p.discord_avatar
            FROM gold_orders go
            JOIN players p ON go.user_id = p.id
            ORDER BY go.created_at DESC
            LIMIT 50
        `).all();
        return c.json({ success: true, orders: orders.results, isSeller: true });
    } else {
        // User sees OWN orders
        const orders = await db.select().from(goldOrders)
            .where(eq(goldOrders.user_id, userId))
            .orderBy(desc(goldOrders.created_at))
            .limit(10)
            .all();
        return c.json({ success: true, orders: orders, isSeller: false });
    }
});

// POST /api/gold/orders/:id/status - Update Order Status (Seller Only)
goldRoutes.post('/orders/:id/status', requireGoldSeller, async (c) => {
    try {
        const orderId = c.req.param('id');
        const { status } = await c.req.json(); // complete, rejected
        const sellerId = c.req.header('X-User-Id');

        if (!['completed', 'rejected'].includes(status)) return c.json({ success: false, error: 'Invalid status' }, 400);

        const db = drizzle(c.env.DB);

        await db.update(goldOrders)
            .set({
                status: status,
                processed_by: sellerId,
                updated_at: new Date().toISOString()
            })
            .where(eq(goldOrders.id, orderId))
            .run();

        // If completed, optionally credit 'players.gold' (Wallet) if we want to track total?
        // But user said "it wont show balance", so maybe we don't.
        // However, I'll update it for analytics if needed later.
        if (status === 'completed') {
            const order = await db.select().from(goldOrders).where(eq(goldOrders.id, orderId)).get();
            if (order) {
                await c.env.DB.prepare('UPDATE players SET gold = gold + ? WHERE id = ?')
                    .bind(order.gold_amount, order.user_id).run();

                // Also log transaction for history
                await db.insert(goldTransactions).values({
                    user_id: order.user_id,
                    amount: order.gold_amount,
                    reason: `Order ${order.id} Fulfilled`,
                    created_by: sellerId
                }).run();
            }
        }

        return c.json({ success: true, message: `Order marked as ${status}` });
    } catch (e: any) {
        return c.json({ success: false, error: e.message }, 500);
    }
});

export default goldRoutes;
