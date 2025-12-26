
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { players } from '../db/schema';

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
            const db = drizzle(c.env.DB);
            let allMembers: any[] = [];
            let after = '0';
            let keepFetching = true;

            // Pagination to fetch all members (limit is 1000 per request)
            while (keepFetching) {
                console.log(`Fetching members after ${after}...`);
                const response = await fetch(
                    `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`,
                    {
                        headers: {
                            'Authorization': `Bot ${botToken}`
                        }
                    }
                );

                if (!response.ok) {
                    const errText = await response.text();
                    console.error('Discord API Error:', errText);
                    return c.json({ error: `Failed to fetch members: ${errText}` }, response.status as any);
                }

                const members = await response.json() as any[];
                if (members.length === 0) {
                    keepFetching = false;
                } else {
                    allMembers = allMembers.concat(members);
                    after = members[members.length - 1].user.id;
                    // If we got less than 1000, we reached the end
                    if (members.length < 1000) keepFetching = false;
                }
            }

            console.log(`Fetched ${allMembers.length} members total.`);

            // Insert into Database
            let addedCount = 0;
            const stmt = c.env.DB.prepare(
                `INSERT INTO players (id, discord_id, discord_username, discord_avatar, is_discord_member, role, is_vip, vip_until, elo) 
                 VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                 discord_username = excluded.discord_username,
                 discord_avatar = excluded.discord_avatar,
                 is_discord_member = 1,
                 role = CASE WHEN excluded.role = 'admin' THEN 'admin' ELSE players.role END,
                 is_vip = CASE WHEN excluded.is_vip = 1 THEN 1 ELSE players.is_vip END,
                 vip_until = CASE WHEN excluded.is_vip = 1 THEN excluded.vip_until ELSE players.vip_until END,
                 elo = CASE WHEN excluded.elo > players.elo THEN excluded.elo ELSE players.elo END`
            );

            const humans = allMembers.filter(m => !m.user.bot);

            // VIP Expiry (1 month from now)
            const oneMonthFromNow = new Date();
            oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
            const vipUntilDate = oneMonthFromNow.toISOString();

            // D1 Batch size limit
            const BATCH_SIZE = 10;
            for (let i = 0; i < humans.length; i += BATCH_SIZE) {
                const chunk = humans.slice(i, i + BATCH_SIZE);
                const batch = chunk.map(m => {
                    const roles = m.roles || [];

                    // Admin: 1453054732141854751
                    // VIP: 1454234806933258382
                    const isAdmin = roles.includes('1453054732141854751');
                    const isVip = roles.includes('1454234806933258382');

                    // Tier Role IDs:
                    // Gold: 1454095406446153839 (1600 ELO)
                    // Silver: 1454150874531234065 (1200 ELO)
                    // Bronze: 1454150924556570624 (1000 ELO)
                    let tierElo = 1000;
                    if (roles.includes('1454095406446153839')) {
                        tierElo = 1600;
                    } else if (roles.includes('1454150874531234065')) {
                        tierElo = 1200;
                    } else if (roles.includes('1454150924556570624')) {
                        tierElo = 1000;
                    }

                    return stmt.bind(
                        m.user.id,
                        m.user.id,
                        m.user.username,
                        m.user.avatar,
                        isAdmin ? 'admin' : 'user',
                        isVip ? 1 : 0,
                        isVip ? vipUntilDate : null,
                        tierElo
                    );
                });
                await c.env.DB.batch(batch);
                addedCount += chunk.length;
            }

            return c.json({
                success: true,
                totalFetched: allMembers.length,
                humansImported: addedCount,
                message: `Successfully imported/updated ${addedCount} users.`
            });

        } catch (error: any) {
            console.error('Import error:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
