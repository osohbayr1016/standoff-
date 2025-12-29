
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { players } from '../db/schema';
import { syncDiscordMembers } from '../utils/sync';


export function setupAdminRoutes(app: Hono<any>) {
    app.post('/api/admin/import-users', async (c) => {
        // Simple security check
        const secret = c.req.header('x-admin-secret') || c.req.query('secret');
        // In production, this should be a strong environment variable
        // For now, we'll use a verifiable known secret or check against an env var if it exists
        const EXPECTED_SECRET = c.env.ADMIN_SECRET || 'admin-secret-123';

        if (secret !== EXPECTED_SECRET) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        const guildId = c.env.DISCORD_SERVER_ID;
        const botToken = c.env.DISCORD_BOT_TOKEN;

        if (!guildId || !botToken) {
            return c.json({ error: 'Missing Discord configuration' }, 500);
        }

        try {
            const result = await syncDiscordMembers(c.env);

            return c.json({
                success: true,
                totalFetched: result.totalFetched,
                humansImported: result.humansImported,
                message: `Successfully imported/updated ${result.humansImported} users.`
            });

        } catch (error: any) {
            console.error('Import error:', error);
            return c.json({ error: error.message }, 500);
        }

    });

    // POST /api/admin/sync-member - Sync a single Discord member (for automatic sync on join)
    app.post('/api/admin/sync-member', async (c) => {
        // Simple security check
        const secret = c.req.header('x-admin-secret') || c.req.query('secret');
        const EXPECTED_SECRET = c.env.ADMIN_SECRET || 'admin-secret-123';

        if (secret !== EXPECTED_SECRET) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        try {
            const body = await c.req.json<{
                userId: string;
                username: string;
                avatar?: string;
            }>();

            if (!body.userId || !body.username) {
                return c.json({ error: 'Missing required fields: userId, username' }, 400);
            }

            const guildId = c.env.DISCORD_SERVER_ID;
            const botToken = c.env.DISCORD_BOT_TOKEN;

            if (!guildId || !botToken) {
                return c.json({ error: 'Missing Discord configuration' }, 500);
            }

            // Fetch member details from Discord to get roles
            const response = await fetch(
                `https://discord.com/api/v10/guilds/${guildId}/members/${body.userId}`,
                {
                    headers: {
                        'Authorization': `Bot ${botToken}`
                    }
                }
            );

            if (!response.ok) {
                // Member might not be in the server yet, create basic record
                console.log(`Member ${body.userId} not found in guild, creating basic record`);
                await c.env.DB.prepare(
                    `INSERT INTO players (id, discord_id, discord_username, discord_avatar, is_discord_member, role, elo) 
                     VALUES (?, ?, ?, ?, 1, 'user', 1000)
                     ON CONFLICT(id) DO UPDATE SET
                     discord_username = excluded.discord_username,
                     discord_avatar = excluded.discord_avatar,
                     is_discord_member = 1`
                ).bind(
                    body.userId,
                    body.userId,
                    body.username,
                    body.avatar || null
                ).run();

                return c.json({
                    success: true,
                    message: `Created basic record for ${body.username}`
                });
            }

            const memberData = await response.json() as any;
            const roles = memberData.roles || [];

            // Check roles
            const isAdmin = roles.includes('1453054732141854751');
            const isVip = roles.includes('1454234806933258382');
            const isModerator = c.env.MODERATOR_ROLE_ID && roles.includes(c.env.MODERATOR_ROLE_ID);

            // Determine role
            let roleToSet = 'user';
            if (isAdmin) {
                roleToSet = 'admin';
            } else if (isModerator) {
                roleToSet = 'moderator';
            }

            // Tier ELO
            let tierElo = 1000;
            if (roles.includes('1454095406446153839')) {
                tierElo = 1600;
            } else if (roles.includes('1454150874531234065')) {
                tierElo = 1200;
            } else if (roles.includes('1454150924556570624')) {
                tierElo = 1000;
            }

            // VIP expiry
            const oneMonthFromNow = new Date();
            oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
            const vipUntilDate = oneMonthFromNow.toISOString();

            // Insert/update in database
            await c.env.DB.prepare(
                `INSERT INTO players (id, discord_id, discord_username, discord_avatar, is_discord_member, role, is_vip, vip_until, elo) 
                 VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                 discord_username = excluded.discord_username,
                 discord_avatar = excluded.discord_avatar,
                 is_discord_member = 1,
                 role = excluded.role,
                 is_vip = CASE WHEN excluded.is_vip = 1 THEN 1 ELSE players.is_vip END,
                 vip_until = CASE WHEN excluded.is_vip = 1 THEN excluded.vip_until ELSE players.vip_until END,
                 elo = CASE WHEN excluded.elo > players.elo THEN excluded.elo ELSE players.elo END`
            ).bind(
                body.userId,
                body.userId,
                body.username,
                body.avatar || null,
                roleToSet,
                isVip ? 1 : 0,
                isVip ? vipUntilDate : null,
                tierElo
            ).run();

            console.log(`✅ Synced member ${body.username} (${body.userId}) with role: ${roleToSet}`);

            return c.json({
                success: true,
                message: `Successfully synced ${body.username}`,
                role: roleToSet,
                elo: tierElo
            });

        } catch (error: any) {
            console.error('Sync member error:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
