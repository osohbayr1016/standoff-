
import { Hono } from 'hono';
import { players, goldTransactions, goldOrders } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';

interface Env {
    DB: D1Database;
    GOLD_SELLER_ROLE_ID?: string;
}

const goldRoutes = new Hono<{ Bindings: Env }>();
const GOLD_SELLER_ROLE_ID = '1455115991049703579';

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
}

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
