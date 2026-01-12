import { memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, X } from "lucide-react";
import LevelBadge from '../LevelBadge'; // Adjust path
import type { MatchPlayer } from '../../types/match';

interface LobbyPlayerCardProps {
    player: MatchPlayer;
    teamColor: string;
    isHost: boolean;
    currentUserId?: string;
    onKick: (playerId: string) => void;
}

// Custom equality check
const arePlayerPropsEqual = (prevProps: LobbyPlayerCardProps, nextProps: LobbyPlayerCardProps) => {
    return (
        prevProps.player.player_id === nextProps.player.player_id &&
        prevProps.player.team === nextProps.player.team &&
        prevProps.player.elo === nextProps.player.elo &&
        prevProps.player.role === nextProps.player.role &&
        prevProps.player.is_vip === nextProps.player.is_vip &&
        prevProps.player.standoff_nickname === nextProps.player.standoff_nickname &&
        prevProps.player.discord_username === nextProps.player.discord_username &&
        prevProps.player.discord_avatar === nextProps.player.discord_avatar &&
        prevProps.teamColor === nextProps.teamColor &&
        prevProps.isHost === nextProps.isHost &&
        prevProps.currentUserId === nextProps.currentUserId &&
        prevProps.onKick === nextProps.onKick // Function reference check might be strict
    );
};

export const LobbyPlayerCard = memo(({
    player,
    teamColor,
    isHost,
    currentUserId,
    onKick
}: LobbyPlayerCardProps) => {
    const displayName = player.standoff_nickname || player.discord_username || 'Player';
    const avatarUrl = player.discord_avatar
        ? `https://cdn.discordapp.com/avatars/${player.player_id}/${player.discord_avatar}.png`
        : undefined;

    return (
        <div className={`bg-[#1c1e22] hover:bg-[#23252a] transition-all duration-200 rounded-lg border border-[${teamColor}]/20 p-3 lg:p-4 group relative`}>
            {isHost && player.player_id !== currentUserId && (
                <button
                    onClick={() => onKick(player.player_id)}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 transition-colors z-10"
                    title="Kick player"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
            <div className="flex items-center gap-3 lg:gap-4">
                <Avatar className={`h-11 w-11 lg:h-14 lg:w-14 border-2 border-[${teamColor}]/30 group-hover:border-[${teamColor}]/60 transition-colors`}>
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className={`bg-[${teamColor}]/20 text-[${teamColor}]`}><User className="h-5 w-5 lg:h-6 lg:w-6" /></AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="font-semibold text-white truncate text-sm lg:text-base">
                                {displayName}
                            </span>
                            {player.role === 'admin' && <Badge className="text-[9px] lg:text-[10px] px-1.5 py-0 bg-[#ff5500] text-white border-0 font-bold">ADMIN</Badge>}
                            {player.role === 'moderator' && <Badge className={`text-[9px] lg:text-[10px] px-1.5 py-0 bg-[${teamColor}] text-white border-0 font-bold`}>MOD</Badge>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <LevelBadge elo={player.elo || 1000} showElo={true} className="gap-1" />
                        </div>
                    </div>
                    <div className="text-[11px] lg:text-xs text-white/40 font-mono">
                        ELO: <span className="text-white/60 font-semibold">{player.elo || 1000}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}, arePlayerPropsEqual);
