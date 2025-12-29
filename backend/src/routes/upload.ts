import { Hono } from 'hono';

interface Env {
    IMAGES_BUCKET: R2Bucket;
}

const uploadRoutes = new Hono<{ Bindings: Env }>();

// POST /upload - Upload a file
uploadRoutes.post('/upload', async (c) => {
    try {
        const userId = c.req.header('X-User-Id');
        if (!userId) {
            return c.json({ success: false, error: 'Unauthorized' }, 401);
        }

        const body = await c.req.parseBody();
        const file = body['file'];

        if (!file || !(file instanceof File)) {
            return c.json({ success: false, error: 'No file uploaded or invalid format' }, 400);
        }

        // Validate file type (image only)
        if (!file.type.startsWith('image/')) {
            return c.json({ success: false, error: 'Only images are allowed' }, 400);
        }

        const fileExt = file.name.split('.').pop() || 'png';
        const fileName = `${userId}_${crypto.randomUUID()}.${fileExt}`;

        await c.env.IMAGES_BUCKET.put(fileName, file.stream(), {
            httpMetadata: {
                contentType: file.type,
            }
        });

        // Construct URL
        // Used by frontend to display/send result
        // Assuming this backend serves /api
        const backendOrigin = new URL(c.req.url).origin;
        const imageUrl = `${backendOrigin}/api/images/${fileName}`;

        return c.json({
            success: true,
            url: imageUrl
        });
    } catch (error: any) {
        console.error('Upload error:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

// GET /images/:key - Serve image from R2
uploadRoutes.get('/images/:key{.+}', async (c) => {
    try {
        const key = c.req.param('key');
        const object = await c.env.IMAGES_BUCKET.get(key);

        if (!object) {
            return c.text('Image not found', 404);
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);

        return new Response(object.body, {
            headers,
        });
    } catch (error) {
        return c.text('Error serving image', 500);
    }
});

export { uploadRoutes };
