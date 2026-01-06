
import React, { memo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { MatchPlayer } from './LobbyDetailPage';

interface VirtualPlayerListProps {
    players: MatchPlayer[];
    teamColor: string;
    isHost: boolean;
    currentUserId?: string;
    onKick: (playerId: string) => void;
    PlayerCardComponent: React.ComponentType<any>;
    minHeight?: number;
    emptyMessage?: string;
}

const VirtualPlayerList: React.FC<VirtualPlayerListProps> = memo(({
    players,
    teamColor,
    isHost,
    currentUserId,
    onKick,
    PlayerCardComponent,
    minHeight = 400,
    emptyMessage = "Waiting for players..."
}) => {
    // If few players, just render normally (no virtualization overhead)
    if (players.length <= 10) {
        return (
            <div className="space-y-2 lg:space-y-3">
                {players.map(player => (
                    <PlayerCardComponent
                        key={player.player_id}
                        player={player}
                        teamColor={teamColor}
                        isHost={isHost}
                        currentUserId={currentUserId}
                        onKick={onKick}
                    />
                ))}
                {Array(Math.max(0, 5 - players.length)).fill(0).map((_, i) => (
                    <div key={`empty-${i}`} style={{ borderColor: `${teamColor}1A` }} className="h-[68px] lg:h-[88px] rounded-lg border-2 border-dashed bg-[#1c1e22]/30 flex items-center justify-center text-white/20 text-xs font-medium uppercase tracking-widest">
                        {emptyMessage}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <Virtuoso
            style={{ height: minHeight, minHeight: '50vh', width: '100%' }}
            totalCount={players.length}
            itemContent={(index) => {
                const player = players[index];
                return (
                    <div className="pb-2 lg:pb-3"> {/* Add padding for gap */}
                        <PlayerCardComponent
                            player={player}
                            teamColor={teamColor}
                            isHost={isHost}
                            currentUserId={currentUserId}
                            onKick={onKick}
                        />
                    </div>
                );
            }}
        />
    );
});

export default VirtualPlayerList;
