import { Client, GatewayIntentBits, Events, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { setupEventHandlers } from './events';
import { commands } from './commands';
import { BackendService } from './services/backend';

dotenv.config();

// Validate environment variables
const requiredEnvVars = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'DISCORD_GUILD_ID',
    'BACKEND_URL'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`❌ Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}

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

// Register slash commands
async function registerCommands() {
    try {
        console.log('🔄 Registering slash commands...');

        const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

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
    await registerCommands();

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
client.login(process.env.DISCORD_TOKEN);

console.log('🔄 Starting Discord bot...');
