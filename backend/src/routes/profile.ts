
import { Hono } from 'hono';
import { nicknameSchema, updateProfileSchema } from '../schemas/profile';

export function setupProfileRoutes(app: Hono<any>) {
    // GET /api/profile/:userId - Get user profile
    app.get('/api/profile/:userId', async (c) => {
        try {
            const userId = c.req.param('userId');

            // Use raw SQL for simplicity and robustness
            const user = await c.env.DB.prepare(
                'SELECT * FROM players WHERE id = ? OR discord_id = ?'
            ).bind(userId, userId).first();

            if (!user) {
                return c.json({ error: 'User not found' }, 404);
            }

            // Compute URLs for Discord Assets (handling Global vs Guild Profiles)
            const getExtension = (hash: string) => hash.startsWith('a_') ? 'gif' : 'png';
            const serverId = c.env.DISCORD_SERVER_ID;
            const isVip = user.is_vip === 1;

            const bannerHash = user.discord_banner as string | null;
            let bannerUrl: string | null = null;

            // PRIORITY: Custom Banner (VIP Only) > Server Banner > Global Banner
            if (isVip && user.custom_banner) {
                bannerUrl = user.custom_banner as string;
            } else if (bannerHash) {
                if (user.is_guild_banner && serverId) {
                    bannerUrl = `https://cdn.discordapp.com/guilds/${serverId}/users/${user.discord_id}/banners/${bannerHash}.${getExtension(bannerHash)}?size=2048`;
                } else {
                    bannerUrl = `https://cdn.discordapp.com/banners/${user.discord_id}/${bannerHash}.${getExtension(bannerHash)}?size=2048`;
                }
            }

            const avatarHash = user.discord_avatar as string | null;
            let avatarUrl: string | null = null;
            if (avatarHash) {
                if (user.is_guild_avatar && serverId) {
                    avatarUrl = `https://cdn.discordapp.com/guilds/${serverId}/users/${user.discord_id}/avatars/${avatarHash}.${getExtension(avatarHash)}`;
                } else {
                    avatarUrl = `https://cdn.discordapp.com/avatars/${user.discord_id}/${avatarHash}.${getExtension(avatarHash)}`;
                }
            }

            // Standardize response
            return c.json({
                id: user.id, // Use the actual DB primary key
                discord_id: user.discord_id,
                discord_username: user.discord_username,
                discord_avatar: user.discord_avatar, // Raw hash
                username: user.discord_username,
                avatar: user.discord_avatar, // Map to avatar hash

                // Computed URLs (Use these in Frontend)
                discord_banner_url: bannerUrl,
                discord_avatar_url: avatarUrl,

                standoff_nickname: user.standoff_nickname,
                elo: user.elo || 1000,
                allies_elo: user.allies_elo || 1000,
                wins: user.wins || 0,
                losses: user.losses || 0,
                allies_wins: user.allies_wins || 0,
                allies_losses: user.allies_losses || 0,
                role: user.role || 'user',
                is_vip: isVip,
                vip_until: user.vip_until,
                is_discord_member: user.is_discord_member === 1,
                created_at: user.created_at,
                discord_roles: user.discord_roles ? JSON.parse(user.discord_roles as string) : [],
                gold: user.gold || 0,
                discord_accent_color: user.discord_accent_color,
                custom_banner: user.custom_banner, // Return raw custom banner for editing
                banner_mode: user.banner_mode || 'discord', // Current mode
                daily_comp_matches_used: await (async () => {
                    const today = new Date().toISOString().split('T')[0];
                    const count = await c.env.DB.prepare(`
                        SELECT COUNT(*) as count FROM matches m
                        JOIN match_players mp ON m.id = mp.match_id
                        WHERE (mp.player_id = ? OR mp.player_id = ?)
                        AND m.match_type = 'competitive'
                        AND m.status = 'completed'
                        AND m.updated_at LIKE ?
                    `).bind(user.id, user.discord_id, `${today}%`).first() as { count: number } | null;
                    return count?.count || 0;
                })(),
                // Fetch user's clan
                clan: await (async () => {
                    const clanData = await c.env.DB.prepare(`
                        SELECT c.id, c.name, c.tag, c.logo_url, c.description, cm.role as member_role,
                               (SELECT COUNT(*) FROM clan_members WHERE clan_id = c.id) as member_count
                        FROM clans c
                        JOIN clan_members cm ON c.id = cm.clan_id
                        WHERE cm.user_id = ? OR cm.user_id = ?
                    `).bind(user.id, user.discord_id).first();
                    return clanData || null;
                })(),
                rank: null, // Placeholder
                next_rank: null // Placeholder
            });
        } catch (error) {
            console.error('❌ Profile fetch error:', error);
            if (error instanceof Error) {
                console.error('Error stack:', error.stack);
            }
            return c.json({
                error: 'Failed to fetch profile',
                details: error instanceof Error ? error.message : String(error)
            }, 500);
        }
    });

    // POST /api/profile/banner - Update Custom Banner URL (VIP Only)
    app.post('/api/profile/banner', async (c) => {
        try {
            const body = await c.req.json();
            const { userId, bannerUrl } = body;

            if (!userId) return c.json({ error: 'Missing userId' }, 400);

            // 1. Verify user is VIP
            const user = await c.env.DB.prepare(
                'SELECT is_vip FROM players WHERE id = ? OR discord_id = ?'
            ).bind(userId, userId).first();

            if (!user) return c.json({ error: 'User not found' }, 404);
            if (user.is_vip !== 1) {
                return c.json({ error: 'Only VIP members can set custom banners' }, 403);
            }

            // 2. Update Database & Set Mode to Custom
            await c.env.DB.prepare(
                'UPDATE players SET custom_banner = ?, banner_mode = ? WHERE id = ? OR discord_id = ?'
            ).bind(bannerUrl, 'custom', userId, userId).run();

            return c.json({ success: true, bannerUrl, banner_mode: 'custom' });
        } catch (error) {
            console.error('❌ Banner update error:', error);
            return c.json({ error: 'Failed to update banner' }, 500);
        }
    });

    // POST /api/profile/banner/upload - Upload Custom Banner to R2 (VIP Only)
    app.post('/api/profile/banner/upload', async (c) => {
        try {
            const formData = await c.req.formData();
            const userId = formData.get('userId') as string;
            const file = formData.get('file') as unknown as File;

            if (!userId) return c.json({ error: 'Missing userId' }, 400);
            if (!file) return c.json({ error: 'Missing file' }, 400);

            // Validate file type
            const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                return c.json({ error: 'Invalid file type. Allowed: PNG, JPG, GIF, WEBP' }, 400);
            }

            // Validate file size (max 5MB)
            const maxSize = 5 * 1024 * 1024;
            if (file.size > maxSize) {
                return c.json({ error: 'File too large. Maximum size is 5MB' }, 400);
            }

            // Verify user is VIP
            const user = await c.env.DB.prepare(
                'SELECT is_vip FROM players WHERE id = ? OR discord_id = ?'
            ).bind(userId, userId).first();

            if (!user) return c.json({ error: 'User not found' }, 404);
            if (user.is_vip !== 1) {
                return c.json({ error: 'Only VIP members can upload custom banners' }, 403);
            }

            // Generate unique filename
            const ext = file.name.split('.').pop() || 'png';
            const filename = `banners/${userId}_${Date.now()}.${ext}`;

            // Upload to R2
            const arrayBuffer = await file.arrayBuffer();
            await c.env.IMAGES_BUCKET.put(filename, arrayBuffer, {
                httpMetadata: {
                    contentType: file.type,
                }
            });

            // Construct URL using our own backend as proxy
            const backendDomain = c.req.url.split('/api/')[0];
            const publicUrl = `${backendDomain}/api/images/${filename}`;

            // Update database & Set Mode to Custom
            await c.env.DB.prepare(
                'UPDATE players SET custom_banner = ?, banner_mode = ? WHERE id = ? OR discord_id = ?'
            ).bind(publicUrl, 'custom', userId, userId).run();

            return c.json({ success: true, bannerUrl: publicUrl, banner_mode: 'custom' });
        } catch (error) {
            console.error('❌ Banner upload error:', error);
            return c.json({ error: 'Failed to upload banner' }, 500);
        }
    });

    // POST /api/profile/banner/mode - Toggle Banner Mode (VIP Only)
    app.post('/api/profile/banner/mode', async (c) => {
        try {
            const body = await c.req.json();
            const { userId, mode } = body;

            if (!userId || !mode) return c.json({ error: 'Missing required fields' }, 400);
            if (!['discord', 'custom'].includes(mode)) return c.json({ error: 'Invalid mode' }, 400);

            // 1. Verify user is VIP
            const user = await c.env.DB.prepare(
                'SELECT is_vip FROM players WHERE id = ? OR discord_id = ?'
            ).bind(userId, userId).first();

            if (!user) return c.json({ error: 'User not found' }, 404);
            if (user.is_vip !== 1) {
                return c.json({ error: 'Only VIP members can change banner mode' }, 403);
            }

            // 2. Update Mode
            await c.env.DB.prepare(
                'UPDATE players SET banner_mode = ? WHERE id = ? OR discord_id = ?'
            ).bind(mode, userId, userId).run();

            return c.json({ success: true, mode });
        } catch (error) {
            console.error('❌ Banner mode update error:', error);
            return c.json({ error: 'Failed to update banner mode' }, 500);
        }
    });

    // GET /api/images/* - Serve images from R2 bucket
    app.get('/api/images/*', async (c) => {
        try {
            const key = c.req.path.replace('/api/images/', '');

            if (!key) {
                return c.json({ error: 'Missing image key' }, 400);
            }

            const object = await c.env.IMAGES_BUCKET.get(key);

            if (!object) {
                return c.json({ error: 'Image not found' }, 404);
            }

            const headers = new Headers();
            headers.set('Content-Type', object.httpMetadata?.contentType || 'image/png');
            headers.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

            return new Response(object.body, { headers });
        } catch (error) {
            console.error('❌ Image fetch error:', error);
            return c.json({ error: 'Failed to fetch image' }, 500);
        }
    });

    // PUT /api/profile/nickname - Update Standoff 2 nickname
    app.put('/api/profile/nickname', async (c) => {
        try {
            const body = await c.req.json();

            // Validate with Zod
            const validation = updateProfileSchema.safeParse(body);
            if (!validation.success) {
                return c.json({
                    error: 'Validation failed',
                    details: validation.error.issues
                }, 400);
            }

            const { userId, nickname } = validation.data;

            // Check if nickname is already taken via raw SQL
            const existing = await c.env.DB.prepare(
                'SELECT * FROM players WHERE standoff_nickname = ?'
            ).bind(nickname).first();

            if (existing && existing.discord_id !== userId) {
                return c.json({ error: 'Nickname already taken' }, 409);
            }

            // Update database via raw SQL
            const result = await c.env.DB.prepare(
                'UPDATE players SET standoff_nickname = ?, nickname_updated_at = ? WHERE id = ? OR discord_id = ?'
            ).bind(nickname, new Date().toISOString(), userId, userId).run();

            if (result.meta?.changes === 0) {
                return c.json({ error: 'User not found in database. Please logout and login again.' }, 404);
            }

            // Update Discord server nickname via bot
            let discordUpdated = false;

            if (c.env.DISCORD_BOT_TOKEN && c.env.DISCORD_SERVER_ID) {
                // Dynamic import to avoid loading utility if not needed
                const { updateDiscordNickname } = await import('../utils/discord');
                discordUpdated = await updateDiscordNickname(
                    userId,
                    nickname,
                    c.env.DISCORD_BOT_TOKEN,
                    c.env.DISCORD_SERVER_ID
                );
            }

            return c.json({
                success: true,
                nickname,
                discord_updated: discordUpdated
            });
        } catch (error) {
            console.error('❌ Nickname update database error:', error);
            if (error instanceof Error) {
                console.error('Error details:', error.message);
                console.error('Error stack:', error.stack);
            }
            return c.json({
                error: 'Failed to update nickname',
                details: error instanceof Error ? error.message : 'Database execution failed'
            }, 500);
        }
    });

    // GET /api/profile/check-nickname/:nickname - Check availability
    app.get('/api/profile/check-nickname/:nickname', async (c) => {
        try {
            const nickname = c.req.param('nickname');

            // Validate with Zod
            const validation = nicknameSchema.safeParse(nickname);
            if (!validation.success) {
                return c.json({
                    available: false,
                    error: validation.error.issues[0].message
                });
            }

            const existing = await c.env.DB.prepare(
                'SELECT * FROM players WHERE standoff_nickname = ?'
            ).bind(nickname).first();

            return c.json({ available: !existing });
        } catch (error) {
            console.error('Nickname check error:', error);
            return c.json({ available: false, error: 'Check failed' }, 500);
        }
    });

    // GET /api/profile/:userId/matches - Get match history
    app.get('/api/profile/:userId/matches', async (c) => {
        try {
            const userId = c.req.param('userId');
            const type = c.req.query('type'); // 'league' or 'casual'

            // Base query
            let query = `SELECT 
                    m.id as match_id, 
                    m.map_name, 
                    m.status, 
                    m.winner_team,
                    m.created_at,
                    m.result_screenshot_url,
                    m.match_type,
                    mp.team as player_team,
                    mp.joined_at,
                    m.alpha_score,
                    m.bravo_score,
                    eh.elo_change
                FROM matches m
                JOIN match_players mp ON m.id = mp.match_id
                LEFT JOIN elo_history eh ON m.id = eh.match_id AND (eh.user_id = ? OR eh.user_id IN (SELECT discord_id FROM players WHERE id = ?))
                WHERE (mp.player_id = ? OR mp.player_id IN (SELECT discord_id FROM players WHERE id = ?)) AND m.status IN ('completed', 'pending_review')`;

            const params: any[] = [userId, userId, userId, userId];

            // Add filter if type is provided
            if (type) {
                query += ` AND m.match_type = ?`;
                params.push(type);
            }

            query += ` ORDER BY m.created_at DESC LIMIT 20`;

            // Find all matches user participated in
            const matches = await c.env.DB.prepare(query).bind(...params).all();

            return c.json({ matches: matches.results || [] });
        } catch (error) {
            console.error('Match history error:', error);
            return c.json({ error: 'Failed to fetch match history' }, 500);
        }
    });

    // GET /api/profile/:userId/elo-history - Get ELO history
    app.get('/api/profile/:userId/elo-history', async (c) => {
        try {
            const userId = c.req.param('userId');

            // 1. Fetch ELO History
            const eloHistory = await c.env.DB.prepare(
                `SELECT 
                    eh.*,
                    moderator.discord_username as moderator_username,
                    moderator.discord_avatar as moderator_avatar,
                    'elo' as type
                 FROM elo_history eh
                 LEFT JOIN players moderator ON eh.created_by = moderator.id
                 WHERE eh.user_id = ? OR eh.user_id IN (SELECT discord_id FROM players WHERE id = ?)
                 ORDER BY eh.created_at DESC LIMIT 50`
            ).bind(userId, userId).all();

            // 2. Fetch Ban/Unban Logs
            const modLogs = await c.env.DB.prepare(
                `SELECT 
                    ml.id,
                    ml.created_at,
                    ml.action_type as reason,
                    0 as elo_change,
                    0 as elo_before,
                    0 as elo_after,
                    moderator.discord_username as moderator_username,
                    moderator.discord_avatar as moderator_avatar,
                    'action' as type
                 FROM moderator_logs ml
                 LEFT JOIN players moderator ON ml.moderator_id = moderator.id
                 WHERE (ml.target_id = ? OR ml.target_id IN (SELECT discord_id FROM players WHERE id = ?))
                 AND ml.action_type IN ('BAN_USER', 'UNBAN_USER')
                 ORDER BY ml.created_at DESC LIMIT 50`
            ).bind(userId, userId).all();

            // 3. Merge and Sort
            const combinedHistory = [...(eloHistory.results || []), ...(modLogs.results || [])]
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 100);

            return c.json({ history: combinedHistory });
        } catch (error) {
            console.error('ELO history error:', error);
            return c.json({ error: 'Failed to fetch ELO history' }, 500);
        }
    });
}
