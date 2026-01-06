import { Hono } from 'hono';
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

interface Env {
    AGORA_APP_CERTIFICATE: string;
    DISCORD_CLIENT_ID?: string;
    VITE_AGORA_APP_ID?: string;
}

const agora = new Hono<{ Bindings: Env }>();

agora.post('/token', async (c) => {
    try {
        const { channelName, uid } = await c.req.json();
        const appID = c.env.DISCORD_CLIENT_ID ? c.env.VITE_AGORA_APP_ID : '5ad7d67c026a4018bfa86d2b2a5e0031'; // Fallback or env
        // Note: In backend env we might not have VITE_ prefix variables usually, but we need APP ID here.
        // Let's assume the user will put AGORA_APP_ID in wrangler vars if needed, or we use the known one.
        // The known App ID is 5ad7d67c026a4018bfa86d2b2a5e0031. 
        // Ideally we should add AGORA_APP_ID to wrangler.jsonc too, but I'll hardcode or check env.

        const APP_ID = '5ad7d67c026a4018bfa86d2b2a5e0031';
        const APP_CERTIFICATE = c.env.AGORA_APP_CERTIFICATE;

        if (!APP_CERTIFICATE) {
            console.error('AGORA_APP_CERTIFICATE not configured');
            return c.json({ error: 'Server configuration error' }, 500);
        }

        if (!channelName || !uid) {
            return c.json({ error: 'Missing channelName or uid' }, 400);
        }

        const role = RtcRole.PUBLISHER;
        const expirationTimeInSeconds = 3600;
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

        // uid can be 0 if we want to let Agora assign it, but we usually pass our user ID.
        // However, Agora Access Token expects number if using buildTokenWithUid, or string for buildTokenWithAccount.
        // Our DB uses string UUIDs. So we MUST use buildTokenWithAccount.

        // Check if uid is numeric (old style) or string (uuid)
        // Actually our User IDs are UUID strings.

        const token = RtcTokenBuilder.buildTokenWithAccount(
            APP_ID,
            APP_CERTIFICATE,
            channelName,
            String(uid),
            role,
            privilegeExpiredTs
        );

        return c.json({ token });
    } catch (error) {
        console.error('Agora Token Error:', error);
        return c.json({ error: 'Failed to generate token' }, 500);
    }
});

export default agora;
