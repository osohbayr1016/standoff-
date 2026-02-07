
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

            // Fetch leaderboard rank
            const leaderboardRank = await backend.fetchLeaderboardRank(profile.discord_id);

            // Extract clan info
            const clan = profile.clan || null;

            // Rank colors and names
            const getRankInfo = (elo: number) => {
                if (elo >= 2000) return { name: 'DIAMOND', color: '#b9f2ff', bgColor: '#0d4f5f' };
                if (elo >= 1600) return { name: 'GOLD', color: '#ffd700', bgColor: '#5f4d0d' };
                if (elo >= 1200) return { name: 'SILVER', color: '#c0c0c0', bgColor: '#3f3f3f' };
                return { name: 'BRONZE', color: '#cd7f32', bgColor: '#4a3520' };
            };

            const compRank = getRankInfo(profile.elo);
            const isVIP = profile.is_vip || profile.role === 'vip' || profile.role === 'admin';

            const element = React.createElement(
                'div',
                {
                    style: {
                        display: 'flex',
                        height: '100%',
                        width: '100%',
                        backgroundColor: '#0a0a0a',
                        color: 'white',
                        padding: '30px',
                        flexDirection: 'column',
                        backgroundImage: 'linear-gradient(135deg, #1a1c20 0%, #0a0a0a 50%, #1a0a0a 100%)',
                        fontFamily: 'Roboto',
                        position: 'relative',
                    },
                },
                [
                    // Top row: Avatar + Name/Rank
                    React.createElement('div', { key: 'header', style: { display: 'flex', alignItems: 'center', gap: '24px' } }, [
                        // Avatar with glow
                        React.createElement('div', { key: 'avatar-wrap', style: { position: 'relative' } }, [
                            React.createElement('img', {
                                key: 'avatar',
                                src: `https://cdn.discordapp.com/avatars/${profile.discord_id}/${profile.discord_avatar}.png`,
                                style: {
                                    width: '100px',
                                    height: '100px',
                                    borderRadius: '50%',
                                    border: `4px solid ${compRank.color}`,
                                    boxShadow: `0 0 20px ${compRank.color}40`
                                }
                            }),
                        ]),
                        // Name and badges
                        React.createElement('div', { key: 'info', style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, [
                            // Name row with clan tag and VIP badge
                            React.createElement('div', { key: 'name-row', style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
                                // Clan tag (if exists)
                                clan ? React.createElement('span', {
                                    key: 'clan-tag',
                                    style: {
                                        color: '#8b5cf6',
                                        fontSize: '28px',
                                        fontWeight: 'bold'
                                    }
                                }, `[${clan.tag}]`) : null,
                                // Nickname
                                React.createElement('span', { key: 'nick', style: { fontSize: '36px', fontWeight: 'bold' } }, profile.standoff_nickname || 'Unknown'),
                                // VIP badge
                                isVIP ? React.createElement('span', {
                                    key: 'vip',
                                    style: {
                                        backgroundColor: '#ffd700',
                                        color: '#000',
                                        padding: '4px 12px',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        fontWeight: 'bold'
                                    }
                                }, '⭐ VIP') : null
                            ].filter(Boolean)),
                            // Rank and Leaderboard row
                            React.createElement('div', { key: 'rank-row', style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
                                // Rank badge
                                React.createElement('div', {
                                    key: 'rank-badge',
                                    style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        backgroundColor: compRank.bgColor,
                                        padding: '6px 16px',
                                        borderRadius: '6px'
                                    }
                                }, [
                                    React.createElement('span', { key: 'rank-icon', style: { fontSize: '18px' } }, '🏆'),
                                    React.createElement('span', { key: 'rank-text', style: { color: compRank.color, fontSize: '18px', fontWeight: 'bold' } }, compRank.name)
                                ]),
                                // Leaderboard rank (if exists)
                                leaderboardRank ? React.createElement('div', {
                                    key: 'lb-rank',
                                    style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        backgroundColor: '#1e1e23',
                                        padding: '6px 14px',
                                        borderRadius: '6px',
                                        border: '1px solid #3f3f46'
                                    }
                                }, [
                                    React.createElement('span', { key: 'lb-icon', style: { fontSize: '16px' } }, '📊'),
                                    React.createElement('span', { key: 'lb-text', style: { color: '#a1a1aa', fontSize: '16px' } }, `#${leaderboardRank}`)
                                ]) : null
                            ].filter(Boolean))
                        ])
                    ]),
                    // Stats row
                    React.createElement('div', { key: 'stats', style: { display: 'flex', gap: '20px', marginTop: '24px' } }, [
                        // Competitive ELO
                        React.createElement('div', { key: 'comp', style: { display: 'flex', flexDirection: 'column', backgroundColor: '#18181b', padding: '16px', borderRadius: '12px', flex: 1, borderLeft: `4px solid ${compRank.color}` } }, [
                            React.createElement('span', { key: 'comp-label', style: { color: '#71717a', fontSize: '14px', textTransform: 'uppercase', marginBottom: '4px' } }, 'Competitive'),
                            React.createElement('span', { key: 'comp-val', style: { fontSize: '32px', fontWeight: 'bold', color: compRank.color } }, String(profile.elo)),
                            React.createElement('div', { key: 'comp-wl', style: { display: 'flex', gap: '12px', marginTop: '8px' } }, [
                                React.createElement('span', { key: 'wins', style: { color: '#22c55e', fontSize: '14px' } }, `W: ${profile.wins || 0}`),
                                React.createElement('span', { key: 'losses', style: { color: '#ef4444', fontSize: '14px' } }, `L: ${profile.losses || 0}`)
                            ])
                        ]),
                        // Allies ELO
                        React.createElement('div', { key: 'allies', style: { display: 'flex', flexDirection: 'column', backgroundColor: '#18181b', padding: '16px', borderRadius: '12px', flex: 1, borderLeft: '4px solid #8b5cf6' } }, [
                            React.createElement('span', { key: 'allies-label', style: { color: '#71717a', fontSize: '14px', textTransform: 'uppercase', marginBottom: '4px' } }, 'Allies'),
                            React.createElement('span', { key: 'allies-val', style: { fontSize: '32px', fontWeight: 'bold', color: '#8b5cf6' } }, String(profile.allies_elo || 1000)),
                            React.createElement('div', { key: 'allies-wl', style: { display: 'flex', gap: '12px', marginTop: '8px' } }, [
                                React.createElement('span', { key: 'a-wins', style: { color: '#22c55e', fontSize: '14px' } }, `W: ${profile.allies_wins || 0}`),
                                React.createElement('span', { key: 'a-losses', style: { color: '#ef4444', fontSize: '14px' } }, `L: ${profile.allies_losses || 0}`)
                            ])
                        ]),
                        // Matches played
                        React.createElement('div', { key: 'matches', style: { display: 'flex', flexDirection: 'column', backgroundColor: '#18181b', padding: '16px', borderRadius: '12px', flex: 1, borderLeft: '4px solid #f97316' } }, [
                            React.createElement('span', { key: 'matches-label', style: { color: '#71717a', fontSize: '14px', textTransform: 'uppercase', marginBottom: '4px' } }, 'Total Matches'),
                            React.createElement('span', { key: 'matches-val', style: { fontSize: '32px', fontWeight: 'bold', color: '#f97316' } }, String((profile.wins || 0) + (profile.losses || 0) + (profile.allies_wins || 0) + (profile.allies_losses || 0))),
                            React.createElement('span', { key: 'matches-sub', style: { color: '#71717a', fontSize: '14px', marginTop: '8px' } }, 'Played')
                        ])
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
