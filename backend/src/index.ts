import { Hono } from 'hono';

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
const app = new Hono<{ Bindings: { DB: D1Database, MATCH_QUEUE: DurableObjectNamespace } }>();

app.get('/', (c) => c.text('Standoff 2 Platform API is Online!'));

app.get('/ws', async (c) => {
  const id = c.env.MATCH_QUEUE.idFromName('global-matchmaking');
  const obj = c.env.MATCH_QUEUE.get(id);
  return obj.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
  MatchQueueDO
};
