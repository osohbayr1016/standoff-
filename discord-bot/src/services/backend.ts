import { Client, TextChannel, Message } from 'discord.js';
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
                const rawData = data.toString();
                try {
                    const message: BackendMessage = JSON.parse(rawData);
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
                }
                break;
        }
    }

    private async handleMatchCreation(matchData: MatchData, client: Client) {
        this.sendDebugLog(`🎮 Processing CREATE_MATCH for lobby ${matchData.lobbyId}`);

        try {
            const guildId = process.env.DISCORD_GUILD_ID;
            const channelId = process.env.QUEUE_CHANNEL_ID;
            const neatQueueBotId = process.env.NEATQUEUE_BOT_ID;

            if (!guildId || !channelId || !neatQueueBotId) {
                throw new Error(`Missing config: GUILD=${!!guildId}, CHAN=${!!channelId}, BOT=${!!neatQueueBotId}`);
            }

            this.sendDebugLog(`📡 Fetching guild ${guildId}...`);
            const guild = await client.guilds.fetch(guildId);
            this.sendDebugLog(`✅ Guild found: ${guild.name}`);

            this.sendDebugLog(`📡 Fetching channel ${channelId}...`);
            const channel = await guild.channels.fetch(channelId) as TextChannel;
            if (!channel || !channel.isTextBased()) {
                throw new Error(`Channel ${channelId} not found or not text-based`);
            }
            this.sendDebugLog(`✅ Channel found: #${channel.name}`);

            // Step 1: Add players
            const players = matchData.players || [];
            this.sendDebugLog(`👥 Adding ${players.length} players to NeatQueue...`);

            for (const player of players) {
                const discordId = player.discord_id || player.id;
                if (discordId && /^\d+$/.test(discordId)) {
                    await channel.send(`!add <@${discordId}>`);
                    await new Promise(r => setTimeout(r, 800));
                }
            }

            // Step 2: Start
            this.sendDebugLog('📤 Sending !start...');
            await channel.send('!start');

            // Step 3: Wait for response
            this.sendDebugLog('⏳ Waiting for NeatQueue Bot response (30s)...');

            const serverInfo = await new Promise((resolve) => {
                const collector = channel.createMessageCollector({
                    filter: (msg: Message) => msg.author.id === neatQueueBotId,
                    time: 30000,
                    max: 1
                });
                collector.on('collect', (msg) => {
                    const info = this.parseMatchMessage(msg);
                    resolve(info);
                });
                collector.on('end', () => resolve(null));
            });

            if (serverInfo) {
                this.sendDebugLog('✅ Match created!');
                await this.sendServerInfo(matchData.lobbyId, serverInfo as any);
                this.send({ type: 'SERVER_CREATED', lobbyId: matchData.lobbyId, serverInfo });
            } else {
                throw new Error('NeatQueue bot timed out');
            }

            // Voice
            await this.voiceService?.createMatchChannels(guild, matchData);
            this.sendDebugLog('✅ Finalized everything');

        } catch (error: any) {
            this.sendDebugLog(`❌ Crash: ${error.message}`);
            this.send({ type: 'SERVER_CREATION_FAILED', lobbyId: matchData.lobbyId, error: error.message });
        }
    }

    private parseMatchMessage(message: Message): any {
        try {
            if (message.embeds.length > 0) {
                const embed = message.embeds[0];
                const info: any = { ip: null, password: null };
                embed.fields?.forEach(f => {
                    const n = f.name.toLowerCase();
                    if (n.includes('server') || n.includes('ip')) info.ip = f.value;
                    else if (n.includes('password')) info.password = f.value;
                });
                return info.ip ? info : null;
            }
            return null;
        } catch (e) { return null; }
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
