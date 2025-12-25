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

            // Send the start command to NeatQueue
            // Note: Adjust this command based on your NeatQueue configuration
            await channel.send('/start');

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
                    serverIp: null,
                    serverPassword: null,
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
                        serverInfo.serverIp = value;
                    } else if (name.includes('password')) {
                        serverInfo.serverPassword = value;
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
                serverIp: this.extractServerIp(content),
                serverPassword: null,
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
