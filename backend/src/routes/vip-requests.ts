import { Hono } from 'hono';

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

export { vipRequestsRoutes };
