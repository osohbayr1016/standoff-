import { Client, Events } from 'discord.js';
import { BackendService } from '../services/backend';

export function setupEventHandlers(client: Client, backendService: BackendService) {
    // Monitor NeatQueue bot messages
    client.on(Events.MessageCreate, async (message) => {
        // Ignore messages from our own bot
        if (message.author.id === client.user?.id) return;

        // Check if message is from NeatQueue bot
        const NEATQUEUE_BOT_ID = process.env.NEATQUEUE_BOT_ID;
        if (NEATQUEUE_BOT_ID && message.author.id === NEATQUEUE_BOT_ID) {
            console.log('📨 NeatQueue message detected');

            // Parse NeatQueue embeds for queue updates
            if (message.embeds.length > 0) {
                const embed = message.embeds[0];

                // Queue update
                if (embed.title?.toLowerCase().includes('queue')) {
                    console.log('📊 Queue update from NeatQueue');
                    // TODO: Parse queue data and sync to backend
                }

                // Match created
                if (embed.title?.toLowerCase().includes('match')) {
                    console.log('🎮 Match created by NeatQueue');
                    // TODO: Parse match data
                }
            }
        }
    });

    // Monitor voice state changes
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        const QUEUE_CHANNEL_ID = process.env.QUEUE_CHANNEL_ID;

        // Player joined queue voice channel
        if (newState.channelId === QUEUE_CHANNEL_ID && oldState.channelId !== QUEUE_CHANNEL_ID) {
            console.log(`🎤 ${newState.member?.user.username} joined queue voice`);

            // Notify backend
            backendService.send({
                type: 'VOICE_JOIN',
                userId: newState.member?.user.id,
                username: newState.member?.user.username
            });
        }

        // Player left queue voice channel
        if (oldState.channelId === QUEUE_CHANNEL_ID && newState.channelId !== QUEUE_CHANNEL_ID) {
            console.log(`🎤 ${oldState.member?.user.username} left queue voice`);

            // Notify backend
            backendService.send({
                type: 'VOICE_LEAVE',
                userId: oldState.member?.user.id
            });
        }
    });

    // Log when bot joins a guild
    client.on(Events.GuildCreate, (guild) => {
        console.log(`✅ Bot added to guild: ${guild.name} (${guild.id})`);
    });

    // Log when bot leaves a guild
    client.on(Events.GuildDelete, (guild) => {
        console.log(`⚠️ Bot removed from guild: ${guild.name} (${guild.id})`);
    });
}
