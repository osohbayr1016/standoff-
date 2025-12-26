const WebSocket = require('ws');

// Connect to the deployed backend
const wsUrl = 'wss://backend.anandoctane4.workers.dev/ws';
console.log(`Connecting to ${wsUrl}...`);

const ws = new WebSocket(wsUrl);

ws.on('open', function open() {
    console.log('Connected! Sending RESET_MATCH command...');

    // Send the reset command
    ws.send(JSON.stringify({
        type: 'RESET_MATCH'
    }));
});

ws.on('message', function message(data) {
    console.log('Received:', data.toString());
    try {
        const msg = JSON.parse(data);
        if (msg.type === 'MATCH_RESET') {
            console.log('✅ MATCH_RESET confirmed! All lobbies cleared.');
            process.exit(0);
        }
    } catch (e) {
        // ignore
    }
});

ws.on('error', function error(err) {
    console.error('WebSocket Error:', err);
    process.exit(1);
});

// Timeout
setTimeout(() => {
    console.log('Timeout waiting for response. Exiting.');
    process.exit(0);
}, 5000);
