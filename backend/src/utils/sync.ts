
import { drizzle } from 'drizzle-orm/d1';

export interface Env {
    DB: D1Database;
    DISCORD_SERVER_ID: string;
    DISCORD_BOT_TOKEN?: string;
    MODERATOR_ROLE_ID?: string;
    ADMIN_SECRET?: string;
}

export async function syncDiscordMembers(env: Env) {
    const guildId = env.DISCORD_SERVER_ID;
    const botToken = env.DISCORD_BOT_TOKEN;

    if (!guildId || !botToken) {
        throw new Error('Missing Discord configuration');
    }

    let allMembers: any[] = [];
    let after = '0';
    let keepFetching = true;

    // Pagination to fetch all members (limit is 1000 per request)
    while (keepFetching) {
        console.log(`Sync: Fetching members after ${after}...`);
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
            throw new Error(`Failed to fetch members: ${errText}`);
        }

        const members = await response.json() as any[];
        if (members.length === 0) {
            keepFetching = false;
        } else {
            allMembers = allMembers.concat(members);
            after = members[members.length - 1].user.id;
            if (members.length < 1000) keepFetching = false;
        }
    }

    console.log(`Sync: Fetched ${allMembers.length} members total.`);

    // Insert into Database
    const stmt = env.DB.prepare(
        `INSERT INTO players (id, discord_id, discord_username, discord_avatar, is_discord_member, role, is_vip, vip_until, elo) 
         VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
         discord_username = excluded.discord_username,
         discord_avatar = excluded.discord_avatar,
         is_discord_member = 1,
         role = CASE WHEN excluded.role = 'admin' THEN 'admin' WHEN excluded.role = 'moderator' AND players.role != 'admin' THEN 'moderator' ELSE players.role END,
         is_vip = CASE WHEN excluded.is_vip = 1 THEN 1 ELSE players.is_vip END,
         vip_until = CASE 
            WHEN excluded.is_vip = 1 AND (players.vip_until IS NULL OR players.vip_until < datetime('now')) 
            THEN excluded.vip_until 
            ELSE players.vip_until 
         END,
         elo = CASE WHEN excluded.elo > players.elo THEN excluded.elo ELSE players.elo END`
    );

    const humans = allMembers.filter(m => !m.user.bot);

    // VIP Expiry (1 month from now)
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    const vipUntilDate = oneMonthFromNow.toISOString();

    let addedCount = 0;
    const BATCH_SIZE = 10;
    for (let i = 0; i < humans.length; i += BATCH_SIZE) {
        const chunk = humans.slice(i, i + BATCH_SIZE);
        const batch = chunk.map(m => {
            const roles = m.roles || [];

            // Admin: 1453054732141854751
            // VIP: 1454234806933258382
            const isAdmin = roles.includes('1453054732141854751');
            const isVip = roles.includes('1454234806933258382');

            const moderatorRoleId = env.MODERATOR_ROLE_ID;
            const isModerator = moderatorRoleId ? roles.includes(moderatorRoleId) : false;

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
                isAdmin ? 'admin' : (isModerator ? 'moderator' : 'user'),
                isVip ? 1 : 0,
                isVip ? vipUntilDate : null,
                tierElo
            );
        });
        await env.DB.batch(batch);
        addedCount += chunk.length;
    }

    return { totalFetched: allMembers.length, humansImported: addedCount };
}
