import { Client } from 'discord.js';
import WebSocket from 'ws';
import type { BackendMessage, MatchData } from '../types';
import { ModeratorService } from './moderator';

export class BackendService {
    private ws: WebSocket | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private client: Client | null = null;
    private moderatorService: ModeratorService | null = null;

    constructor(
        private backendUrl: string,
        private webhookSecret?: string
    ) { }

    setModeratorService(service: ModeratorService) {
        this.moderatorService = service;
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

                    // Handle moderator verification requests
                    if (message.type === 'VERIFY_MODERATOR') {
                        await this.handleVerifyModerator(message);
                    }

                    // Handle match-related messages (simplified without NeatQueue)
                    if (message.type === 'MATCH_CREATED') {
                        this.sendDebugLog(`📢 Match created: ${message.matchId}`);
                    }

                    if (message.type === 'MATCH_RESULT_SUBMITTED') {
                        this.sendDebugLog(`📋 Match result submitted: ${message.matchId}`);
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

    private async handleVerifyModerator(message: any) {
        const { discordId, requestId } = message;
        this.sendDebugLog(`🔍 Verifying moderator: ${discordId}`);

        if (!this.moderatorService) {
            this.send({
                type: 'VERIFY_MODERATOR_RESPONSE',
                requestId,
                discordId,
                isModerator: false,
                error: 'Moderator service not configured'
            });
            return;
        }

        try {
            const isModerator = await this.moderatorService.checkModeratorRole(discordId);
            this.send({
                type: 'VERIFY_MODERATOR_RESPONSE',
                requestId,
                discordId,
                isModerator
            });
            this.sendDebugLog(`✅ Moderator check complete: ${discordId} = ${isModerator}`);
        } catch (error: any) {
            this.send({
                type: 'VERIFY_MODERATOR_RESPONSE',
                requestId,
                discordId,
                isModerator: false,
                error: error.message
            });
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

    // Check moderator status directly
    async checkModerator(discordId: string): Promise<boolean> {
        if (!this.moderatorService) {
            return false;
        }
        return this.moderatorService.checkModeratorRole(discordId);
    }

    // Notify match events to Discord (for announcements)
    async notifyMatchCreated(matchId: string, hostName: string, lobbyUrl: string) {
        // Future: Send to a Discord channel
        this.sendDebugLog(`📢 New match by ${hostName}: ${matchId}`);
    }

    async notifyMatchCompleted(matchId: string, winnerTeam: string) {
        // Future: Send to a Discord channel
        this.sendDebugLog(`🏆 Match ${matchId} completed. Winner: ${winnerTeam}`);
    }
}
