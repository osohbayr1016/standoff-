import { Client, GatewayIntentBits, Events, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { setupEventHandlers } from './events';
import { commands } from './commands';
import { BackendService } from './services/backend';
import { NeatQueueService } from './services/neatqueue';

dotenv.config();

// Validate environment variables
const requiredEnvVars = [
    'DISCORD_TOKEN|DISCORD_BOT_TOKEN',
    'DISCORD_CLIENT_ID',
    'DISCORD_GUILD_ID',
    'BACKEND_URL'
];

// Helper to get token from available env vars
const getDiscordToken = () => process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;

for (const envVar of requiredEnvVars) {
    if (envVar.includes('|')) {
        const options = envVar.split('|');
        if (!options.some(opt => process.env[opt])) {
            console.error(`❌ Missing required environment variable: One of ${options.join(' or ')}`);
            process.exit(1);
        }
    } else if (!process.env[envVar]) {
        console.error(`❌ Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}

// Validate Discord token
const token = getDiscordToken();
if (!token) {
    console.error('❌ DISCORD_TOKEN or DISCORD_BOT_TOKEN is not set!');
    process.exit(1);
}

// Check if token is a placeholder
if (token.includes('your_bot_token') || token.includes('placeholder') || token.length < 50) {
    console.error('❌ Invalid Discord token detected!');
    console.error('   Token appears to be a placeholder or too short.');
    console.error('   Token length:', token.length);
    console.error('   Please set a valid Discord bot token in your environment variables.');
    console.error('   Get your token from: https://discord.com/developers/applications');
    process.exit(1);
}

console.log('✅ Discord token validated (length:', token.length, 'characters)');

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

// Initialize backend service
const backendService = new BackendService(
    process.env.BACKEND_URL!,
    process.env.BACKEND_WEBHOOK_SECRET
);

// Initialize NeatQueue service if configured
if (process.env.QUEUE_CHANNEL_ID && process.env.NEATQUEUE_BOT_ID && process.env.NEATQUEUE_API_KEY) {
    console.log('✅ NeatQueue service configured');
    const neatQueueService = new NeatQueueService(
        process.env.QUEUE_CHANNEL_ID,
        process.env.NEATQUEUE_BOT_ID,
        process.env.NEATQUEUE_API_KEY,
        backendService
    );
    backendService.setNeatQueueService(neatQueueService);
} else {
    console.log('⚠️ NeatQueue not fully configured - will use dummy server info');
    console.log('   QUEUE_CHANNEL_ID:', process.env.QUEUE_CHANNEL_ID ? 'Set' : 'Missing');
    console.log('   NEATQUEUE_BOT_ID:', process.env.NEATQUEUE_BOT_ID ? 'Set' : 'Missing');
    console.log('   NEATQUEUE_API_KEY:', process.env.NEATQUEUE_API_KEY ? 'Set' : 'Missing');
}

// Register slash commands
async function registerCommands(botToken: string) {
    try {
        console.log('🔄 Registering slash commands...');

        const rest = new REST().setToken(botToken);

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.DISCORD_CLIENT_ID!,
                process.env.DISCORD_GUILD_ID!
            ),
            { body: commands.map(cmd => cmd.data.toJSON()) }
        );

        console.log('✅ Slash commands registered successfully');
    } catch (error) {
        console.error('❌ Failed to register commands:', error);
    }
}

// Bot ready event
client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Bot logged in as ${c.user.tag}`);
    console.log(`🎮 Serving ${c.guilds.cache.size} guild(s)`);

    // Register commands
    await registerCommands(token);

    // Connect to backend
    await backendService.connect(client);

    console.log('🚀 Bot is ready!');
});

// Setup event handlers
setupEventHandlers(client, backendService);


// Handle command interactions
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.find(cmd => cmd.data.name === interaction.commandName);

    if (!command) {
        console.warn(`⚠️ Unknown command: ${interaction.commandName}`);
        return;
    }

    try {
        await command.execute(interaction, backendService);
    } catch (error) {
        console.error(`❌ Error executing command ${interaction.commandName}:`, error);

        const errorMessage = 'There was an error executing this command!';

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    }
});

// Error handling
client.on(Events.Error, (error) => {
    console.error('❌ Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
});

// Login
console.log('🔄 Starting Discord bot...');
client.login(token);

