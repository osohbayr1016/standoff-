import WebSocket from 'ws';

const WS_URL = 'wss://backend.anandoctane4.workers.dev/ws';
const USER_ID = 'test-sim-user-' + Math.floor(Math.random() * 10000);
const CAPTAIN_A_ID = USER_ID;
const CAPTAIN_B_ID = 'bot_simulated';

console.log('🚀 Starting Draft Simulation...');
console.log(`User ID: ${USER_ID}`);

const ws = new WebSocket(WS_URL, {
    headers: {
        'Origin': 'https://standoff-frontend.pages.dev'
    }
});

let matchId: string | null = 'f8c195d7-339d-45cc-988a-2b3e6bb0c727'; // NEW MATCH ID
let pool: any[] = [];

ws.on('open', () => {
    console.log('✅ Connected to WebSocket');

    // IMMEDIATE RECOVERY TEST
    if (matchId) {
        console.log(`🔌 Testing Recovery for Lobby: ${matchId}`);
        ws.send(JSON.stringify({
            type: 'REQUEST_MATCH_STATE',
            lobbyId: matchId
        }));
        return;
    }

    // 1. Register
    ws.send(JSON.stringify({
        type: 'REGISTER',
        userId: USER_ID,
        username: 'SimUser',
        avatar: 'default',
        elo: 1000
    }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    // console.log('📩 Msg:', msg.type);

    if (msg.type === 'REGISTER_ACK') {
        console.log('✅ Registered. Joining Queue...');
        ws.send(JSON.stringify({ type: 'JOIN_QUEUE', userId: USER_ID }));

        // Simulate "Create Match" (Bot Trigger)
        // We'll mimic the bot sending CREATE_MATCH
        // Note: Real bot has a special secret, but let's see if we can trigger it via normal flow 
        // OR we can just wait for queue? No, queue needs 10 players.
        // We will try to hijack an existing lobby or rely on the fact that we can't easily create a match without 10 players.

        // Wait! The user said "fill bots start match". 
        // This suggests they use the "Fill Bots" button in the frontend which calls an API.
        // We should call that API too.
        createMatchWithBots();
        return;
    }

    if (msg.type === 'MATCH_READY' || msg.type === 'DRAFT_START') {
        console.log('🎉 Match Created:', msg.lobbyId);
        matchId = msg.lobbyId;

        // If it's a draft, we should receive DRAFT_START soon or immediately
    }

    if (msg.type === 'DRAFT_START') {
        console.log('📜 Draft Started. Pool size:', msg.draftState.pool.length);
        matchId = msg.lobbyId;
        pool = msg.draftState.pool;

        // Try to pick
        const firstPlayer = pool[0];
        console.log(`👉 Picking player: ${firstPlayer.id} (${firstPlayer.username})`);

        ws.send(JSON.stringify({
            type: 'DRAFT_PICK',
            lobbyId: matchId,
            pickedPlayerId: firstPlayer.id
        }));
    }

    if (msg.type === 'LOBBY_UPDATE') {
        // console.log('UPDATE Recv');
        if (msg.lobby && msg.lobby.draftState) {
            const history = msg.lobby.draftState.pickHistory;
            if (history.length > 0) {
                console.log(`✅ Pick confirmed! History length: ${history.length}`);

                // NOW SIMULATE REFRESH
                console.log('🔄 Simulating REFRESH (Disconnecting)...');
                ws.terminate();

                setTimeout(() => {
                    reconnectAndVerify(matchId!);
                }, 2000);
            }
        }
    }
});

async function createMatchWithBots() {
    console.log('🤖 Requesting Match with Bots...');
    // We need to hit the HTTP endpoint that the frontend uses
    // frontend: fetch(`${backendUrl}/api/matches/debug/create-test-match` ... )
    // Wait, the user used "Fill Bots". That's likely `POST /api/matches/:id/fill-bots`? 
    // Or maybe `POST /api/matches/start` with bots?

    // Let's assume we can use the Debug/Moderator endpoint if verified, or just wait?
    // User said "create lobby competetive match and fill bots start match".
    // 1. Create Lobby (Queue)
    // 2. Fill Bots
    // 3. Start

    // Simulating this via pure WS is hard because "Fill Bots" is an API call.
    // I will try to hit the API.

    try {
        // 1. Create Lobby (Simulate by being in queue? No, competitive matches start from queue)
        // Actually, let's just use the `create-test-match` endpoint if it exists?
        // Or better, since I can't easily auth as admin, I will try to trigger the "Recover" check on a known recent match?
        // No, I need to create a NEW one to be sure.

        // Alternative: Just listen to the WS. IF the user is running the frontend, maybe I can just "listen" to his lobby?
        // No, I need to be IN the lobby.

        console.log('⚠️ Cannot auto-create match without Admin token. Waiting for events...');
    } catch (e) {
        console.error(e);
    }
}

function reconnectAndVerify(lobbyId: string) {
    console.log('🔌 Reconnecting...');
    const ws2 = new WebSocket(WS_URL, {
        headers: {
            'Origin': 'https://standoff-frontend.pages.dev'
        }
    });

    ws2.on('open', () => {
        console.log('✅ Reconnected. Requesting Match State...');
        // 2. Request State
        ws2.send(JSON.stringify({
            type: 'REQUEST_MATCH_STATE',
            lobbyId: lobbyId
        }));
    });

    ws2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'LOBBY_UPDATE') {
            console.log('📦 RECEIVED STATE after refresh!');
            if (msg.lobby.draftState) {
                console.log('✅ Draft State Preserved! Pool:', msg.lobby.draftState.pool.length);
                console.log('SUCCESS: Fix Verified.');
            } else {
                console.error('❌ Draft State MISSING in response!');
            }
            ws2.terminate();
            process.exit(0);
        } else if (msg.type === 'MATCH_STATE_ERROR') {
            console.error('❌ Match Not Found (Deleted?)');
            ws2.terminate();
            process.exit(1);
        }
    });

    // Timeout
    setTimeout(() => {
        console.error('❌ Timeout waiting for state.');
        ws2.terminate();
        process.exit(1);
    }, 5000);
}
