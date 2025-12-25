import { Client } from 'discord.js';
import WebSocket from 'ws';
import type { BackendMessage, MatchData } from '../types';
import { VoiceService } from './voice';

export class BackendService {
    private ws: WebSocket | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private voiceService: VoiceService | null = null;

    constructor(
        private backendUrl: string,
        private webhookSecret?: string
    ) { }

    async connect(client: Client) {
        this.voiceService = new VoiceService(client);

        const normalizedUrl = this.backendUrl.endsWith('/') ? this.backendUrl.slice(0, -1) : this.backendUrl;
        const wsUrl = normalizedUrl.replace('https://', 'wss://').replace('http://', 'ws://');

        try {
            console.log(`🔄 Connecting to backend: ${wsUrl}/ws`);
            this.ws = new WebSocket(`${wsUrl}/ws`);

            this.ws.on('open', () => {
                console.log('✅ Connected to backend WebSocket');
                this.send({
                    type: 'REGISTER',
                    userId: 'discord-bot',
                    username: 'Discord Bot'
                });
            });

            this.ws.on('message', async (data) => {
                try {
                    const message: BackendMessage = JSON.parse(data.toString());
                    await this.handleMessage(message, client);
                } catch (error) {
                    console.error('❌ Error handling message:', error);
                }
            });

            this.ws.on('close', () => {
                console.log('⚠️ WebSocket closed, reconnecting in 5s...');
                this.reconnectTimeout = setTimeout(() => this.connect(client), 5000);
            });

            this.ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error);
            });

        } catch (error) {
            console.error('❌ Connection failed:', error);
            this.reconnectTimeout = setTimeout(() => this.connect(client), 5000);
        }
    }

    private async handleMessage(message: BackendMessage, client: Client) {
        this.sendDebugLog(`💓 Heartbeat: Received ${message.type}`);

        switch (message.type) {
            case 'CREATE_MATCH':
                await this.handleMatchCreation(message.matchData!, client);
                break;
        }
    }

    private async handleMatchCreation(matchData: MatchData, client: Client) {
        this.sendDebugLog(`🎮 Processing CREATE_MATCH for lobby ${matchData.lobbyId}`);

        try {
            // SIMPLIFIED: Skip NeatQueue entirely for now, just send dummy server info
            this.sendDebugLog('🔧 BYPASS MODE: Skipping NeatQueue, sending dummy server info');

            const dummyServerInfo = {
                ip: '127.0.0.1:27015',
                password: 'test123',
                matchLink: `standoff://connect/127.0.0.1:27015/test123`
            };

            // Send via WebSocket
            this.send({
                type: 'SERVER_CREATED',
                lobbyId: matchData.lobbyId,
                serverInfo: dummyServerInfo
            });

            this.sendDebugLog('✅ Sent SERVER_CREATED with dummy info');

            // Also try API endpoint
            await this.sendServerInfo(matchData.lobbyId, dummyServerInfo);
            this.sendDebugLog('✅ Sent server info via API');

            // Create voice channels (optional, might also hang)
            try {
                const guildId = process.env.DISCORD_GUILD_ID;
                if (guildId) {
                    const guild = await client.guilds.fetch(guildId);
                    await this.voiceService?.createMatchChannels(guild, matchData);
                    this.sendDebugLog('✅ Voice channels created');
                }
            } catch (voiceError: any) {
                this.sendDebugLog(`⚠️ Voice channel creation skipped: ${voiceError.message}`);
            }

            this.sendDebugLog('✅ Match setup complete (BYPASS MODE)');

        } catch (error: any) {
            this.sendDebugLog(`❌ Error: ${error.message}`);
            this.send({ type: 'SERVER_CREATION_FAILED', lobbyId: matchData.lobbyId, error: error.message });
        }
    }

    public sendDebugLog(message: string) {
        console.log(`🤖 DEBUG: ${message}`);
        this.send({ type: 'DEBUG_BOT_LOG', message });
    }

    private send(data: any) {
        if (this.ws && (this.ws as any).readyState === 1) {
            this.ws.send(JSON.stringify(data));
        }
    }

    async sendServerInfo(lobbyId: string, serverInfo: any): Promise<boolean> {
        try {
            const normalizedUrl = this.backendUrl.endsWith('/') ? this.backendUrl.slice(0, -1) : this.backendUrl;
            const res = await fetch(`${normalizedUrl}/api/match/server-info`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lobbyId, serverInfo })
            });
            return res.ok;
        } catch (e) { return false; }
    }
}
