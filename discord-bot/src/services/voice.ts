import {
    Client,
    Guild,
    ChannelType,
    PermissionFlagsBits,
    VoiceChannel,
    CategoryChannel
} from 'discord.js';
import type { MatchData, VoiceChannelPair } from '../types';

export class VoiceService {
    private activeMatches: Map<string, VoiceChannelPair> = new Map();

    constructor(private client: Client) { }

    async createMatchChannels(guild: Guild, matchData: MatchData): Promise<VoiceChannelPair | null> {
        try {
            // Create category for this match
            const category = await guild.channels.create({
                name: `🎮 Match #${matchData.lobbyId.slice(0, 8)}`,
                type: ChannelType.GuildCategory
            });

            // Create Team Alpha voice channel
            const alphaChannel = await guild.channels.create({
                name: '🔴 Team Alpha',
                type: ChannelType.GuildVoice,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.Connect]
                    },
                    ...matchData.teamAlpha
                        .filter(p => p.discord_id)
                        .map(player => ({
                            id: player.discord_id!,
                            allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
                        }))
                ]
            });

            // Create Team Bravo voice channel
            const bravoChannel = await guild.channels.create({
                name: '🔵 Team Bravo',
                type: ChannelType.GuildVoice,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.Connect]
                    },
                    ...matchData.teamBravo
                        .filter(p => p.discord_id)
                        .map(player => ({
                            id: player.discord_id!,
                            allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
                        }))
                ]
            });

            const channelPair: VoiceChannelPair = {
                categoryId: category.id,
                alphaChannelId: alphaChannel.id,
                bravoChannelId: bravoChannel.id,
                matchId: matchData.lobbyId,
                createdAt: new Date()
            };

            this.activeMatches.set(matchData.lobbyId, channelPair);

            // Move players to their respective channels
            await this.movePlayers(guild, matchData, alphaChannel, bravoChannel);

            // Auto-delete after 2 hours
            setTimeout(async () => {
                await this.deleteMatchChannels(matchData.lobbyId);
            }, 2 * 60 * 60 * 1000);

            console.log(`✅ Created voice channels for match ${matchData.lobbyId}`);
            return channelPair;

        } catch (error) {
            console.error('❌ Error creating voice channels:', error);
            return null;
        }
    }

    private async movePlayers(
        guild: Guild,
        matchData: MatchData,
        alphaChannel: VoiceChannel,
        bravoChannel: VoiceChannel
    ) {
        try {
            // Move Team Alpha players
            for (const player of matchData.teamAlpha) {
                if (!player.discord_id) continue;

                try {
                    const member = await guild.members.fetch(player.discord_id);
                    if (member.voice.channel) {
                        await member.voice.setChannel(alphaChannel);
                        console.log(`✅ Moved ${player.username} to Team Alpha`);
                    }
                } catch (err) {
                    console.warn(`⚠️ Could not move player ${player.username}:`, err);
                }
            }

            // Move Team Bravo players
            for (const player of matchData.teamBravo) {
                if (!player.discord_id) continue;

                try {
                    const member = await guild.members.fetch(player.discord_id);
                    if (member.voice.channel) {
                        await member.voice.setChannel(bravoChannel);
                        console.log(`✅ Moved ${player.username} to Team Bravo`);
                    }
                } catch (err) {
                    console.warn(`⚠️ Could not move player ${player.username}:`, err);
                }
            }
        } catch (error) {
            console.error('❌ Error moving players:', error);
        }
    }

    async deleteMatchChannels(matchId: string) {
        const channelPair = this.activeMatches.get(matchId);
        if (!channelPair) return;

        try {
            const guild = await this.client.guilds.fetch(process.env.DISCORD_GUILD_ID!);

            // Fetch the category
            const category = await guild.channels.fetch(channelPair.categoryId) as CategoryChannel;
            if (category && category.type === ChannelType.GuildCategory) {
                // Delete all channels within the category first
                const children = category.children.cache;
                for (const [_, child] of children) {
                    await child.delete();
                }

                // Delete the category itself
                await category.delete();
                console.log(`✅ Deleted match channels and category for ${matchId}`);
            }

            this.activeMatches.delete(matchId);
        } catch (error) {
            console.error(`❌ Error deleting match channels for ${matchId}:`, error);
        }
    }

    getActiveMatches(): VoiceChannelPair[] {
        return Array.from(this.activeMatches.values());
    }
}
