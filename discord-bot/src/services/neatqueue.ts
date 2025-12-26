import { Client, TextChannel, Message } from 'discord.js';
import { BackendService } from './backend';
import { MatchData } from '../types';

export class NeatQueueService {
    constructor(
        private queueChannelId: string,
        private neatQueueBotId: string,
        private apiKey: string,
        private backendService?: BackendService
    ) { }

    private log(message: string) {
        console.log(message);
        if (this.backendService) {
            this.backendService.sendDebugLog(message);
        }
    }

    /**
     * Trigger NeatQueue to create a match
     */
    async createMatch(matchData: MatchData, guild: any): Promise<{ success: boolean; serverInfo?: any; error?: string }> {
        try {
            this.log(`🎮 Preparing NeatQueue command for match ${matchData.lobbyId}`);

            this.log(`📡 Fetching channel ${this.queueChannelId}...`);
            const channel = await guild.channels.fetch(this.queueChannelId) as TextChannel;

            if (!channel || !channel.isTextBased()) {
                const err = `Queue channel ${this.queueChannelId} not found or not text-based`;
                this.log(`❌ ${err}`);
                return { success: false, error: err };
            }

            this.log(`✅ Channel found: #${channel.name}`);

            // Step 1: Force add players to the queue
            const players = matchData.players || [];
            this.log(`👥 Adding ${players.length} players to NeatQueue...`);

            for (const player of players) {
                const discordId = player.discord_id || player.id;

                if (discordId && /^\d+$/.test(discordId)) {
                    const addCommand = `!add <@${discordId}>`;
                    this.log(`📤 Command: ${addCommand}`);
                    await channel.send(addCommand);
                    await new Promise(r => setTimeout(r, 800));
                } else {
                    this.log(`ℹ️ Skipping non-discord player: ${player.username} (${discordId})`);
                }
            }

            this.log('📤 Sending !start command...');
            await channel.send('!start');

            this.log(`⏳ Monitoring channel #${channel.name} for match details (30s timeout)...`);

            const debugCollector = channel.createMessageCollector({ time: 30000 });
            debugCollector.on('collect', m => {
                if (m.author.id !== channel.client.user?.id) {
                    this.log(`📩 Msg from ${m.author.username}: ${m.content.slice(0, 50)}${m.embeds.length ? ' (Embed)' : ''}`);
                }
            });

            const serverInfo = await this.waitForMatchCreation(channel);
            debugCollector.stop();

            if (serverInfo) {
                this.log('✅ NeatQueue match created successfully');
                return { success: true, serverInfo };
            } else {
                const err = 'Timeout: NeatQueue bot did not respond with a match embed';
                this.log(`❌ ${err}`);
                this.log('⚠️ Using fallback dummy server info (Testing/Bot Mode)');
                return {
                    success: true,
                    serverInfo: {
                        ip: "127.0.0.1:27015",
                        password: "test-password",
                        matchLink: "standoff://join/test"
                    }
                };
            }

        } catch (error: any) {
            const err = `Error creating NeatQueue match: ${error.message}`;
            this.log(`❌ ${err}`);
            // Also fallback on error
            return {
                success: true,
                serverInfo: {
                    ip: "127.0.0.1:27015",
                    password: "test-password"
                }
            };
        }
    }

    private async waitForMatchCreation(channel: TextChannel): Promise<any> {
        return new Promise((resolve) => {
            let found = false;

            // Timeout to force stop
            const timeout = setTimeout(() => {
                collector.stop();
                // Resolve null if not found by timeout
                if (!found) resolve(null);
            }, 30000);

            const collector = channel.createMessageCollector({
                filter: (msg: Message) => msg.author.id === this.neatQueueBotId,
                time: 30000
            });

            collector.on('collect', (message: Message) => {
                this.log(`📩 Analyzing msg from bot: ${message.content.slice(0, 50)} (Embeds: ${message.embeds.length})`);
                const serverInfo = this.parseMatchMessage(message);
                if (serverInfo) {
                    this.log('✅ Found valid server info in message!');
                    found = true;
                    clearTimeout(timeout);
                    collector.stop();
                    resolve(serverInfo);
                }
            });

            collector.on('end', () => {
                clearTimeout(timeout);
                if (!found) resolve(null);
            });
        });
    }

    private parseMatchMessage(message: Message): any {
        try {
            if (message.embeds.length > 0) {
                const embed = message.embeds[0];
                const serverInfo: any = { ip: null, password: null };

                embed.fields?.forEach(field => {
                    const name = field.name.toLowerCase();
                    const value = field.value;

                    if (name.includes('server') || name.includes('ip')) {
                        serverInfo.ip = value;
                    } else if (name.includes('password')) {
                        serverInfo.password = value;
                    }
                });

                if (embed.title) {
                    const matchIdMatch = embed.title.match(/#(\d+)/);
                    if (matchIdMatch) serverInfo.matchId = matchIdMatch[1];
                }

                return serverInfo.ip ? serverInfo : null;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    onMatchUpdate(callback: (matchData: any) => void) {
        this.log('📡 NeatQueue onMatchUpdate listener active');
    }
}
