
import { Context, Next } from 'hono';

export const verifyAuth = async (c: Context, next: Next) => {
    // Check for Authorization header (Bearer token) or X-User-Id
    // The current app seems to rely on X-User-Id or query params in some places.
    // For the Streamer Dashboard, we'll try to use a Bearer token if available, or fall back to X-User-Id.
    // Since the frontend 'token' from useAuth is likely not a real JWT yet (based on my analysis),
    // we might just accept the ID.

    const authHeader = c.req.header('Authorization');
    const userIdHeader = c.req.header('X-User-Id');

    let userId: string | undefined;

    if (activeLobbyId(authHeader)) { // Typo in thought, logic below
        // If we implement real JWT later, decode it here.
        // For now, if the frontend sends "Bearer <userId>", we can extract it.
        const token = authHeader.split(' ')[1];
        if (token && token !== 'undefined' && token !== 'null') {
            userId = token; // Assuming token IS the userId for now based on 'dummy-token' idea or finding
        }
    }

    if (!userId && userIdHeader) {
        userId = userIdHeader;
    }

    if (!userId) {
        return c.json({ error: 'Unauthorized: Missing User ID' }, 401);
    }

    c.set('userId', userId);
    await next();
};

function activeLobbyId(authHeader: string | undefined): authHeader is string {
    return !!authHeader;
}
