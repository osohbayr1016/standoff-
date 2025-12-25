import WebSocket from 'ws';

const ws = new WebSocket('ws://backend.anandoctane4.workers.dev/ws');

ws.on('open', () => {
    console.log('Connected to WebSocket');
    ws.send(JSON.stringify({ type: 'RESET_MATCH' }));
    console.log('Sent RESET_MATCH command');
    setTimeout(() => {
        ws.close();
        process.exit(0);
    }, 2000);
});

ws.on('message', (data: Buffer | string | any) => {
    console.log('Received:', data.toString());
});

ws.on('error', (err: Error) => {
    console.error('Error:', err);
    process.exit(1);
});
