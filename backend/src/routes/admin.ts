
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
                `INSERT INTO players (id, discord_id, discord_username, discord_avatar, elo) 
                 VALUES (?, ?, ?, ?, 1000)
                 ON CONFLICT(id) DO UPDATE SET
                 discord_username = excluded.discord_username,
                 discord_avatar = excluded.discord_avatar`
            );

            // Using batch execution for performance would be better, but loop is safer for D1 limits initially
            // Let's filter out bots if desired. User said "users", usually means humans.
            // But let's verify: user said "all of my discord users". 
            // We will include humans only to keep leaderboard clean.

            const humans = allMembers.filter(m => !m.user.bot);

            // D1 Batch size limit is usually high but let's do batches of 10
            const BATCH_SIZE = 10;
            for (let i = 0; i < humans.length; i += BATCH_SIZE) {
                const chunk = humans.slice(i, i + BATCH_SIZE);
                const batch = chunk.map(m => stmt.bind(
                    m.user.id,
                    m.user.id,
                    m.user.username,
                    m.user.avatar
                ));
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
