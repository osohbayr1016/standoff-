
import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const commands = [
    new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View player profile stats')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to view (optional)')
                .setRequired(false)
        )
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        const clientId = process.env.DISCORD_CLIENT_ID;
        const guildId = process.env.DISCORD_SERVER_ID;

        if (!clientId || !guildId) {
            throw new Error('Missing DISCORD_CLIENT_ID or DISCORD_SERVER_ID in .env');
        }

        // Guild-based registration for instant updates
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
