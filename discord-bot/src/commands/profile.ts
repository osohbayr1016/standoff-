
import { SlashCommandBuilder, AttachmentBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BackendService } from '../services/backend';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import React from 'react';

import fs from 'fs';
import path from 'path';

// Load font once
let fontData: Buffer | null = null;
function getFontData() {
    if (fontData) return fontData;

    try {
        const fontPath = path.join(process.cwd(), 'fonts', 'Roboto-Bold.ttf');
        console.log(`Loading font from ${fontPath}`);
        if (fs.existsSync(fontPath)) {
            fontData = fs.readFileSync(fontPath);
            console.log(`Font loaded, size: ${fontData.byteLength}`);
        } else {
            console.error(`Font file not found at ${fontPath}`);
            // Fallback to fetch if local file missing? No, let's fail loud or try fetch.
            // But we want robustness.
            throw new Error(`Font file missing: ${fontPath}`);
        }
    } catch (err) {
        console.error('Error loading font:', err);
        throw err;
    }

    return fontData;
}

export const profileCommand = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View player profile stats')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to view (optional)')
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction, backend: BackendService) {
        await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const profile = await backend.fetchProfile(targetUser.id);

            if (!profile) {
                await interaction.editReply('Player not linked! Ask them to log in to the website first.');
                return;
            }

            const font = getFontData();
            if (!font) throw new Error('Font not loaded');

            const element = React.createElement(
                'div',
                {
                    style: {
                        display: 'flex',
                        height: '100%',
                        width: '100%',
                        backgroundColor: '#0a0a0a',
                        color: 'white',
                        padding: '40px',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        backgroundImage: 'linear-gradient(135deg, #1a1c20 0%, #0a0a0a 100%)',
                        fontFamily: 'Roboto',
                    },
                },
                [
                    React.createElement('div', { key: 'header', style: { display: 'flex', alignItems: 'center', gap: '20px' } }, [
                        React.createElement('img', {
                            key: 'avatar',
                            src: `https://cdn.discordapp.com/avatars/${profile.discord_id}/${profile.discord_avatar}.png`,
                            style: { width: '120px', height: '120px', borderRadius: '50%', border: '4px solid #f97316' }
                        }),
                        React.createElement('div', { key: 'info', style: { display: 'flex', flexDirection: 'column' } }, [
                            React.createElement('span', { key: 'nick', style: { fontSize: '48px', fontWeight: 'bold' } }, profile.standoff_nickname || 'Unknown'),
                            React.createElement('span', { key: 'rank', style: { fontSize: '24px', color: '#aaa' } }, `Rank: ${profile.elo >= 1600 ? 'GOLD' : profile.elo >= 1200 ? 'SILVER' : 'BRONZE'}`)
                        ])
                    ]),
                    React.createElement('div', { key: 'stats', style: { display: 'flex', gap: '40px', marginTop: '40px' } }, [
                        React.createElement('div', { key: 'comp', style: { display: 'flex', flexDirection: 'column', backgroundColor: '#222', padding: '20px', borderRadius: '10px', flex: 1, borderLeft: '4px solid #f97316' } }, [
                            React.createElement('span', { key: 'comp-label', style: { color: '#888', fontSize: '18px', textTransform: 'uppercase' } }, 'Competitive Elo'),
                            React.createElement('span', { key: 'comp-val', style: { fontSize: '42px', fontWeight: 'bold' } }, String(profile.elo))
                        ]),
                        React.createElement('div', { key: 'allies', style: { display: 'flex', flexDirection: 'column', backgroundColor: '#222', padding: '20px', borderRadius: '10px', flex: 1, borderLeft: '4px solid #f97316' } }, [
                            React.createElement('span', { key: 'allies-label', style: { color: '#888', fontSize: '18px', textTransform: 'uppercase' } }, 'Allies Elo'),
                            React.createElement('span', { key: 'allies-val', style: { fontSize: '42px', fontWeight: 'bold' } }, String(profile.allies_elo || 1000))
                        ]),
                    ])
                ]
            );

            const svg = await satori(element, {
                width: 800,
                height: 400,
                fonts: [{ name: 'Roboto', data: font, weight: 700, style: 'normal' }]
            });

            const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 800 } });
            const pngData = resvg.render();
            const pngBuffer = pngData.asPng();

            const attachment = new AttachmentBuilder(pngBuffer, { name: 'profile.png' });

            await interaction.editReply({ files: [attachment] });

        } catch (error) {
            console.error('Profile command error:', error);
            await interaction.editReply('Failed to generate profile image.');
        }
    }
};
