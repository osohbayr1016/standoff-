import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BackendService } from '../services/backend';

interface Command {
    data: any;
    execute: (interaction: ChatInputCommandInteraction, backend: BackendService) => Promise<void>;
}

const setNicknameCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('setnickname')
        .setDescription('Set your Standoff 2 in-game nickname')
        .addStringOption(option =>
            option
                .setName('nickname')
                .setDescription('Your Standoff 2 username')
                .setRequired(true)
                .setMaxLength(20)
        ),

    async execute(interaction, backend) {
        const nickname = interaction.options.getString('nickname', true);

        if (!/^[a-zA-Z0-9_]+$/.test(nickname)) {
            await interaction.reply({
                content: 'Nickname can only contain letters, numbers, and underscores!',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const success = await backend.updateNickname(interaction.user.id, nickname);

        if (success) {
            await interaction.editReply('Your Standoff 2 nickname has been set to: ' + nickname);
        } else {
            await interaction.editReply('Failed to update nickname. Please try again later.');
        }
    }
};

const matchCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('match')
        .setDescription('Match commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check current match status')
        ),

    async execute(interaction, backend) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'status') {
            await interaction.deferReply();

            const status = await backend.fetchMatchStatus();

            if (!status) {
                await interaction.editReply('Could not fetch match status.');
                return;
            }

            await interaction.editReply({
                embeds: [{
                    title: 'Match Status',
                    color: 0xFF6B35,
                    fields: [
                        {
                            name: 'Players Ready',
                            value: (status.readyPlayers || 0) + '/10',
                            inline: true
                        },
                        {
                            name: 'State',
                            value: status.state || 'IDLE',
                            inline: true
                        },
                        {
                            name: 'Map',
                            value: status.map || 'Not selected',
                            inline: true
                        }
                    ],
                    timestamp: new Date().toISOString()
                }]
            });
        }
    }
};

import { profileCommand } from './profile';

export const commands: Command[] = [
    setNicknameCommand,
    matchCommand,
    profileCommand
];
