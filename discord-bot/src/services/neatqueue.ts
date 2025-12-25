import { Client, TextChannel, Message } from 'discord.js';

export class NeatQueueService {
    private queueChannelId: string;
    private neatQueueBotId: string;

    constructor(
        private client: Client,
        queueChannelId: string,
        neatQueueBotId: string
    ) {
        this.queueChannelId = queueChannelId;
        this.neatQueueBotId = neatQueueBotId;
    }

    /**
     * Trigger NeatQueue to create a match
     * This sends the command to start a match in NeatQueue
     */
    async createMatch(players: any[]): Promise<{ success: boolean; serverInfo?: any; error?: string }> {
        try {
            const channel = await this.client.channels.fetch(this.queueChannelId) as TextChannel;

            if (!channel || !channel.isTextBased()) {
                return { success: false, error: 'Queue channel not found or not a text channel' };
            }

            console.log('🎮 Triggering NeatQueue match creation...');

            // Step 1: Force add players to the queue
            // Filter out bots or invalid IDs if necessary
            for (const player of players) {
                // Assuming player object has discord_id. If it's a bot ID (starts with 'bot_'), skip it?
                // NeatQueue might not support adding non-discord users.
                // If it's a real player from web, they should have a discord_id.
                const discordId = player.discord_id || player.id;

                // Skip if it looks like a generated bot ID (e.g. "bot_123...") unless we can add them
                // For now, let's try to add everyone who has a valid-looking Discord ID (numeric)
                if (discordId && /^\d+$/.test(discordId)) {
                    console.log(`Adding player ${player.username} (${discordId}) to queue...`);
                    await channel.send(`!add <@${discordId}>`);
                    // Small delay to prevent rate limits / order issues
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            // Send the start command to NeatQueue
            await channel.send('!start');
            // Or maybe just force start if it doesn't auto-start? 
            // Usually adding 10 players auto-starts it.

            // Wait for NeatQueue's response
            const serverInfo = await this.waitForMatchCreation(channel);

            if (serverInfo) {
                console.log('✅ NeatQueue match created successfully');
                return { success: true, serverInfo };
            } else {
                return { success: false, error: 'Timeout waiting for NeatQueue response' };
            }

        } catch (error) {
            console.error('❌ Error creating NeatQueue match:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Wait for NeatQueue to respond with match details
     */
    private async waitForMatchCreation(channel: TextChannel): Promise<any> {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                collector.stop();
                resolve(null);
            }, 30000); // 30 second timeout

            const collector = channel.createMessageCollector({
                filter: (msg: Message) => msg.author.id === this.neatQueueBotId,
                time: 30000,
                max: 1
            });

            collector.on('collect', (message: Message) => {
                clearTimeout(timeout);

                // Parse NeatQueue's response
                const serverInfo = this.parseMatchMessage(message);
                resolve(serverInfo);
            });

            collector.on('end', () => {
                clearTimeout(timeout);
            });
        });
    }

    /**
     * Parse NeatQueue's match creation message to extract server details
     */
    private parseMatchMessage(message: Message): any {
        try {
            // NeatQueue typically sends an embed with match details
            if (message.embeds.length > 0) {
                const embed = message.embeds[0];

                // Extract server information from embed
                // This is a template - adjust based on actual NeatQueue embed structure
                const serverInfo: any = {
                    matchId: null,
                    ip: null,
                    password: null,
                    teams: {
                        alpha: [],
                        bravo: []
                    }
                };

                // Parse embed fields
                embed.fields?.forEach(field => {
                    const name = field.name.toLowerCase();
                    const value = field.value;

                    if (name.includes('server') || name.includes('ip')) {
                        serverInfo.ip = value;
                    } else if (name.includes('password')) {
                        serverInfo.password = value;
                    } else if (name.includes('team') && name.includes('alpha')) {
                        serverInfo.teams.alpha = this.parsePlayerList(value);
                    } else if (name.includes('team') && name.includes('bravo')) {
                        serverInfo.teams.bravo = this.parsePlayerList(value);
                    }
                });

                // Extract match ID from title or description
                if (embed.title) {
                    const matchIdMatch = embed.title.match(/#(\d+)/);
                    if (matchIdMatch) {
                        serverInfo.matchId = matchIdMatch[1];
                    }
                }

                console.log('📊 Parsed server info:', serverInfo);
                return serverInfo;
            }

            // Fallback: parse from message content
            const content = message.content;
            return {
                matchId: null,
                ip: this.extractServerIp(content),
                password: null,
                rawMessage: content
            };

        } catch (error) {
            console.error('❌ Error parsing match message:', error);
            return null;
        }
    }

    /**
     * Parse player list from embed field value
     */
    private parsePlayerList(value: string): string[] {
        // NeatQueue typically formats players as mentions or names
        // Example: "<@123456789> <@987654321>"
        const mentions = value.match(/<@!?(\d+)>/g);
        if (mentions) {
            return mentions.map(m => m.replace(/<@!?(\d+)>/, '$1'));
        }

        // Fallback: split by newlines or commas
        return value.split(/[\n,]/).map(p => p.trim()).filter(p => p);
    }

    /**
     * Extract server IP from text
     */
    private extractServerIp(text: string): string | null {
        // Look for IP:PORT pattern
        const ipMatch = text.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):?(\d+)?/);
        if (ipMatch) {
            return ipMatch[0];
        }
        return null;
    }

    /**
     * Monitor NeatQueue messages for match updates
     */
    onMatchUpdate(callback: (matchData: any) => void) {
        this.client.on('messageCreate', async (message) => {
            if (message.author.id !== this.neatQueueBotId) return;
            if (message.channelId !== this.queueChannelId) return;

            // Check if this is a match update
            if (message.embeds.length > 0) {
                const embed = message.embeds[0];

                if (embed.title?.toLowerCase().includes('match') ||
                    embed.title?.toLowerCase().includes('game')) {

                    const matchData = this.parseMatchMessage(message);
                    if (matchData) {
                        callback(matchData);
                    }
                }
            }
        });
    }
}
