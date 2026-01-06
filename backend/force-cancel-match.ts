// Force Cancel Zombie Match Script
// Run this in your backend to cancel the stuck match

// Option 1: If you know the match ID from the URL, replace MATCH_ID below
const MATCH_ID = 'YOUR_MATCH_ID_HERE'; // Get this from the browser URL

// Option 2: Cancel all YOUR active matches (safer for testing)
async function cancelAllMyMatches(userId: string, env: any) {
    try {
        // Find all active matches for this user
        const matches = await env.DB.prepare(`
      SELECT DISTINCT m.id, m.status 
      FROM matches m
      JOIN match_players mp ON m.id = mp.match_id
      WHERE (mp.player_id = ? OR m.host_id = ?)
      AND m.status IN ('waiting', 'in_progress', 'drafting', 'map_ban')
    `).bind(userId, userId).all();

        console.log(`Found ${matches.results?.length || 0} active matches for user ${userId}`);

        // Cancel each one
        for (const match of (matches.results || [])) {
            await env.DB.prepare(`
        UPDATE matches 
        SET status = 'cancelled', updated_at = datetime('now')
        WHERE id = ?
      `).bind(match.id).run();

            console.log(`✅ Cancelled match ${match.id} (was ${match.status})`);
        }

        return { success: true, cancelled: matches.results?.length || 0 };
    } catch (error) {
        console.error('Error cancelling matches:', error);
        return { success: false, error };
    }
}

// To use this, run in Wrangler CLI or create a temporary endpoint
// Example: wrangler d1 execute standoff-db --command "UPDATE matches SET status='cancelled' WHERE id='MATCH_ID'"
