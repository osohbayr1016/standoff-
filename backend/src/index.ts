import { Hono } from 'hono';
import { cors } from 'hono/cors';

// 1. Durable Object - Real-time системд хэрэгтэй
export class MatchQueueDO {
  sessions: Set<WebSocket> = new Set();
  queue: string[] = []; // Тоглогчдын Discord ID-г хадгална

  constructor(public state: DurableObjectState, public env: any) { }

  async fetch(request: Request) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    // 1. WebSocket холболт үүсгэх
    const [client, server] = Object.values(new WebSocketPair());

    this.handleSession(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  handleSession(ws: WebSocket) {
    ws.accept();
    this.sessions.add(ws);

    ws.addEventListener('message', (msg: MessageEvent) => {
      const data = JSON.parse(msg.data as string);

      if (data.type === 'JOIN_QUEUE') {
        if (!this.queue.includes(data.userId)) {
          this.queue.push(data.userId);
        }
        this.broadcastQueueUpdate();
      }

      if (this.queue.length >= 10) {
        this.broadcastMatchReady();
      }
    });

    ws.addEventListener('close', () => {
      this.sessions.delete(ws);
    });
  }

  // Бүх холбогдсон хүмүүс рүү дарааллын мэдээллийг илгээх
  broadcastQueueUpdate() {
    const message = JSON.stringify({
      type: 'QUEUE_UPDATE',
      count: this.queue.length
    });
    this.sessions.forEach(s => s.send(message));
  }

  broadcastMatchReady() {
    const message = JSON.stringify({ type: 'MATCH_READY', players: this.queue });
    this.sessions.forEach(s => s.send(message));
    this.queue = []; // Дарааллыг цэвэрлэх
  }
}

// 2. Hono API
const app = new Hono<{ Bindings: { 
  DB: D1Database, 
  MATCH_QUEUE: DurableObjectNamespace,
  DISCORD_CLIENT_ID: string,
  DISCORD_CLIENT_SECRET: string,
  DISCORD_REDIRECT_URI: string
} }>();

// CORS-ийг идэвхжүүлэх
app.use('/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

app.get('/', (c) => c.text('Standoff 2 Platform API is Online!'));

// Discord OAuth2 Callback
app.get('/api/auth/callback', async (c) => {
  const code = c.req.query('code');
  
  if (!code) {
    return c.text("Code not found", 400);
  }

  try {
    // 1. Кодоо "Access Token" болгож солих
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: c.env.DISCORD_CLIENT_ID,
        client_secret: c.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: c.env.DISCORD_REDIRECT_URI,
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
    });

    const tokens = await tokenResponse.json() as any;

    if (!tokens.access_token) {
      return c.text("Failed to get access token", 400);
    }

    // 2. Access Token ашиглан хэрэглэгчийн мэдээллийг авах
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`
      },
    });

    const userData = await userResponse.json() as any;

    // 3. Хэрэглэгчийг Database-д хадгалах
    try {
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO players (id, username, discord_id, mmr, is_verified, created_at) 
         VALUES (?, ?, ?, 1000, 0, CURRENT_TIMESTAMP)`
      ).bind(
        userData.id,
        userData.username,
        userData.id
      ).run();
    } catch (dbError) {
      console.error('Database error:', dbError);
    }

    // 4. Хэрэглэгчийг Frontend рүү нь буцаах
    return c.redirect(
      `http://localhost:5173?id=${userData.id}&username=${userData.username}&avatar=${userData.avatar || ''}`
    );
  } catch (error) {
    console.error('Auth error:', error);
    return c.text("Authentication failed", 500);
  }
});

app.get('/ws', async (c) => {
  const id = c.env.MATCH_QUEUE.idFromName('global-matchmaking');
  const obj = c.env.MATCH_QUEUE.get(id);
  return obj.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
  MatchQueueDO
};
