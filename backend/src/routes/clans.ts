
import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { players, clans, clanMembers } from '../db/schema';
import { verifyAuth } from '../middleware/auth';

type Env = {
    DB: D1Database;
}

type Variables = {
    userId: string;
}

const app = new Hono<{ Bindings: Env, Variables: Variables }>();

const COST_20 = 20000;
const COST_50 = 50000;

// Get My Balance
app.get('/balance', verifyAuth, async (c) => {
    const userId = c.get('userId');
    const db = drizzle(c.env.DB);
    const player = await db.select().from(players).where(eq(players.id, userId)).get();
    return c.json({ balance: player?.balance || 0 });
});

// GET /api/clans - List Top Clans (Public)
app.get('/', async (c) => {
    try {
        const db = drizzle(c.env.DB);
        const result = await c.env.DB.prepare(`
            SELECT 
                c.id, c.name, c.tag, c.logo_url, c.elo, c.max_members,
                (SELECT COUNT(*) FROM clan_members WHERE clan_id = c.id) as member_count
            FROM clans c
            ORDER BY c.elo DESC
            LIMIT 50
        `).all();

        return c.json({ clans: result.results || [] });
    } catch (e) {
        return c.json({ error: 'Failed to fetch clans' }, 500);
    }
});

// Create Clan
app.post('/create', verifyAuth, async (c) => {
    const userId = c.get('userId');
    const db = drizzle(c.env.DB);
    const { name, tag, size } = await c.req.json<{ name: string; tag: string; size: number }>();

    if (!name || !tag || !size) return c.json({ error: 'Missing fields' }, 400);
    if (![20, 50].includes(size)) return c.json({ error: 'Invalid size (20 or 50)' }, 400);

    const cost = size === 20 ? COST_20 : COST_50;

    // Transaction? D1 doesn't support full transactions easily in all modes, but we can try batch or sequential checks.
    // Sequential is safer for logic here.

    try {
        // 1. Check user clan status
        const existingMember = await db.select().from(clanMembers).where(eq(clanMembers.user_id, userId)).get();
        if (existingMember) return c.json({ error: 'You are already in a clan' }, 400);

        // 2. Check balance
        // 2. Check balance & VIP Status
        const player = await db.select().from(players).where(eq(players.id, userId)).get();
        if (!player) return c.json({ error: 'User not found' }, 404);

        if (!player.is_vip) {
            return c.json({ error: 'Clan creation is restricted to VIP members only.' }, 403);
        }

        if (player.balance < cost) {
            return c.json({ error: `Insufficient funds. You need ${cost} MNT.` }, 400);
        }

        // 3. Create Clan (Atomic-ish)
        // We deduct balance AND create clan.

        await db.update(players)
            .set({ balance: sql`${players.balance} - ${cost}` })
            .where(eq(players.id, userId))
            .execute();

        const clanId = crypto.randomUUID();

        await db.insert(clans).values({
            id: clanId,
            name: name,
            tag: tag,
            leader_id: userId,
            max_members: size,
            created_at: new Date().toISOString()
        }).execute();

        await db.insert(clanMembers).values({
            clan_id: clanId,
            user_id: userId,
            role: 'leader',
            joined_at: new Date().toISOString()
        }).execute();

        return c.json({ success: true, clanId });

    } catch (e: any) {
        console.error("Clan creation error:", e);
        if (e.message?.includes('UNIQUE')) {
            return c.json({ error: 'Clan name already taken' }, 400);
        }
        return c.json({ error: 'Failed to create clan' }, 500);
    }
});

// Get My Clan
app.get('/my-clan', verifyAuth, async (c) => {
    const userId = c.get('userId');
    const db = drizzle(c.env.DB);

    try {
        const membership = await db.select().from(clanMembers).where(eq(clanMembers.user_id, userId)).get();
        if (!membership) return c.json(null);

        const clan = await db.select().from(clans).where(eq(clans.id, membership.clan_id)).get();
        if (!clan) return c.json(null);

        // Get members count
        const members = await db.select({
            id: players.id,
            username: players.discord_username,
            avatar: players.discord_avatar,
            role: clanMembers.role,
            elo: players.elo
        })
            .from(clanMembers)
            .innerJoin(players, eq(clanMembers.user_id, players.id))
            .where(eq(clanMembers.clan_id, clan.id))
            .all();

        return c.json({ ...clan, members, myRole: membership.role });
    } catch (error) {
        return c.json({ error: 'Server error' }, 500);
    }
});

// Add Member (By ID/Code - Simplified to directly add by UserID for now as requested "add people")
app.post('/members/add', verifyAuth, async (c) => {
    const userId = c.get('userId');
    const db = drizzle(c.env.DB);
    const { targetUserId } = await c.req.json<{ targetUserId: string }>();

    // Check permissions
    const membership = await db.select().from(clanMembers).where(eq(clanMembers.user_id, userId)).get();
    if (!membership || !['leader', 'coleader'].includes(membership.role || '')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    // Check clan capacity
    const clan = await db.select().from(clans).where(eq(clans.id, membership.clan_id)).get();
    if (!clan) return c.json({ error: 'Clan not found' }, 404);

    const memberCount = await db.select({ count: sql<number>`count(*)` })
        .from(clanMembers)
        .where(eq(clanMembers.clan_id, clan.id))
        .get();

    if ((memberCount?.count || 0) >= clan.max_members) {
        return c.json({ error: 'Clan is full' }, 400);
    }

    // Lookup player first (Handle ID, Discord ID, or Nickname)
    // Lookup player first (Handle ID, Discord ID, or Nickname)
    // using raw SQL for reliable OR condition with D1
    const playerToAdd = await c.env.DB.prepare(
        'SELECT id, is_vip FROM players WHERE id = ? OR discord_id = ? OR standoff_nickname = ?'
    ).bind(targetUserId, targetUserId, targetUserId).first();

    if (!playerToAdd) {
        return c.json({ error: 'Player not found. Please check User ID, Discord ID, or Standoff Nickname.' }, 404);
    }

    if (!playerToAdd.is_vip) {
        return c.json({ error: 'This user is not a VIP. Only VIP members can join clans.' }, 400);
    }

    const realUserId = playerToAdd.id as string;

    // Add user
    try {
        // Check if user is in a clan
        const targetMember = await db.select().from(clanMembers).where(eq(clanMembers.user_id, realUserId)).get();
        if (targetMember) return c.json({ error: 'User is already in a clan' }, 400);

        await db.insert(clanMembers).values({
            clan_id: clan.id,
            user_id: realUserId,
            role: 'member',
            joined_at: new Date().toISOString()
        }).execute();

        return c.json({ success: true, addedId: realUserId });
    } catch (e) {
        return c.json({ error: 'Failed to add member' }, 500);
    }
});

// Leave / Kick
app.post('/members/kick', verifyAuth, async (c) => {
    const userId = c.get('userId');
    const db = drizzle(c.env.DB);
    const { targetUserId } = await c.req.json<{ targetUserId: string }>();

    const membership = await db.select().from(clanMembers).where(eq(clanMembers.user_id, userId)).get();
    if (!membership || membership.role !== 'leader') { // Only leader can kick for now
        return c.json({ error: 'Unauthorized' }, 403);
    }

    if (userId === targetUserId) return c.json({ error: 'Cannot kick yourself' }, 400);

    try {
        await db.delete(clanMembers)
            .where(and(
                eq(clanMembers.clan_id, membership.clan_id),
                eq(clanMembers.user_id, targetUserId)
            ))
            .execute();

        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: 'Failed to kick' }, 500);
    }
});

// Get Clan Profile (Public or Member-only)
app.get('/:id/profile', async (c) => {
    const clanId = c.req.param('id');
    const db = drizzle(c.env.DB);

    try {
        // Get clan basic info
        const clan = await db.select().from(clans).where(eq(clans.id, clanId)).get();
        if (!clan) return c.json({ error: 'Clan not found' }, 404);

        // Get leader info
        const leader = await db.select({
            id: players.id,
            username: players.discord_username,
            avatar: players.discord_avatar
        }).from(players).where(eq(players.id, clan.leader_id)).get();

        // Get all members with their stats
        const members = await c.env.DB.prepare(`
            SELECT 
                p.id,
                p.discord_username,
                p.discord_avatar,
                p.standoff_nickname,
                p.elo,
                p.wins,
                p.losses,
                cm.role,
                cm.joined_at
            FROM clan_members cm
            INNER JOIN players p ON cm.user_id = p.id
            WHERE cm.clan_id = ?
            ORDER BY 
                CASE cm.role 
                    WHEN 'leader' THEN 1 
                    WHEN 'coleader' THEN 2 
                    ELSE 3 
                END,
                p.elo DESC
        `).bind(clanId).all();

        // Calculate clan statistics
        const membersList = members.results || [];
        const totalWins = membersList.reduce((sum: number, m: any) => sum + (m.wins || 0), 0);
        const totalLosses = membersList.reduce((sum: number, m: any) => sum + (m.losses || 0), 0);
        const totalMatches = totalWins + totalLosses;
        const winRate = totalMatches > 0 ? ((totalWins / totalMatches) * 100).toFixed(1) : '0.0';

        // Calculate average Elo only from members who have played matches (Elo != 1000)
        const membersWithElo = membersList.filter((m: any) => m.elo && m.elo !== 1000);
        const avgElo = membersWithElo.length > 0
            ? Math.round(membersWithElo.reduce((sum: number, m: any) => sum + m.elo, 0) / membersWithElo.length)
            : 1000;

        // Get recent clan match history
        const matchHistory = await c.env.DB.prepare(`
            SELECT 
                m.id,
                m.match_type,
                m.status,
                m.winner_team,
                m.alpha_score,
                m.bravo_score,
                m.map_name,
                m.created_at,
                m.updated_at
            FROM matches m
            WHERE m.match_type = 'clan_match' 
            AND m.id IN (
                SELECT DISTINCT match_id 
                FROM match_players 
                WHERE player_id IN (
                    SELECT user_id FROM clan_members WHERE clan_id = ?
                )
            )
            AND m.status IN ('completed', 'pending_review')
            ORDER BY m.created_at DESC
            LIMIT 10
        `).bind(clanId).all();

        return c.json({
            success: true,
            clan: {
                ...clan,
                leader: leader || null,
                memberCount: membersList.length,
                stats: {
                    totalMatches,
                    wins: totalWins,
                    losses: totalLosses,
                    winRate: parseFloat(winRate),
                    avgElo
                }
            },
            members: membersList,
            recentMatches: matchHistory.results || []
        });

    } catch (error: any) {
        console.error('Error fetching clan profile:', error);
        return c.json({ error: 'Server error' }, 500);
    }
});

// Update Clan (Leader only)
app.post('/update', verifyAuth, async (c) => {
    const userId = c.get('userId');
    const db = drizzle(c.env.DB);
    const { name, tag, logo_url } = await c.req.json<{ name: string; tag: string; logo_url?: string }>();

    try {
        // Check if user is leader
        const member = await db.select().from(clanMembers)
            .where(and(eq(clanMembers.user_id, userId), eq(clanMembers.role, 'leader')))
            .get();

        if (!member) {
            return c.json({ error: 'Only the clan leader can update settings' }, 403);
        }

        await db.update(clans)
            .set({
                name,
                tag,
                logo_url: logo_url || null
            })
            .where(eq(clans.id, member.clan_id))
            .execute();

        return c.json({ success: true });
    } catch (e: any) {
        console.error('Update clan error:', e);
        return c.json({ error: 'Failed to update clan' }, 500);
    }
});

export const clanRoutes = app;
