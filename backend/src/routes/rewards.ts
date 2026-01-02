import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { rewardClaims } from '../db/schema';
import { sql } from 'drizzle-orm';

type Env = {
    DB: D1Database;
};

const rewardsRoutes = new Hono<{ Bindings: Env }>();

// POST /api/rewards/claim - Claim a reward after watching an ad
rewardsRoutes.post('/claim', async (c) => {
    const userId = c.req.header('X-User-Id');
    if (!userId) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const body = await c.req.json<{ type: string }>();
    if (body.type !== 'competitive_match') {
        return c.json({ success: false, error: 'Invalid reward type' }, 400);
    }

    try {
        const today = new Date().toISOString().split('T')[0];

        // Count claims for today
        const countResult = await c.env.DB.prepare(`
            SELECT COUNT(*) as count FROM reward_claims 
            WHERE user_id = ? AND reward_type = ? AND claimed_at LIKE ?
        `).bind(userId, body.type, `${today}%`).first<{ count: number }>();

        if ((countResult?.count || 0) >= 2) {
            return c.json({
                success: false,
                error: 'Daily reward limit reached. You can only claim 2 bonus matches per day.'
            }, 403);
        }

        // Insert new claim
        await c.env.DB.prepare(`
            INSERT INTO reward_claims (user_id, reward_type, claimed_at)
            VALUES (?, ?, datetime('now'))
        `).bind(userId, body.type).run();

        return c.json({
            success: true,
            message: 'Reward claimed! You can now play one more competitive match.',
            claims_today: (countResult?.count || 0) + 1
        });

    } catch (error: any) {
        console.error('Error claiming reward:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// GET /api/rewards/status - Get current reward status for user
rewardsRoutes.get('/status', async (c) => {
    const userId = c.req.query('userId');
    if (!userId) return c.json({ success: false, error: 'User ID required' }, 400);

    try {
        const today = new Date().toISOString().split('T')[0];
        const countResult = await c.env.DB.prepare(`
            SELECT COUNT(*) as count FROM reward_claims 
            WHERE user_id = ? AND reward_type = 'competitive_match' AND claimed_at LIKE ?
        `).bind(userId, `${today}%`).first<{ count: number }>();

        return c.json({
            success: true,
            claims_today: countResult?.count || 0,
            limit: 2
        });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

export default rewardsRoutes;
