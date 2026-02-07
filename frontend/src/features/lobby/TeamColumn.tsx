import { memo } from 'react';
import type { MatchPlayer } from '../../types/match';
import { LobbyPlayerCard } from './LobbyPlayerCard';

interface TeamColumnProps {
    teamName: string;
    teamColor: string; // Hex color for borders/badges
    players: MatchPlayer[];
    isHost: boolean;
    currentUserId?: string;
    onKick: (playerId: string) => void;
    emptySlots: number; // To render empty placeholders if needed
    isAllies?: boolean;
    onNavigateToProfile?: (userId: string) => void;
}

export const TeamColumn = memo(({
    teamName,
    teamColor,
    players,
    isHost,
    currentUserId,
    onKick,
    emptySlots,
    isAllies = false,
    onNavigateToProfile
}: TeamColumnProps) => {
    const maxPlayers = players.length + Math.max(0, emptySlots);
    const avgElo = Math.round(
        players.reduce((a, b) => a + ((isAllies ? b.allies_elo : b.elo) || 1000), 0) / (players.length || 1)
    );

    return (
        <div className="space-y-3">
            {/* Team Header */}
            <div className={`flex items-center justify-between px-4 lg:px-5 py-3 lg:py-4 bg-[#23252a] rounded-lg border-l-4`} style={{ borderLeftColor: teamColor }}>
                <div className="flex items-center gap-2 lg:gap-3">
                    <div className="w-2 h-2 lg:w-3 lg:h-3 rounded-full animate-pulse" style={{ backgroundColor: teamColor }}></div>
                    <div className="flex flex-col">
                        <h2 className="text-sm lg:text-base font-bold uppercase tracking-wider truncate max-w-[200px]" style={{ color: teamColor }}>
                            {teamName}
                        </h2>
                        <span className="text-[10px] lg:text-xs text-white/40 font-mono">
                            AVG {isAllies ? 'ALLIES ' : ''}ELO: <span className="text-white/80">{avgElo}</span>
                        </span>
                    </div>
                </div>
                <div className="px-2 lg:px-3 py-1 bg-black/20 rounded text-xs lg:text-sm font-mono text-white/50 border border-white/5">
                    {players.length} / {maxPlayers}
                </div>
            </div>

            {/* Players List */}
            <div className="flex flex-col gap-2">
                {players.map((player) => (
                    <LobbyPlayerCard
                        key={player.player_id}
                        player={player}
                        teamColor={teamColor}
                        isHost={isHost}
                        currentUserId={currentUserId}
                        onKick={onKick}
                        isAllies={isAllies}
                        onNavigateToProfile={onNavigateToProfile}
                    />
                ))}

                {/* Empty Slots */}
                {Array.from({ length: Math.max(0, emptySlots) }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-[72px] lg:h-[88px] rounded-lg border border-dashed border-white/10 bg-white/5 flex items-center justify-center text-white/20 text-xs lg:text-sm font-medium">
                        Waiting for player...
                    </div>
                ))}
            </div>
        </div>
    );
});
