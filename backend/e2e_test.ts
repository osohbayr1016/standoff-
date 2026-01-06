
import WebSocket from 'ws';

// CONFIG
const BACKEND_URL = 'https://backend.anandoctane4.workers.dev';
const WS_URL = 'wss://backend.anandoctane4.workers.dev/ws';
// const BACKEND_URL = 'http://localhost:8787';
// const WS_URL = 'ws://localhost:8787/ws';

const USER_ID = `e2e-tester-${Math.floor(Math.random() * 10000)}`;
const HEADERS = {
    'Content-Type': 'application/json',
    'X-User-Id': USER_ID,
    'Origin': 'https://standoff-frontend.pages.dev' // Bypass CORS
};

async function runTest() {
    console.log(`🤖 Starting E2E Persistence Test as ${USER_ID}`);

    // STEP 1: Register/Ensure User Exists (Mocking via WS connection first usually registers them in memory)
    // But let's just try Creating a Match.

    console.log(`\n1️⃣ Creating Competitive Match...`);
    const createRes = await fetch(`${BACKEND_URL}/api/matches`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
            matchType: 'competitive',
            map: 'Sandstone'
        })
    });

    if (!createRes.ok) {
        console.error('❌ Failed to create match:', await createRes.text());
        return;
    }

    const { matchId } = await createRes.json() as any;
    console.log(`✅ Match Created! ID: ${matchId}`);

    // STEP 2: Fill/Joins
    // We need to join the match to be the captain (User A).
    // The create request usually auto-joins the creator? Let's assume yes or join manually.
    // Actually, normally 'POST /matches' adds the creator.

    // STEP 3: Fill Bots
    console.log(`\n2️⃣ Filling with Bots...`);
    const fillRes = await fetch(`${BACKEND_URL}/api/matches/${matchId}/fill-bots`, {
        method: 'POST',
        headers: HEADERS
    });

    if (!fillRes.ok) {
        console.error('❌ Failed to fill bots:', await fillRes.text());
        // return; // Continue anyway to debug
    } else {
        console.log(`✅ Bots Filled.`);
    }

    // STEP 4: WebSocket Connection (The "Browser")
    console.log(`\n3️⃣ Connecting WebSocket (Captain)...`);
    const ws = new WebSocket(`${WS_URL}?userId=${USER_ID}`, {
        headers: { 'Origin': 'https://standoff-frontend.pages.dev' }
    });

    await new Promise<void>((resolve) => {
        ws.on('open', () => {
            console.log('✅ WS Connected');
            resolve();
        });
    });

    // STEP 5: Wait for DRAFT_START or REQUEST STATE
    // We Request State to be sure.
    ws.send(JSON.stringify({ type: 'REQUEST_MATCH_STATE', lobbyId: matchId }));

    // Listen for events
    let draftState: any = null;

    ws.on('message', async (data: any) => {
        const msg = JSON.parse(data.toString());
        // console.log('📩 RX:', msg.type);

        if (msg.type === 'LOBBY_UPDATE' && msg.lobby.draftState) {
            console.log(`✅ Received Draft State. Active: ${msg.lobby.draftState.isActive}`);
            draftState = msg.lobby.draftState;

            // Check if it's our turn
            if (draftState.isActive && draftState.currentTurn === 'captainA') {
                // STEP 6: MAKE A PICK
                const pick = draftState.pool[0];
                console.log(`\n4️⃣ Making Draft Pick: ${pick.username} (${pick.id})...`);

                ws.send(JSON.stringify({
                    type: 'DRAFT_PICK',
                    lobbyId: matchId,
                    pickedPlayerId: pick.id || pick.player_id
                }));
            }
            // If we already picked, we might see the update here
            if (draftState.pickHistory.length > 0) {
                console.log(`✅ Pick Confirmed in State! History: ${draftState.pickHistory.length}`);

                // STEP 7: SIMULATE REFRESH (Disconnect)
                console.log(`\n5️⃣ 🔄 SIMULATING REFRESH (Closing WS)...`);
                ws.close();

                // Trigger Step 8
                setTimeout(() => reconnectAndVerify(matchId), 1000);
            }
        }
    });

}

async function reconnectAndVerify(matchId: string) {
    console.log(`\n6️⃣ Reconnecting (Post-Refresh)...`);
    const ws2 = new WebSocket(`${WS_URL}?userId=${USER_ID}`, {
        headers: { 'Origin': 'https://standoff-frontend.pages.dev' }
    });

    ws2.on('open', () => {
        console.log('✅ WS2 Connected. Requesting State...');
        ws2.send(JSON.stringify({ type: 'REQUEST_MATCH_STATE', lobbyId: matchId }));
    });

    ws2.on('message', (data: any) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'LOBBY_UPDATE') {
            const history = msg.lobby.draftState?.pickHistory || [];
            console.log(`\n7️⃣ VERIFICATION:`);
            console.log(`Draft Active: ${msg.lobby.draftState?.isActive}`);
            console.log(`Pick History Count: ${history.length}`);

            if (msg.lobby.draftState && history.length > 0) {
                console.log(`🎉 SUCCESS! State persisted after refresh.`);
                console.log(`MATCH SAVED: ${matchId}`);
                process.exit(0);
            } else {
                console.error(`❌ FAILURE! Draft state lost or empty.`);
                process.exit(1);
            }
        }
    });
}

runTest();
