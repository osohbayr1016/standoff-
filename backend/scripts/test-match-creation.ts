/**
 * Test script for match creation flow
 * Simulates 10 players joining queue, readying up, and creating a match
 * Now waits for BOT to be connected before starting!
 */

import WebSocket from 'ws';

const BACKEND_URL = 'https://backend.anandoctane4.workers.dev';
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

// 10 Discord user IDs provided by user
const DISCORD_IDS = [
    '1300355215798702131',
    '1187467581381160981',
    '936566423571017738',
    '1426638685562077265',
    '1419804350037102612',
    '1453591335721373849',
    '905363019964506122',
    '671904394635378689',
    '1201473526205530124',
    '981370578604785695'
];

const MAPS = ['Hanami', 'Rust', 'Zone 7', 'Dune', 'Breeze', 'Province', 'Sandstone'];

// Mock player data
const PLAYERS = DISCORD_IDS.map((id, index) => ({
    id,
    username: `Player${index + 1}`,
    avatar: null,
    elo: 1000 + (index * 100)
}));

interface WebSocketConnection {
    ws: WebSocket;
    playerId: string;
    username: string;
    ready: boolean;
    isCaptain: boolean;
    team: 'alpha' | 'bravo' | null;
}

const connections: WebSocketConnection[] = [];
let lobbyId: string | null = null;
let matchStarted = false;
let botConnected = false;
let readyPhaseActive = false;

function log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
}

function connectPlayer(player: typeof PLAYERS[0]): Promise<WebSocketConnection> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`${WS_URL}/ws`);
        const connection: WebSocketConnection = {
            ws,
            playerId: player.id,
            username: player.username,
            ready: false,
            isCaptain: false,
            team: null
        };

        ws.on('open', () => {
            log(`✅ ${player.username} connected`);

            // Register with backend
            ws.send(JSON.stringify({
                type: 'REGISTER',
                userId: player.id,
                username: player.username,
                avatar: player.avatar,
                elo: player.elo
            }));

            setTimeout(() => resolve(connection), 1000);
        });

        ws.on('message', (data: Buffer) => {
            try {
                const message = JSON.parse(data.toString());

                switch (message.type) {
                    case 'REGISTER_ACK':
                        log(`🔐 ${player.username} registered (ID: ${message.userId})`);
                        break;

                    case 'DEBUG_QUEUE_STATUS':
                        botConnected = !!message.botConnected;
                        const botStatus = botConnected ? '✅ BOT CONNECTED' : '❌ BOT DISCONNECTED';
                        log(`🔍 ALARM: Merged=${message.mergedSize}, State=${message.matchState}, ${botStatus}`);
                        break;

                    case 'MATCH_READY':
                        log(`🎮 MATCH READY for ${player.username}`);
                        lobbyId = message.lobbyId;
                        const captains = message.captains || [];
                        if (captains[0]?.id === player.id) {
                            connection.isCaptain = true;
                            connection.team = 'alpha';
                            log(`👑 ${player.username} is Captain ALPHA`);
                        } else if (captains[1]?.id === player.id) {
                            connection.isCaptain = true;
                            connection.team = 'bravo';
                            log(`👑 ${player.username} is Captain BRAVO`);
                        }
                        break;

                    case 'READY_PHASE_STARTED':
                        log(`🔔 READY PHASE STARTED`);
                        readyPhaseActive = true;
                        lobbyId = message.lobbyId;
                        readyUp(connection);
                        break;

                    case 'LOBBY_UPDATE':
                        const lobby = message.lobby;
                        if (!lobby) return;
                        lobbyId = lobby.id;

                        if (lobby.mapBanState?.mapBanPhase) {
                            if (connection.isCaptain && lobby.mapBanState.currentBanTeam === connection.team) {
                                const bannedMaps = lobby.mapBanState.bannedMaps || [];
                                const availableMaps = MAPS.filter(m => !bannedMaps.includes(m));
                                if (availableMaps.length > 1) {
                                    const mapToBan = availableMaps[0];
                                    log(`🚫 ${player.username} banning: ${mapToBan}`);
                                    ws.send(JSON.stringify({
                                        type: 'BAN_MAP',
                                        lobbyId: lobby.id,
                                        map: mapToBan,
                                        team: connection.team
                                    }));
                                }
                            }
                        }

                        if (lobby.readyPhaseState?.phaseActive && !connection.ready) {
                            readyPhaseActive = true;
                            readyUp(connection);
                        }
                        break;

                    case 'DEBUG_BOT_SENT':
                        log(`📤 BACKEND: Sent CREATE_MATCH to ${message.botId}`);
                        break;

                    case 'MATCH_START':
                        if (!matchStarted) {
                            matchStarted = true;
                            log(`🚀 🚀 🚀 MATCH STARTED! 🚀 🚀 🚀`);
                            log(`📍 Server: ${message.serverInfo?.ip}`);
                        }
                        break;

                    case 'SERVER_ERROR':
                        log(`❌ SERVER ERROR: ${message.error}`);
                        break;

                    case 'ERROR':
                        log(`❌ Error: ${message.message}`);
                        break;
                }
            } catch (err) { }
        });

        ws.on('error', (error) => reject(error));
        ws.on('close', () => log(`🔌 ${player.username} disconnected`));

        setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
                reject(new Error(`Timeout for ${player.username}`));
            }
        }, 10000);
    });
}

async function joinQueue(connection: WebSocketConnection) {
    connection.ws.send(JSON.stringify({
        type: 'JOIN_QUEUE',
        userId: connection.playerId
    }));
}

async function readyUp(connection: WebSocketConnection) {
    if (!lobbyId || connection.ready) return;
    connection.ws.send(JSON.stringify({
        type: 'PLAYER_READY',
        userId: connection.playerId,
        lobbyId: lobbyId
    }));
    connection.ready = true;
    log(`✋ ${connection.username} ready`);
}

async function main() {
    try {
        log('🎬 Starting FULL Match Test (Waiting for BOT)...');

        // Step 1: Connect all
        log('\n📡 Step 1: Connecting players...');
        for (const player of PLAYERS) {
            const connection = await connectPlayer(player);
            connections.push(connection);
        }

        // Step 2: Wait for BOT
        log('\n⏳ Step 2: Waiting for Discord Bot to connect...');
        const botWaitStart = Date.now();
        while (!botConnected && Date.now() - botWaitStart < 60000) {
            await new Promise(r => setTimeout(r, 2000));
        }

        if (!botConnected) {
            log('⚠️  BOT still not connected after 60s. Proceeding anyway, but server creation might fail.');
        } else {
            log('✅ BOT CONNECTED! Starting queue flow...\n');
        }

        // Step 3: Join queue
        log('🎯 Step 3: Joining queue...');
        for (const connection of connections) {
            joinQueue(connection);
        }

        // Wait for results
        const startTime = Date.now();
        while (Date.now() - startTime < 300000) {
            if (matchStarted) break;
            await new Promise(r => setTimeout(r, 2000));
        }

        if (matchStarted) {
            log('\n✅ ✅ ✅ TEST SUCCESSFUL! ✅ ✅ ✅');
        } else {
            log('\n❌ Test timed out.');
        }

    } catch (error) {
        log('❌ Test failed:', error);
    } finally {
        setTimeout(() => {
            connections.forEach(conn => conn.ws.close());
            process.exit(0);
        }, 5000);
    }
}

main().catch(console.error);
