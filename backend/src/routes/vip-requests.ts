import { Hono } from 'hono';
import { QPayService } from '../utils/qpay';
import { TIERS, updateDiscordRole } from '../utils/discord';

interface Env {
    DB: D1Database;
    IMAGES_BUCKET: R2Bucket;
}

const vipRequestsRoutes = new Hono<{ Bindings: Env }>();

// POST /api/vip-requests - Submit VIP request
vipRequestsRoutes.post('/', async (c) => {
    const userId = c.req.header('X-User-Id');

    if (!userId) {
        return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    try {
        const body = await c.req.json<{
            discord_username: string;
            phone_number?: string;
            screenshot_url: string;
            message?: string;
        }>();

        if (!body.screenshot_url) {
            return c.json({ success: false, error: 'Transfer screenshot is required' }, 400);
        }

        if (!body.phone_number || body.phone_number.trim().length === 0) {
            return c.json({ success: false, error: 'Phone number is required' }, 400);
        }

        // Check if user already has a pending request
        const existingRequest = await c.env.DB.prepare(
            'SELECT id FROM vip_requests WHERE user_id = ? AND status = ?'
        ).bind(userId, 'pending').first();

        if (existingRequest) {
            return c.json({
                success: false,
                error: 'You already have a pending VIP request. Please wait for admin review.'
            }, 400);
        }

        const requestId = crypto.randomUUID();
        const now = new Date().toISOString();

        await c.env.DB.prepare(`
            INSERT INTO vip_requests (
                id, user_id, discord_username, phone_number, 
                screenshot_url, message, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
        `).bind(
            requestId,
            userId,
            body.discord_username,
            body.phone_number || null,
            body.screenshot_url,
            body.message || null,
            now
        ).run();

        return c.json({
            success: true,
            message: 'VIP request submitted successfully',
            request_id: requestId
        });
    } catch (error: any) {
        console.error('Error submitting VIP request:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// GET /api/vip-requests/my-request - Get user's current request
vipRequestsRoutes.get('/my-request', async (c) => {
    const userId = c.req.header('X-User-Id');

    if (!userId) {
        return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    try {
        const request = await c.env.DB.prepare(`
            SELECT 
                id, status, created_at, reviewed_at, rejection_reason,
                screenshot_url, discord_username, phone_number, message
            FROM vip_requests 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 1
        `).bind(userId).first();

        return c.json({
            success: true,
            request: request || null
        });
    } catch (error: any) {
        console.error('Error fetching VIP request:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/upload/vip-screenshot - Upload screenshot to R2
vipRequestsRoutes.post('/upload/vip-screenshot', async (c) => {
    const userId = c.req.header('X-User-Id');

    if (!userId) {
        return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    try {
        const formData = await c.req.formData();
        const fileEntry = formData.get('screenshot');

        if (!fileEntry || typeof fileEntry === 'string') {
            return c.json({ success: false, error: 'No file uploaded' }, 400);
        }

        const file = fileEntry as File;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            return c.json({ success: false, error: 'Only image files are allowed' }, 400);
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return c.json({ success: false, error: 'File size must be less than 5MB' }, 400);
        }

        const fileName = `vip-screenshots/${userId}-${Date.now()}-${file.name}`;
        const arrayBuffer = await file.arrayBuffer();

        await c.env.IMAGES_BUCKET.put(fileName, arrayBuffer, {
            httpMetadata: {
                contentType: file.type,
            },
        });

        const backendOrigin = new URL(c.req.url).origin;
        const url = `${backendOrigin}/api/images/${fileName}`;

        return c.json({
            success: true,
            url
        });
    } catch (error: any) {
        console.error('Error uploading screenshot:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/vip-requests/invoice - Create QPay invoice for VIP
vipRequestsRoutes.post('/invoice', async (c) => {
    const userId = c.req.header('X-User-Id');
    if (!userId) return c.json({ success: false, error: 'Authentication required' }, 401);

    try {
        const VIP_PRICE = 10000;
        const invoice = await QPayService.createInvoice(VIP_PRICE, 'VIP Subscription (1 Month)', userId);

        return c.json({
            success: true,
            invoice
        });
    } catch (error: any) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

// POST /api/vip-requests/check-payment - Check if QPay invoice is paid and create request
vipRequestsRoutes.post('/check-payment', async (c) => {
    const userId = c.req.header('X-User-Id');
    if (!userId) return c.json({ success: false, error: 'Authentication required' }, 401);

    try {
        const { invoice_id, phone_number, discord_username, message } = await c.req.json<{
            invoice_id: string;
            phone_number: string;
            discord_username: string;
            message?: string;
        }>();

        const isPaid = await QPayService.checkInvoice(invoice_id);

        if (isPaid) {
            // Create VIP request automatically approved or pending admin check? 
            // Plan says: "If paid, automatically creates the VIP request"
            // Since it's paid, maybe set status to 'pending' (for admin to give role) or 'approved' (if auto-role).
            // Let's stick to 'pending' for safety as per current flow (admin needs to verify logic/assign role).
            // But actually, if payment is confirmed, we should probably mark it as "paid_pending_role" or similar.
            // For now, insert as 'pending' but with a note or flag.
            // Better: Insert into vip_requests with status 'pending' and maybe existing fields.
            // We don't need screenshot anymore. We can use invoice_id as screenshot_url placeholder or add a column.
            // Reusing screenshot_url to store "QPAY:{invoice_id}" to indicate it's a QPay payment.

            const requestId = crypto.randomUUID();
            const now = new Date().toISOString();

            await c.env.DB.prepare(`
                INSERT INTO vip_requests (
                    id, user_id, discord_username, phone_number, 
                    screenshot_url, message, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
            `).bind(
                requestId, userId, discord_username, phone_number,
                `QPAY:${invoice_id}`, message || 'Paid via QPay', now
            ).run();

            // INSTANT VIP ACTIVATION
            const vipUntilDate = new Date();
            vipUntilDate.setDate(vipUntilDate.getDate() + 30); // Add 30 days
            const vipUntilIso = vipUntilDate.toISOString();

            await c.env.DB.prepare(`
                UPDATE players 
                SET is_vip = 1, vip_until = ? 
                WHERE id = ?
            `).bind(vipUntilIso, userId).run();

            // Mark the request as approved since it was auto-processed
            await c.env.DB.prepare(`
                UPDATE vip_requests
                SET status = 'approved', reviewed_at = ?, reviewed_by = 'SYSTEM'
                WHERE id = ?
            `).bind(now, requestId).run();

            // ASSIGN DISCORD VIP ROLE INSTANTLY
            console.log(`VIP Purchase: Attempting to grant Discord VIP role to user ${userId}`);
            let discordRoleGranted = false;
            try {
                const roleResult = await updateDiscordRole(c.env, userId, TIERS.VIP, true);
                if (roleResult) {
                    console.log(`VIP Purchase: Successfully granted Discord VIP role to user ${userId}`);
                    discordRoleGranted = true;
                } else {
                    console.error(`VIP Purchase: Failed to grant Discord VIP role to user ${userId} - updateDiscordRole returned false`);
                }
            } catch (discordErr) {
                console.error(`VIP Purchase: Exception while granting Discord VIP role to user ${userId}:`, discordErr);
            }

            return c.json({
                success: true,
                paid: true,
                message: 'Payment confirmed. VIP activated!',
                discord_role_granted: discordRoleGranted
            });
        } else {
            return c.json({ success: true, paid: false, message: 'Payment not found yet.' });
        }
    } catch (error: any) {
        console.error('Check Payment Error:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

export { vipRequestsRoutes };
