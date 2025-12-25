import { Client } from 'discord.js';
import WebSocket from 'ws';
import type { BackendMessage, MatchData } from '../types';

export class BackendService {
    private ws: WebSocket | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    constructor(
        private backendUrl: string,
        private webhookSecret?: string
    ) { }

    async connect(client: Client) {
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
                const raw = data.toString();
                try {
                    const message: BackendMessage = JSON.parse(raw);
                    this.send({ type: 'DEBUG_BOT_LOG', message: `Received: ${message.type}` });

                    if (message.type === 'CREATE_MATCH' && message.matchData) {
                        const lobbyId = message.matchData.lobbyId;
                        this.send({ type: 'DEBUG_BOT_LOG', message: `Processing match ${lobbyId}` });

                        // IMMEDIATELY respond with dummy server info - NO Discord interaction
                        this.send({
                            type: 'SERVER_CREATED',
                            lobbyId: lobbyId,
                            serverInfo: {
                                ip: '127.0.0.1:27015',
                                password: 'test123',
                                matchLink: 'standoff://connect/127.0.0.1:27015/test123'
                            }
                        });

                        this.send({ type: 'DEBUG_BOT_LOG', message: `✅ Sent SERVER_CREATED for ${lobbyId}` });
                    }
                } catch (error) {
                    console.error('Parse error:', error);
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

    // Required by other files
    public send(data: any) {
        if (this.ws && (this.ws as any).readyState === 1) {
            this.ws.send(JSON.stringify(data));
        }
    }

    public sendDebugLog(message: string) {
        console.log(`🤖 DEBUG: ${message}`);
        this.send({ type: 'DEBUG_BOT_LOG', message });
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
}
