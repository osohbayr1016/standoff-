import WebSocket from 'ws';

// Production URL
const WS_URL = 'wss://backend.anandoctane4.workers.dev/ws';

console.log(`🔌 Connecting to Production Backend: ${WS_URL}`);
const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('✅ Connected!');
    console.log('🧹 Sending RESET_MATCH...');
    ws.send(JSON.stringify({ type: 'RESET_MATCH' }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('📩 Received:', msg);
    // If we receive a broadcast confirming reset
    if (msg.type === 'MATCH_RESET') {
        console.log('✅ Match Reset Successfully Broadcasted.');
        ws.close();
        process.exit(0);
    }
});

ws.on('error', (e) => {
    console.error('❌ Error:', e);
    process.exit(1);
});

// Timeout
setTimeout(() => {
    console.log('TIMEOUT waiting for confirmation. (But command sent)');
    ws.close();
    process.exit(0);
}, 5000);
