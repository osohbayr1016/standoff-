import { Client } from 'discord.js';
import WebSocket from 'ws';
import type { BackendMessage, MatchData } from '../types';
import { VoiceService } from './voice';
import { NeatQueueService } from './neatqueue';

export class BackendService {
    private ws: WebSocket | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private voiceService: VoiceService | null = null;
    private neatQueueService: NeatQueueService | null = null;

    constructor(
        private backendUrl: string,
        private webhookSecret?: string
    ) { }

    async connect(client: Client) {
        this.voiceService = new VoiceService(client);

        // Initialize NeatQueue service
        if (process.env.QUEUE_CHANNEL_ID && process.env.NEATQUEUE_BOT_ID) {
            this.neatQueueService = new NeatQueueService(
                process.env.QUEUE_CHANNEL_ID || '',
                process.env.NEATQUEUE_BOT_ID || '',
                process.env.NEATQUEUE_API_KEY || '',
                this
            );

            // Monitor NeatQueue for match updates
            this.neatQueueService.onMatchUpdate((matchData) => {
                console.log('📊 NeatQueue match update:', matchData);
                // Send to backend
                this.send({
                    type: 'NEATQUEUE_MATCH_UPDATE',
                    matchData
                });
            });
        }

        const normalizedUrl = this.backendUrl.endsWith('/') ? this.backendUrl.slice(0, -1) : this.backendUrl;
        const wsUrl = normalizedUrl.replace('https://', 'wss://').replace('http://', 'ws://');

        try {
            console.log(`🔄 Connecting to backend: ${wsUrl}/ws`);

            this.ws = new WebSocket(`${wsUrl}/ws`);

            this.ws.on('open', () => {
                console.log('✅ Connected to backend WebSocket');

                // Register as bot
                console.log('👤 Sending REGISTER message for discord-bot...');
                this.send({
                    type: 'REGISTER',
                    userId: 'discord-bot',
                    username: 'Discord Bot'
                });
            });

            this.ws.on('message', async (data) => {
                const rawData = data.toString();
                console.log('📥 Raw message received:', rawData.slice(0, 200), rawData.length > 200 ? '...' : '');
                try {
                    const message: BackendMessage = JSON.parse(rawData);
                    await this.handleMessage(message, client);
                } catch (error) {
                    console.error('❌ Error handling backend message:', error);
                }
            });

            this.ws.on('close', () => {
                console.log('⚠️ Backend WebSocket closed, reconnecting in 5s...');
                this.reconnectTimeout = setTimeout(() => this.connect(client), 5000);
            });

            this.ws.on('error', (error) => {
                console.error('❌ Backend WebSocket error:', error);
            });

        } catch (error) {
            console.error('❌ Failed to connect to backend:', error);
            this.reconnectTimeout = setTimeout(() => this.connect(client), 5000);
        }
    }

    private async handleMessage(message: BackendMessage, client: Client) {
        console.log(`� Incoming message type: ${message.type}`);

        // Always try to send a heart-beat back to confirm we're alive
        this.sendDebugLog(`💓 Heartbeat: Received ${message.type}`);

        switch (message.type) {
            case 'REGISTER_ACK':
                console.log(`✅ Registration confirmed for: ${message.userId}`);
                break;

            case 'CREATE_MATCH':
                // Use a timeout to ensure we don't hang the bot forever
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Match creation TIMEOUT (30s)')), 30000);
                });

                try {
                    await Promise.race([
                        this.handleMatchCreation(message.matchData!, client),
                        timeoutPromise
                    ]);
                } catch (err: any) {
                    this.sendDebugLog(`🚨 CREATE_MATCH error: ${err.message}`);
                    console.error('❌ Match creation failed:', err);
                }
                break;
        }
    }

    private async handleMatchCreation(matchData: MatchData, client: Client) {
        this.sendDebugLog(`🎮 Processing CREATE_MATCH for lobby ${matchData.lobbyId}`);

        // Diagnostic: Check environment variables
        const requiredVars = ['DISCORD_GUILD_ID', 'QUEUE_CHANNEL_ID', 'NEATQUEUE_BOT_ID', 'BACKEND_URL'];
        requiredVars.forEach(v => {
            this.sendDebugLog(`   Env check: ${v} = ${process.env[v] ? 'Present' : 'MISSING'}`);
        });

        try {
            const guildId = process.env.DISCORD_GUILD_ID;
            if (!guildId) {
                throw new Error('MISSING DISCORD_GUILD_ID');
            }

            this.sendDebugLog(`📡 Fetching guild ${guildId}...`);
            const guild = await client.guilds.fetch(guildId);
            if (!guild) {
                throw new Error(`Guild ${guildId} not accessible`);
            }
            this.sendDebugLog(`✅ Guild found: ${guild.name}`);

            // Step 1: Trigger NeatQueue to create game server
            if (this.neatQueueService) {
                console.log('🎮 Requesting NeatQueue to create game server...');
                const result = await this.neatQueueService.createMatch(matchData.players);

                if (result.success && result.serverInfo) {
                    console.log('✅ Game server created:', result.serverInfo);

                    // Generate match link
                    const matchLink = `standoff://connect/${result.serverInfo.ip}/${result.serverInfo.password}`;

                    // Send server info via API (primary method)
                    const apiSuccess = await this.sendServerInfo(matchData.lobbyId, {
                        ip: result.serverInfo.ip,
                        password: result.serverInfo.password,
                        matchLink
                    });

                    // Also send via WebSocket for backward compatibility
                    this.send({
                        type: 'SERVER_CREATED',
                        lobbyId: matchData.lobbyId,
                        serverInfo: {
                            ...result.serverInfo,
                            matchLink
                        }
                    });

                    if (!apiSuccess) {
                        console.warn('⚠️ API call failed, but WebSocket message sent');
                    }
                } else {
                    console.error('❌ Failed to create game server:', result.error);

                    // Notify backend of failure
                    this.send({
                        type: 'SERVER_CREATION_FAILED',
                        lobbyId: matchData.lobbyId,
                        error: result.error
                    });
                    return;
                }
            }

            // Step 2: Create voice channels
            await this.voiceService?.createMatchChannels(guild, matchData);

            console.log('✅ Match setup complete');
        } catch (error) {
            console.error('❌ Error creating match:', error);
        }
    }

    send(data: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('⚠️ WebSocket not connected, message not sent');
        }
    }

    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        if (this.ws) {
            this.ws.close();
        }
    }

    async fetchMatchStatus(): Promise<any> {
        try {
            const normalizedUrl = this.backendUrl.endsWith('/') ? this.backendUrl.slice(0, -1) : this.backendUrl;
            const response = await fetch(`${normalizedUrl}/api/match/status`);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('❌ Error fetching match status:', error);
        }
        return null;
    }

    async updateNickname(userId: string, nickname: string): Promise<boolean> {
        try {
            const normalizedUrl = this.backendUrl.endsWith('/') ? this.backendUrl.slice(0, -1) : this.backendUrl;
            const response = await fetch(`${normalizedUrl}/api/profile/${userId}/nickname`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ standoff_nickname: nickname })
            });
            return response.ok;
        } catch (error) {
            console.error('❌ Error updating nickname:', error);
            return false;
        }
    }

    /**
     * Send a debug log to the backend console (via Wrangler)
     */
    public sendDebugLog(message: string) {
        console.log(`🤖 DEBUG: ${message}`);
        this.send({
            type: 'DEBUG_BOT_LOG',
            message
        });
    }

    async sendServerInfo(lobbyId: string, serverInfo: { ip: string; password: string; matchLink?: string }): Promise<boolean> {
        try {
            const normalizedUrl = this.backendUrl.endsWith('/') ? this.backendUrl.slice(0, -1) : this.backendUrl;

            // Generate match link if not provided
            const matchLink = serverInfo.matchLink || `standoff://connect/${serverInfo.ip}/${serverInfo.password}`;

            const response = await fetch(`${normalizedUrl}/api/match/server-info`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lobbyId,
                    serverInfo: {
                        ...serverInfo,
                        matchLink
                    }
                })
            });

            if (response.ok) {
                const result = await response.json() as any;
                console.log('✅ Server info sent via API:', result);
                return result.success === true;
            } else {
                const error = await response.text();
                console.error('❌ Failed to send server info:', error);
                return false;
            }
        } catch (error) {
            console.error('❌ Error sending server info:', error);
            return false;
        }
    }
}
