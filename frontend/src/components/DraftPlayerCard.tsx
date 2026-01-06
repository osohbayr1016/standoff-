import React from 'react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import LevelBadge from './LevelBadge';
import { cn } from '@/lib/utils';
import { Crown } from 'lucide-react';

interface QueuePlayer {
    id: string;
    discord_id?: string;
    username: string;
    avatar?: string | null;
    elo?: number;
    standoff_nickname?: string;
}

interface DraftPlayerCardProps {
    player: QueuePlayer;
    isCaptain?: boolean;
    isPicked?: boolean;
    isTurn?: boolean; // If it's this captain's turn
    onPick?: () => void;
    teamColor?: 'alpha' | 'bravo'; // For picked players
    className?: string;
}

export const DraftPlayerCard: React.FC<DraftPlayerCardProps> = ({
    player,
    isCaptain,
    isPicked,
    isTurn,
    onPick,
    teamColor,
    className
}) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={!isPicked && onPick ? { scale: 1.05, y: -2 } : {}}
            onClick={!isPicked ? onPick : undefined}
            className={cn(
                "relative flex items-center gap-3 p-3 rounded-xl border border-border/40 backdrop-blur-md transition-all duration-300",
                // Base Styles
                "bg-black/40 hover:bg-black/60",
                // Captain Styles
                isCaptain && "border-yellow-500/50 bg-yellow-950/20",
                isCaptain && isTurn && "ring-2 ring-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.3)] bg-yellow-900/40",
                // Team Colors
                teamColor === 'alpha' && "border-blue-500/30 bg-blue-950/20",
                teamColor === 'bravo' && "border-red-500/30 bg-red-950/20",
                // Pickable Pool Interaction
                !isPicked && onPick && "cursor-pointer hover:border-primary/50 hover:shadow-lg",
                className
            )}
        >
            {/* Captain Crown */}
            {isCaptain && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black/80 rounded-full p-1 border border-yellow-500/50">
                    <Crown className="w-3 h-3 text-yellow-500" />
                </div>
            )}

            <div className="relative">
                <Avatar className={cn("h-10 w-10 border-2",
                    isCaptain ? "border-yellow-500" : "border-muted",
                    teamColor === 'alpha' && "border-blue-500",
                    teamColor === 'bravo' && "border-red-500"
                )}>
                    <AvatarImage src={player.avatar || undefined} />
                    <AvatarFallback className="bg-muted text-xs">
                        {player.username.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 bg-black/80 rounded-full border border-border scale-[0.7]">
                    <LevelBadge elo={player.elo || 1000} />
                </div>
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-semibold truncate",
                        isCaptain ? "text-yellow-100" : "text-gray-100"
                    )}>
                        {player.standoff_nickname || player.username}
                    </span>
                </div>
                {/* <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="text-yellow-500/80">{player.elo || 1000} Elo</span>
                </div> */}
            </div>

        </motion.div>
    );
};
