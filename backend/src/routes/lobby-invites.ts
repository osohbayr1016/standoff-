import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, or } from 'drizzle-orm';
import { matches, matchPlayers, players, friendships } from '../db/schema';

interface Env {
    DB: D1Database;
    DISCORD_BOT_TOKEN: string;
    FRONTEND_URL?: string;
}

const lobbyInviteRoutes = new Hono<{ Bindings: Env }>();

// POST /api/matches/:matchId/invite - Send invitation to a friend
lobbyInviteRoutes.post('/:matchId/invite', async (c) => {
    const matchId = c.req.param('matchId');
    const { friend_id } = await c.req.json<{ friend_id: string }>();
    const senderId = c.req.header('X-User-Id');

    if (!senderId) {
        return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    try {
        // 1. Verify match exists and is in waiting status
        const match = await c.env.DB.prepare(
            'SELECT * FROM matches WHERE id = ? AND status = ?'
        ).bind(matchId, 'waiting').first();

        if (!match) {
            return c.json({ success: false, error: 'Match not found or already started' }, 404);
        }

        // 2. Verify sender is in the match
        const senderInMatch = await c.env.DB.prepare(
            'SELECT * FROM match_players WHERE match_id = ? AND player_id = ?'
        ).bind(matchId, senderId).first();

        if (!senderInMatch) {
            return c.json({ success: false, error: 'You must be in the match to invite friends' }, 403);
        }

        // 3. Verify they are friends
        const friendship = await c.env.DB.prepare(`
            SELECT * FROM friendships 
            WHERE status = 'accepted' 
            AND ((user_id1 = ? AND user_id2 = ?) OR (user_id1 = ? AND user_id2 = ?))
        `).bind(senderId, friend_id, friend_id, senderId).first();

        if (!friendship) {
            return c.json({ success: false, error: 'You can only invite friends' }, 403);
        }

        // 4. Check if friend is already in the match
        const friendInMatch = await c.env.DB.prepare(
            'SELECT * FROM match_players WHERE match_id = ? AND player_id = ?'
        ).bind(matchId, friend_id).first();

        if (friendInMatch) {
            return c.json({ success: false, error: 'Friend is already in this match' }, 400);
        }

        // 5. Get friend details for Discord notification
        const friend = await c.env.DB.prepare(
            'SELECT * FROM players WHERE id = ?'
        ).bind(friend_id).first();

        const sender = await c.env.DB.prepare(
            'SELECT * FROM players WHERE id = ?'
        ).bind(senderId).first();

        if (!friend || !sender) {
            return c.json({ success: false, error: 'User not found' }, 404);
        }

        // 6. Send Discord DM notification
        try {
            if (!c.env.DISCORD_BOT_TOKEN) {
                console.error('DISCORD_BOT_TOKEN not configured');
                return c.json({
                    success: true,
                    message: 'Invitation sent successfully (Discord notification disabled - bot token not configured)'
                });
            }

            const lobbyUrl = `${c.env.FRONTEND_URL || 'https://main.standoff-frontend.pages.dev'}/matchmaking?join=${matchId}`;
            const message = {
                content: `🎮 **Lobby Invitation**\n\n**${sender.discord_username}** invited you to join their lobby!\n\n📍 Map: ${match.map_name || 'Random'}\n👥 Players: ${match.player_count}/${match.max_players}\n\n[Click here to join the lobby](${lobbyUrl})`,
            };

            console.log('Attempting to send Discord DM to:', friend.discord_id);

            // Send DM via Discord API
            const dmChannel = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bot ${c.env.DISCORD_BOT_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    recipient_id: friend.discord_id
                })
            });

            if (!dmChannel.ok) {
                const errorData = await dmChannel.text();
                console.error('Failed to create DM channel:', dmChannel.status, errorData);
            } else {
                const channel: any = await dmChannel.json();
                console.log('DM channel created:', channel.id);

                const sendMessage = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bot ${c.env.DISCORD_BOT_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(message)
                });

                if (!sendMessage.ok) {
                    const errorData = await sendMessage.text();
                    console.error('Failed to send message:', sendMessage.status, errorData);
                } else {
                    console.log('Discord DM sent successfully');
                }
            }
        } catch (discordError) {
            console.error('Failed to send Discord notification:', discordError);
            // Don't fail the request if Discord notification fails
        }

        return c.json({
            success: true,
            message: 'Invitation sent successfully'
        });
    } catch (error: any) {
        console.error('Error sending invitation:', error);
        return c.json({ success: false, error: error.message }, 500);
    }
});

export { lobbyInviteRoutes };
