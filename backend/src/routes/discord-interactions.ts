
import { Hono } from 'hono';
import { verifyKey } from 'discord-interactions';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-wasm';
import React from 'react';

import { Env } from '../types/shared';

// Define Interaction Types
const InteractionType = {
    PING: 1,
    APPLICATION_COMMAND: 2,
};

const InteractionResponseType = {
    PONG: 1,
    CHANNEL_MESSAGE_WITH_SOURCE: 4,
    DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
};

export const discordInteractions = new Hono<{ Bindings: Env }>();

discordInteractions.post('/', async (c) => {
    const signature = c.req.header('X-Signature-Ed25519');
    const timestamp = c.req.header('X-Signature-Timestamp');
    const rawBody = await c.req.text();

    if (!signature || !timestamp || !c.env.DISCORD_PUBLIC_KEY) {
        return c.text('Bad request signature', 401);
    }

    const isValid = await verifyKey(
        rawBody,
        signature,
        timestamp,
        c.env.DISCORD_PUBLIC_KEY
    );

    if (!isValid) {
        return c.text('Bad request signature', 401);
    }

    const interaction = JSON.parse(rawBody);

    // Handle PING
    if (interaction.type === InteractionType.PING) {
        return c.json({ type: InteractionResponseType.PONG });
    }

    // Handle Commands
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        const { name, options } = interaction.data;

        if (name === 'profile') {
            const targetUserId = options?.find((o: any) => o.name === 'user')?.value || interaction.member.user.id;

            interface PlayerRow {
                id: string;
                discord_id: string;
                discord_avatar: string;
                standoff_nickname: string;
                elo: number;
                allies_elo: number;
            }

            // 1. Fetch User Data
            const player = await c.env.DB.prepare(
                'SELECT * FROM players WHERE discord_id = ?'
            ).bind(targetUserId).first<PlayerRow>();

            if (!player) {
                return c.json({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { content: 'Player not linked! Ask them to log in to the website first.', flags: 64 } // Ephemeral
                });
            }

            // 2. Generate Image with Satori
            // We need a font. For simplicity in Workers, we often load it from an arrayBuffer or CDN.
            // Here we'll use a fetch or import if bundled. For now, let's try fetching a Google Font.
            const fontData = await fetch('https://github.com/google/fonts/raw/main/ofl/roboto/Roboto-Bold.ttf').then(res => res.arrayBuffer());

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
                            src: `https://cdn.discordapp.com/avatars/${player.discord_id}/${player.discord_avatar}.png`,
                            style: { width: '120px', height: '120px', borderRadius: '50%', border: '4px solid #f97316' }
                        }),
                        React.createElement('div', { key: 'info', style: { display: 'flex', flexDirection: 'column' } }, [
                            React.createElement('span', { key: 'nick', style: { fontSize: '48px', fontWeight: 'bold' } }, player.standoff_nickname || 'Unknown'),
                            React.createElement('span', { key: 'rank', style: { fontSize: '24px', color: '#aaa' } }, `Rank: ${player.elo >= 1600 ? 'GOLD' : player.elo >= 1200 ? 'SILVER' : 'BRONZE'}`)
                        ])
                    ]),
                    React.createElement('div', { key: 'stats', style: { display: 'flex', gap: '40px', marginTop: '40px' } }, [
                        React.createElement('div', { key: 'comp', style: { display: 'flex', flexDirection: 'column', backgroundColor: '#222', padding: '20px', borderRadius: '10px', flex: 1, borderLeft: '4px solid #f97316' } }, [
                            React.createElement('span', { key: 'comp-label', style: { color: '#888', fontSize: '18px', textTransform: 'uppercase' } }, 'Competitive Elo'),
                            React.createElement('span', { key: 'comp-val', style: { fontSize: '42px', fontWeight: 'bold' } }, String(player.elo))
                        ]),
                        React.createElement('div', { key: 'allies', style: { display: 'flex', flexDirection: 'column', backgroundColor: '#222', padding: '20px', borderRadius: '10px', flex: 1, borderLeft: '4px solid #f97316' } }, [
                            React.createElement('span', { key: 'allies-label', style: { color: '#888', fontSize: '18px', textTransform: 'uppercase' } }, 'Allies Elo'),
                            React.createElement('span', { key: 'allies-val', style: { fontSize: '42px', fontWeight: 'bold' } }, String(player.allies_elo || 1000))
                        ]),
                    ])
                ]
            );

            const svg = await satori(element, {
                width: 800,
                height: 400,
                fonts: [{ name: 'Roboto', data: fontData, weight: 700, style: 'normal' }]
            });

            const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 800 } });
            const pngData = resvg.render();
            const pngBuffer = pngData.asPng();

            // 3. Return Image as Attachment (using Multipart)
            // Hono doesn't handle Discord multipart responses easily out of the box for Workers.
            // We'll upload to R2 and return URL for simplicity first, or try constructing a multipart response.
            // Actually, uploading to R2 is cleaner for caching.

            const filename = `profile-${player.id}-${Date.now()}.png`;
            await c.env.IMAGES_BUCKET.put(`generated/${filename}`, pngBuffer);
            const imageUrl = `${c.env.FRONTEND_URL}/api/images/generated/${filename}`; // Assuming we have an image proxy or R2 access

            return c.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: `Profile for <@${targetUserId}>`,
                    embeds: [{
                        image: { url: imageUrl },
                        color: 0xf97316
                    }]
                }
            });
        }
    }

    return c.json({ error: 'Unknown interaction' }, 400);
});
