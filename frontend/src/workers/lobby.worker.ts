export interface MatchPlayer {
    player_id: string;
    team: string;
    discord_username?: string;
    discord_avatar?: string;
    elo?: number;
    is_vip?: number | boolean;
    standoff_nickname?: string;
    role?: string;
}

// Sorting priorities:
// 1. Admin/Moderator
// 2. VIP
// 3. Elo (descending)
// 4. Nickname (alphabetical)

const getRolePriority = (role?: string) => {
    if (role === 'admin') return 3;
    if (role === 'moderator') return 2;
    return 0;
};

const sortPlayers = (a: MatchPlayer, b: MatchPlayer) => {
    // 1. Role
    const roleA = getRolePriority(a.role);
    const roleB = getRolePriority(b.role);
    if (roleA !== roleB) return roleB - roleA;

    // 2. VIP
    const vipA = a.is_vip ? 1 : 0;
    const vipB = b.is_vip ? 1 : 0;
    if (vipA !== vipB) return vipB - vipA;

    // 3. Elo
    const eloA = a.elo || 0;
    const eloB = b.elo || 0;
    if (eloA !== eloB) return eloB - eloA;

    // 4. Name
    const nameA = a.standoff_nickname || a.discord_username || '';
    const nameB = b.standoff_nickname || b.discord_username || '';
    return nameA.localeCompare(nameB);
};

self.onmessage = (e: MessageEvent) => {
    const { players } = e.data as { players: MatchPlayer[] };

    if (!players || !Array.isArray(players)) {
        self.postMessage({ alpha: [], bravo: [] });
        return;
    }

    const alpha: MatchPlayer[] = [];
    const bravo: MatchPlayer[] = [];

    // Single pass filtering? Or just filter then sort.
    // Filter then sort is cleaner code, sorting is O(N log N) but N is small (100).
    // Web Worker ensures even with 1000 players it won't freeze UI.

    for (const player of players) {
        if (player.team === 'alpha') {
            alpha.push(player);
        } else if (player.team === 'bravo') {
            bravo.push(player);
        }
    }

    alpha.sort(sortPlayers);
    bravo.sort(sortPlayers);

    self.postMessage({ alpha, bravo });
};
