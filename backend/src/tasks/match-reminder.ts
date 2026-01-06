import { sendDiscordMessage } from '../utils/discord';

export async function checkStaleMatches(env: any) {
    try {
        // Fetch active matches that haven't been reminded
        const result = await env.DB.prepare(`
            SELECT id, created_at, match_type FROM matches 
            WHERE status = 'in_progress' AND reminder_sent = 0
        `).all();

        const matches = result.results || [];
        const now = Date.now();
        const TWENTY_MINUTES = 20 * 60 * 1000;
        const TARGET_CHANNEL = '1457019547394773085';

        for (const match of matches) {
            const createdAt = new Date(match.created_at as string).getTime();

            // Check if duration > 20 mins
            if (now - createdAt > TWENTY_MINUTES) {
                console.log(`Match ${match.id} is stale (>20m). Sending reminder.`);

                // Fetch Captains
                const captainsResult = await env.DB.prepare(`
                    SELECT p.discord_id 
                    FROM match_players mp
                    JOIN players p ON mp.player_id = p.id
                    WHERE mp.match_id = ? AND mp.is_captain = 1
                `).bind(match.id).all();

                const captains = captainsResult.results || [];
                const mentions = captains.map((c: any) => `<@${c.discord_id}>`).join(' ');

                // Message
                const message = `Hey ${mentions}! Match #${(match.id as string).slice(0, 8)} (${(match.match_type as string).toUpperCase()}) has been running for >20 mins.
Сайн байна уу? Үр дүнгээ илгээнэ үү (Зураг болон Хожсон тал). Website дээрээс явуулаарай! Баярлалаа! 🙏📸✨`;

                // Send Notification
                await sendDiscordMessage(env, TARGET_CHANNEL, message);

                // Mark as reminded
                await env.DB.prepare(
                    'UPDATE matches SET reminder_sent = 1 WHERE id = ?'
                ).bind(match.id).run();
            }
        }
    } catch (error) {
        console.error('Error in checkStaleMatches:', error);
    }
}
