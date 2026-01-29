
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { tournaments, tournamentParticipants, clans, clanMembers, players, matches, matchPlayers } from '../db/schema';
import { verifyAuth } from '../middleware/auth';

type Env = {
    DB: D1Database;
}

type Variables = {
    userId: string;
}

const app = new Hono<{ Bindings: Env, Variables: Variables }>();

// GET /api/tournaments - List tournaments
app.get('/', async (c) => {
    const db = drizzle(c.env.DB);
    try {
        const allTournaments = await db.select().from(tournaments)
            .orderBy(desc(tournaments.start_time))
            .all();

        return c.json({ success: true, tournaments: allTournaments });
    } catch (e) {
        return c.json({ success: false, error: 'Failed to fetch tournaments' }, 500);
    }
});

// GET /api/tournaments/:id - Get tournament details + Bracket
app.get('/:id', async (c) => {
    const tournamentId = c.req.param('id');
    const db = drizzle(c.env.DB);

    try {
        const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).get();
        if (!tournament) return c.json({ error: 'Tournament not found' }, 404);

        // Get participants
        const participants = await db.select({
            id: tournamentParticipants.id,
            clan_id: tournamentParticipants.clan_id,
            name: clans.name,
            tag: clans.tag,
            logo_url: clans.logo_url,
            seed: tournamentParticipants.seed,
            status: tournamentParticipants.status,
            registered_at: tournamentParticipants.registered_at
        })
            .from(tournamentParticipants)
            .innerJoin(clans, eq(tournamentParticipants.clan_id, clans.id))
            .where(eq(tournamentParticipants.tournament_id, tournamentId))
            .orderBy(asc(tournamentParticipants.registered_at))
            .all();

        // Get Bracket Matches
        const bracketMatches = await db.select({
            id: matches.id,
            round: matches.tournament_round,
            bracket_match_id: matches.bracket_match_id,
            next_match_id: matches.next_match_id,
            status: matches.status,
            winner_team: matches.winner_team,
            alpha_score: matches.alpha_score,
            bravo_score: matches.bravo_score,
            alpha_clan_id: matches.alpha_clan_id, // Manual override
            bravo_clan_id: matches.bravo_clan_id, // Manual override
            start_time: matches.created_at, // Using created_at as proxy for now
            // Get Clan Info for Teams
            // This is complex in a single query with our match_players structure.
            // Simplified: We will fetch matches, then fetch the clans for each match separately or assume frontend resolves it if we return match_players
        }).from(matches)
            .where(eq(matches.tournament_id, tournamentId))
            .orderBy(asc(matches.tournament_round), asc(matches.bracket_match_id))
            .all();

        // Hydrate matches with clan info
        // We need to know which clan is Alpha/Bravo for each match
        const hydratedMatches = await Promise.all(bracketMatches.map(async (m) => {
            let alphaClanInfo = null;
            let bravoClanInfo = null;

            // 1. Try manual override IDs (Direct lookup)
            if (m.alpha_clan_id) {
                const c = await db.select().from(clans).where(eq(clans.id, m.alpha_clan_id)).get();
                if (c) alphaClanInfo = { id: c.id, name: c.name, tag: c.tag, logo: c.logo_url };
            }
            if (m.bravo_clan_id) {
                const c = await db.select().from(clans).where(eq(clans.id, m.bravo_clan_id)).get();
                if (c) bravoClanInfo = { id: c.id, name: c.name, tag: c.tag, logo: c.logo_url };
            }

            // 2. Fallback to match_players if not found (Legacy/Auto)
            if (!alphaClanInfo || !bravoClanInfo) {
                const participants = await db.select({
                    team: matchPlayers.team,
                    clan_id: clanMembers.clan_id,
                    clan_name: clans.name,
                    clan_tag: clans.tag,
                    clan_logo: clans.logo_url
                })
                    .from(matchPlayers)
                    .innerJoin(clanMembers, eq(matchPlayers.player_id, clanMembers.user_id))
                    .innerJoin(clans, eq(clanMembers.clan_id, clans.id))
                    .where(eq(matchPlayers.match_id, m.id))
                    .groupBy(matchPlayers.team) // Distinct by team
                    .all();

                const alpha = participants.find(p => p.team === 'alpha');
                const bravo = participants.find(p => p.team === 'bravo');

                if (!alphaClanInfo && alpha) alphaClanInfo = { id: alpha.clan_id, name: alpha.clan_name, tag: alpha.clan_tag, logo: alpha.clan_logo };
                if (!bravoClanInfo && bravo) bravoClanInfo = { id: bravo.clan_id, name: bravo.clan_name, tag: bravo.clan_tag, logo: bravo.clan_logo };
            }

            return {
                ...m,
                alpha_clan: alphaClanInfo,
                bravo_clan: bravoClanInfo,
            };
        }));

        return c.json({
            success: true,
            tournament,
            participants,
            bracket: hydratedMatches
        });

    } catch (e) {
        console.error(e);
        return c.json({ error: 'Server error' }, 500);
    }
});

// POST /api/tournaments/:id/register - Register Clan
app.post('/:id/register', verifyAuth, async (c) => {
    const tournamentId = c.req.param('id');
    const userId = c.get('userId');
    const db = drizzle(c.env.DB);

    try {
        const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).get();
        if (!tournament) return c.json({ error: 'Tournament not found' }, 404);
        if (tournament.status !== 'registration') return c.json({ error: 'Registration is closed' }, 400);

        // Check if user is clan leader
        const clanMember = await db.select().from(clanMembers)
            .where(and(eq(clanMembers.user_id, userId), eq(clanMembers.role, 'leader')))
            .get();

        if (!clanMember) return c.json({ error: 'Only clan leaders can register' }, 403);

        const clanId = clanMember.clan_id;

        // Check already registered
        const existing = await db.select().from(tournamentParticipants)
            .where(and(eq(tournamentParticipants.tournament_id, tournamentId), eq(tournamentParticipants.clan_id, clanId)))
            .get();

        if (existing) return c.json({ error: 'Clan already registered' }, 400);

        // Check Capacity
        const currentCount = await db.select({ count: sql<number>`count(*)` })
            .from(tournamentParticipants)
            .where(eq(tournamentParticipants.tournament_id, tournamentId))
            .get();

        if ((currentCount?.count || 0) >= tournament.max_teams) {
            return c.json({ error: 'Tournament is full' }, 400);
        }

        // VIP CHECK: "clan members should have vip"
        // We will check if the LEADER + at least 4 other members (total 5) have VIP?
        // Or should we just check if the clan has enough VIP members to field a team?
        // Let's ensure at least 5 members in the clan have VIP status.

        const vipMembers = await db.select({ count: sql<number>`count(*)` })
            .from(clanMembers)
            .innerJoin(players, eq(clanMembers.user_id, players.id))
            .where(and(
                eq(clanMembers.clan_id, clanId),
                eq(players.is_vip, 1) // 1 = true
            ))
            .get();

        const vipCount = vipMembers?.count || 0;
        if (vipCount < 5) {
            return c.json({
                error: `Your clan needs at least 5 VIP members to participate. Currently: ${vipCount}`
            }, 400);
        }

        // Register
        await db.insert(tournamentParticipants).values({
            tournament_id: tournamentId,
            clan_id: clanId,
            status: 'registered'
        }).execute();

        return c.json({ success: true, message: 'Clan registered successfully' });

    } catch (e: any) {
        console.error("Tournament registration error:", e);
        return c.json({ error: 'Failed to register' }, 500);
    }
});

export const tournamentRoutes = app;
