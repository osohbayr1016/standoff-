import WebSocket from 'ws';

const WS_URL = 'ws://localhost:8787/ws';
const PLAYER_COUNT = 9; // We need 10 total, 1 is the real user

console.log(`🚀 Simulating ${PLAYER_COUNT} players joining queue...`);

for (let i = 1; i <= PLAYER_COUNT; i++) {
    const ws = new WebSocket(WS_URL);
    const userId = `bot-player-${i}`;
    const username = `Bot Player ${i}`;

    ws.on('open', () => {
        // 1. Register
        ws.send(JSON.stringify({
            type: 'REGISTER',
            userId: userId,
            username: username,
            avatar: 'default',
            elo: 1000 + i * 50 // Varied Elo
        }));

        // 2. Join Queue (delay slightly)
        setTimeout(() => {
            ws.send(JSON.stringify({ type: 'JOIN_QUEUE', userId: userId }));
            console.log(`✅ ${username} joined queue`);
        }, 500 * i);
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'MATCH_READY') {
            console.log(`🎉 ${username} got MATCH_READY!`);
        }
        if (msg.type === 'READY_PHASE_STARTED') {
            // Bots should be ready automatically? Or we simulate it?
            // Let's listen slightly and then send READY
            setTimeout(() => {
                ws.send(JSON.stringify({ type: 'PLAYER_READY', userId: userId }));
                console.log(`⚡ ${username} is READY`);
            }, 2000 + (Math.random() * 2000));
        }
    });
}
