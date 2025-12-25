import { Hono } from 'hono';

// Environment bindings type
interface Env {
    NEATQUEUE_WEBHOOK_SECRET: string;
    CONNECTIONS: DurableObjectNamespace;
    [key: string]: any;
}

const app = new Hono<{ Bindings: Env }>();

// NeatQueue Webhook Event Types
type NeatQueueAction =
    | 'JOIN_QUEUE'
    | 'LEAVE_QUEUE'
    | 'MATCH_STARTED'
    | 'TEAMS_CREATED'
    | 'MATCH_COMPLETED'
    | 'SUBSTITUTION'
    | 'REGISTER_PLAYER';

interface NeatQueueWebhookPayload {
    action: NeatQueueAction;
    guild_id: string;
    channel_id: string;
    queue_name?: string;
    game_number?: number;
    teams?: Array<{
        name: string;
        players: Array<{
            id: string;
            name: string;
            discriminator?: string;
            rating?: number;
        }>;
    }>;
    map?: string;
    lobby_details?: string;
    winner?: string;
    tie?: boolean;
    [key: string]: any; // Allow additional fields
}

/**
 * Verify NeatQueue webhook authenticity
 */
function verifyWebhookToken(request: Request, expectedToken: string): boolean {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return false;

    // NeatQueue sends token as "Bearer <token>"
    const token = authHeader.replace('Bearer ', '');
    return token === expectedToken;
}

/**
 * Broadcast match event to all connected WebSocket clients
 */
async function broadcastToClients(
    env: Env,
    eventType: string,
    data: any
) {
    try {
        // Get the ConnectionManager Durable Object
        const id = env.MATCH_QUEUE.idFromName('global-matchmaking-v2');
        const stub = env.MATCH_QUEUE.get(id);

        // Broadcast the event
        await stub.fetch('https://internal/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: eventType,
                data
            })
        });
    } catch (error) {
        console.error('Failed to broadcast to clients:', error);
    }
}

/**
 * Handle NeatQueue webhook events
 */
app.post('/webhook', async (c) => {
    const env = c.env as Env;

    // Verify webhook token
    const webhookSecret = env.NEATQUEUE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error('NEATQUEUE_WEBHOOK_SECRET not configured');
        return c.json({ error: 'Server configuration error' }, 500);
    }

    if (!verifyWebhookToken(c.req.raw, webhookSecret)) {
        console.error('Invalid webhook token');
        return c.json({ error: 'Unauthorized' }, 401);
    }

    // Parse webhook payload
    let payload: NeatQueueWebhookPayload;
    try {
        payload = await c.req.json();
    } catch (error) {
        console.error('Invalid JSON payload:', error);
        return c.json({ error: 'Invalid JSON' }, 400);
    }

    console.log('NeatQueue webhook received:', payload.action);

    // Handle different webhook actions
    switch (payload.action) {
        case 'MATCH_STARTED': {
            // Debug logging - inspect full payload
            console.log('🔍 NeatQueue MATCH_STARTED payload:', JSON.stringify(payload, null, 2));
            console.log('🔍 Teams data:', JSON.stringify(payload.teams, null, 2));

            // Log team sizes
            if (payload.teams) {
                payload.teams.forEach((team, idx) => {
                    console.log(`🔍 Team ${idx} (${team.name}): ${team.players?.length || 0} players`);
                    if (team.players) {
                        team.players.forEach((player, pIdx) => {
                            console.log(`  Player ${pIdx}: ${player.name} (ID: ${player.id}, Rating: ${player.rating || 'N/A'})`);
                        });
                    }
                });
            }

            // Extract match data
            const matchData = {
                gameNumber: payload.game_number,
                queueName: payload.queue_name,
                map: payload.map,
                teams: payload.teams || [],
                lobbyDetails: payload.lobby_details,
                serverInfo: parseServerInfo(payload.lobby_details)
            };

            // Broadcast to all connected clients
            await broadcastToClients(env, 'NEATQUEUE_MATCH_STARTED', matchData);

            console.log('✅ Match started broadcast sent with', payload.teams?.length || 0, 'teams');
            break;
        }

        case 'TEAMS_CREATED': {
            // Notify clients that teams have been formed
            await broadcastToClients(env, 'NEATQUEUE_TEAMS_CREATED', {
                teams: payload.teams || [],
                queueName: payload.queue_name
            });
            break;
        }

        case 'MATCH_COMPLETED': {
            // Handle match completion and results
            await broadcastToClients(env, 'NEATQUEUE_MATCH_COMPLETED', {
                gameNumber: payload.game_number,
                winner: payload.winner,
                tie: payload.tie,
                teams: payload.teams || []
            });

            console.log('Match completed:', {
                gameNumber: payload.game_number,
                winner: payload.winner
            });
            break;
        }

        case 'JOIN_QUEUE':
        case 'LEAVE_QUEUE':
            // Optional: Track queue events for analytics
            console.log(`Player ${payload.action}:`, payload);
            break;

        default:
            console.log('Unhandled webhook action:', payload.action);
    }

    // Always return 200 to acknowledge receipt
    return c.json({ success: true });
});

/**
 * Parse server info from lobby details string
 * Example formats:
 * - "Server: 123.45.67.89:27015 | Password: mypass"
 * - "IP: 123.45.67.89 Password: mypass"
 * - Custom format set by admin
 */
function parseServerInfo(lobbyDetails?: string): { ip?: string; password?: string; matchLink?: string } | undefined {
    if (!lobbyDetails) return undefined;

    const result: { ip?: string; password?: string; matchLink?: string } = {};

    // Try to extract IP address
    const ipMatch = lobbyDetails.match(/(?:IP|Server)[:\s]+([0-9.]+(?::[0-9]+)?)/i);
    if (ipMatch) {
        result.ip = ipMatch[1];
    }

    // Try to extract password
    const passwordMatch = lobbyDetails.match(/Password[:\s]+([^\s|]+)/i);
    if (passwordMatch) {
        result.password = passwordMatch[1];
    }

    // Try to extract custom link (e.g., standoff:// protocol)
    const linkMatch = lobbyDetails.match(/(standoff:\/\/[^\s]+)/i);
    if (linkMatch) {
        result.matchLink = linkMatch[1];
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

export default app;
