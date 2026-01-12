
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, or, and, ne, like, desc } from 'drizzle-orm';
import { players, friendships } from '../db/schema';
import { alias } from 'drizzle-orm/sqlite-core';

export function setupFriendsRoutes(app: Hono<any>) {
    // Search users by nickname or username
    // Excludes current user
    app.get('/api/users/search', async (c) => {
        const query = c.req.query('q');
        const currentUserId = c.req.query('userId');

        if (!query || query.length < 3) {
            return c.json([]);
        }

        try {
            const db = drizzle(c.env.DB);

            const results = await db.select({
                id: players.id,
                username: players.discord_username,
                nickname: players.standoff_nickname,
                avatar: players.discord_avatar,
                elo: players.elo,
                wins: players.wins,
                losses: players.losses,
                is_discord_member: players.is_discord_member
            })
                .from(players)
                .where(
                    and(
                        or(
                            like(players.standoff_nickname, `%${query}%`),
                            like(players.discord_username, `%${query}%`)
                        ),
                        ne(players.id, currentUserId || '')
                    )
                )
                .limit(10)
                .all();

            return c.json(results);
        } catch (error) {
            console.error('Search error:', error);
            return c.json({ error: 'Search failed' }, 500);
        }
    });

    // Send Friend Request
    app.post('/api/friends/request', async (c) => {
        const { userId, targetId } = await c.req.json();

        if (!userId || !targetId || userId === targetId) {
            return c.json({ error: 'Invalid request' }, 400);
        }

        try {
            const db = drizzle(c.env.DB);

            // Check if already friends or pending
            const existing = await db.select()
                .from(friendships)
                .where(
                    or(
                        and(eq(friendships.user_id1, userId), eq(friendships.user_id2, targetId)),
                        and(eq(friendships.user_id1, targetId), eq(friendships.user_id2, userId))
                    )
                )
                .get();

            if (existing) {
                return c.json({ error: 'Request already exists or already friends' }, 400);
            }

            // Create request
            await db.insert(friendships).values({
                user_id1: userId,
                user_id2: targetId,
                status: 'pending'
            }).run();

            return c.json({ success: true });
        } catch (error) {
            console.error('Friend request error:', error);
            return c.json({ error: 'Failed to send request' }, 500);
        }
    });

    // Accept Friend Request
    app.put('/api/friends/accept', async (c) => {
        const { requestId } = await c.req.json();

        try {
            const db = drizzle(c.env.DB);

            await db.update(friendships)
                .set({ status: 'accepted' })
                .where(eq(friendships.id, requestId))
                .run();

            return c.json({ success: true });
        } catch (error) {
            return c.json({ error: 'Failed to accept' }, 500);
        }
    });

    // Remove Friend or Decline Request
    app.delete('/api/friends/:id', async (c) => {
        const id = c.req.param('id');
        try {
            const db = drizzle(c.env.DB);
            await db.delete(friendships).where(eq(friendships.id, parseInt(id))).run();
            return c.json({ success: true });
        } catch (error) {
            return c.json({ error: 'Failed to remove' }, 500);
        }
    });

    // List Friends
    app.get('/api/friends/:userId', async (c) => {
        const userId = c.req.param('userId');
        try {
            const db = drizzle(c.env.DB);

            // Fetch all relationships involving userId
            const userFriends = await db.select({
                friendship_id: friendships.id,
                status: friendships.status,
                requester_id: friendships.user_id1,
                friend: {
                    id: players.id,
                    username: players.discord_username,
                    nickname: players.standoff_nickname,
                    avatar: players.discord_avatar,
                    elo: players.elo,
                    is_discord_member: players.is_discord_member
                }
            })
                .from(friendships)
                .leftJoin(players,
                    or(
                        and(eq(friendships.user_id1, userId), eq(players.id, friendships.user_id2)),
                        and(eq(friendships.user_id2, userId), eq(players.id, friendships.user_id1))
                    )
                )
                .where(
                    or(eq(friendships.user_id1, userId), eq(friendships.user_id2, userId))
                )
                .all();

            // Transform for frontend
            const friends = userFriends
                .filter(f => f.status === 'accepted')
                .map(f => ({ ...f.friend, friendship_id: f.friendship_id }));

            const pendingIncoming = userFriends
                .filter(f => f.status === 'pending' && f.requester_id !== userId)
                .map(f => ({ ...f.friend, friendship_id: f.friendship_id }));

            const pendingOutgoing = userFriends
                .filter(f => f.status === 'pending' && f.requester_id === userId)
                .map(f => ({ ...f.friend, friendship_id: f.friendship_id }));

            // Check online status for all friends via Durable Object
            let onlineStatus: Record<string, boolean> = {};
            if (friends.length > 0) {
                try {
                    const friendIds = friends.map(f => f.id).filter(Boolean);
                    if (friendIds.length > 0) {
                        const id = c.env.MATCH_QUEUE.idFromName('global-matchmaking-v2');
                        const obj = c.env.MATCH_QUEUE.get(id);

                        const doUrl = new URL(c.req.raw.url);
                        doUrl.pathname = '/check-online';
                        const doRequest = new Request(doUrl.toString(), {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userIds: friendIds })
                        });

                        const onlineRes = await obj.fetch(doRequest);
                        if (onlineRes.ok) {
                            const onlineData = await onlineRes.json();
                            onlineStatus = onlineData.onlineStatus || {};
                        }
                    }
                } catch (err) {
                    console.error('Failed to fetch online status:', err);
                }
            }

            // Add online status to friends
            const friendsWithStatus = friends.map(f => ({
                ...f,
                is_online: (f.id && onlineStatus[f.id]) || false
            }));

            return c.json({
                friends: friendsWithStatus,
                pendingIncoming,
                pendingOutgoing
            });

        } catch (error) {
            console.error('Fetch friends error:', error);
            return c.json({ error: 'Failed to fetch friends' }, 500);
        }
    });
}
