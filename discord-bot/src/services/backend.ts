import { Client } from 'discord.js';
import WebSocket from 'ws';
import type { BackendMessage, MatchData } from '../types';
import { NeatQueueService } from './neatqueue';

export class BackendService {
    private ws: WebSocket | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private client: Client | null = null;
    private neatQueueService: NeatQueueService | null = null;

    constructor(
        private backendUrl: string,
        private webhookSecret?: string
    ) { }

    setNeatQueueService(service: NeatQueueService) {
        this.neatQueueService = service;
    }

    async connect(client: Client) {
        this.client = client;
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
                        await this.handleCreateMatch(message.matchData);
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

    private async handleCreateMatch(matchData: MatchData) {
        const lobbyId = matchData.lobbyId;
        this.sendDebugLog(`🎮 Processing CREATE_MATCH for lobby ${lobbyId}`);

        // Check if we have NeatQueue service configured
        if (this.neatQueueService && this.client) {
            try {
                const guildId = process.env.DISCORD_GUILD_ID;
                if (!guildId) {
                    throw new Error('DISCORD_GUILD_ID not configured');
                }

                const guild = await this.client.guilds.fetch(guildId);
                this.sendDebugLog(`✅ Guild found: ${guild.name}`);

                // Use NeatQueue to create the match
                this.sendDebugLog(`📡 Calling NeatQueue createMatch...`);
                const result = await this.neatQueueService.createMatch(matchData, guild);

                if (result.success && result.serverInfo) {
                    this.sendDebugLog(`✅ NeatQueue match created successfully`);
                    this.send({
                        type: 'SERVER_CREATED',
                        lobbyId: lobbyId,
                        serverInfo: result.serverInfo
                    });
                } else {
                    this.sendDebugLog(`❌ NeatQueue failed: ${result.error}`);
                    // Fall back to dummy data so the match can still proceed
                    this.sendDebugLog(`⚠️ Using fallback dummy server info`);
                    this.send({
                        type: 'SERVER_CREATED',
                        lobbyId: lobbyId,
                        serverInfo: {
                            ip: '127.0.0.1:27015',
                            password: 'test123',
                            matchLink: 'standoff://connect/127.0.0.1:27015/test123',
                            note: 'Fallback - NeatQueue failed'
                        }
                    });
                }
            } catch (error: any) {
                this.sendDebugLog(`❌ Error in NeatQueue flow: ${error.message}`);
                // Fall back to dummy data
                this.send({
                    type: 'SERVER_CREATED',
                    lobbyId: lobbyId,
                    serverInfo: {
                        ip: '127.0.0.1:27015',
                        password: 'test123',
                        matchLink: 'standoff://connect/127.0.0.1:27015/test123',
                        note: 'Fallback - Error occurred'
                    }
                });
            }
        } else {
            // No NeatQueue configured, use dummy data
            this.sendDebugLog(`⚠️ NeatQueue service not configured, using dummy data`);
            this.send({
                type: 'SERVER_CREATED',
                lobbyId: lobbyId,
                serverInfo: {
                    ip: '127.0.0.1:27015',
                    password: 'test123',
                    matchLink: 'standoff://connect/127.0.0.1:27015/test123'
                }
            });
        }

        this.sendDebugLog(`✅ Sent SERVER_CREATED for ${lobbyId}`);
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
