import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Swords, Clock, UserPlus, Crown } from 'lucide-react';
import LevelBadge from './LevelBadge';
import { cn } from '@/lib/utils';

interface QueuePlayer {
    id: string;
    discord_id?: string;
    username: string;
    avatar?: string | null;
    elo?: number;
    standoff_nickname?: string;
    discord_avatar?: string;
    player_id?: string;
}

interface DraftPhaseProps {
    pool: QueuePlayer[];
    captainA: QueuePlayer;
    captainB: QueuePlayer;
    teamA: QueuePlayer[];
    teamB: QueuePlayer[];
    currentTurn: 'captainA' | 'captainB';
    currentUserId: string;
    timeLeft: number;
    onPick: (player: QueuePlayer) => void;
    onTimeout?: () => void;
}

// Helper to get avatar URL
const getAvatarUrl = (player: QueuePlayer) => {
    if (player.avatar) return player.avatar;
    if (player.discord_avatar) {
        const id = player.player_id || player.id || player.discord_id;
        return `https://cdn.discordapp.com/avatars/${id}/${player.discord_avatar}.png`;
    }
    return undefined;
};

// Player Card Component
const PlayerCard: React.FC<{
    player: QueuePlayer;
    isCaptain?: boolean;
    isTurn?: boolean;
    teamColor?: 'alpha' | 'bravo';
    onClick?: () => void;
    disabled?: boolean;
    layoutId?: string;
}> = ({ player, isCaptain, isTurn, teamColor, onClick, disabled, layoutId }) => {
    const borderColor = teamColor === 'alpha' ? 'border-blue-500' : teamColor === 'bravo' ? 'border-red-500' : 'border-white/10';
    const glowColor = teamColor === 'alpha' ? 'shadow-blue-500/30' : teamColor === 'bravo' ? 'shadow-red-500/30' : '';

    return (
        <motion.div
            layout
            layoutId={layoutId} // Enable shared layout animation
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileHover={onClick && !disabled ? { scale: 1.02 } : undefined}
            whileTap={onClick && !disabled ? { scale: 0.98 } : undefined}
            onClick={onClick && !disabled ? () => {
                console.log('👆 PlayerCard Clicked:', player.username, player.id);
                onClick();
            } : undefined}
            className={cn(
                "relative flex items-center gap-2 lg:gap-3 p-2 lg:p-3 rounded-xl border bg-black/40 backdrop-blur-sm transition-all",
                borderColor,
                isTurn && "ring-2 ring-yellow-500 ring-offset-2 ring-offset-black",
                isCaptain && `shadow-lg ${glowColor}`,
                onClick && !disabled && "cursor-pointer hover:bg-white/5",
                disabled && "opacity-50 cursor-not-allowed"
            )}
        >
            {isCaptain && (
                <Crown className="absolute -top-2 -right-2 w-5 h-5 lg:w-6 lg:h-6 text-yellow-500 fill-yellow-500" />
            )}

            <Avatar className="w-10 h-10 lg:w-12 lg:h-12 border border-white/20">
                <AvatarImage src={getAvatarUrl(player)} className="object-cover" />
                <AvatarFallback className="bg-white/10 text-white text-sm lg:text-base">
                    {(player.standoff_nickname || player.username || 'P')[0].toUpperCase()}
                </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-xs lg:text-sm truncate">
                    {player.standoff_nickname || player.username || 'Player'}
                </p>
                <LevelBadge elo={player.elo || 1000} showElo className="mt-0.5 text-xs" />
            </div>
        </motion.div>
    );
};

export const DraftPhase: React.FC<DraftPhaseProps> = ({
    pool,
    captainA,
    captainB,
    teamA,
    teamB,
    currentTurn,
    currentUserId,
    timeLeft,
    onPick,
    onTimeout
}) => {
    const isCaptainA = currentUserId === captainA.id || currentUserId === captainA.discord_id || currentUserId === captainA.player_id;
    const isCaptainB = currentUserId === captainB.id || currentUserId === captainB.discord_id || currentUserId === captainB.player_id;
    const canPick = (currentTurn === 'captainA' && isCaptainA) || (currentTurn === 'captainB' && isCaptainB);

    useEffect(() => {
        console.log('[DraftPhase] Turn:', currentTurn);
        console.log('[DraftPhase] Me:', currentUserId);
        console.log('[DraftPhase] CaptA:', captainA.id, captainA.player_id, captainA.discord_id, 'isMe:', isCaptainA);
        console.log('[DraftPhase] CaptB:', captainB.id, captainB.player_id, captainB.discord_id, 'isMe:', isCaptainB);
        console.log('[DraftPhase] CAN PICK:', canPick);
    }, [currentTurn, currentUserId, captainA, captainB]);

    // Local timer state for smooth countdown (updates every second)
    const [localTimeLeft, setLocalTimeLeft] = useState(timeLeft);

    // Sync with prop and start countdown interval
    useEffect(() => {
        setLocalTimeLeft(timeLeft); // Sync when prop changes (e.g., new turn)
    }, [timeLeft]);

    useEffect(() => {
        const interval = setInterval(() => {
            setLocalTimeLeft(prev => {
                if (prev <= 1) {
                    // Trigger timeout check when we hit 0
                    if (onTimeout) onTimeout();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [currentTurn, onTimeout]); // Reset interval on turn change

    return (
        <div className="w-full min-h-[60vh] lg:min-h-[70vh] flex flex-col gap-4 lg:gap-6 p-3 lg:p-6 relative overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-[300px] lg:h-[500px] bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[300px] lg:w-[500px] h-[300px] lg:h-[500px] bg-red-500/5 rounded-full blur-[80px] lg:blur-[100px] pointer-events-none" />

            {/* Header */}
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="relative z-10 flex flex-col items-center justify-center p-2 lg:p-4"
            >
                <Badge variant="outline" className="px-3 lg:px-4 py-1 text-sm lg:text-lg border-yellow-500/50 text-yellow-500 bg-yellow-500/10 mb-2">
                    <Swords className="w-3 h-3 lg:w-4 lg:h-4 mr-1 lg:mr-2" />
                    IMMORTAL DRAFT
                </Badge>

                <h2 className={cn(
                    "text-lg lg:text-2xl font-bold tracking-wider animate-pulse text-center",
                    currentTurn === 'captainA' ? "text-blue-400" : "text-red-400"
                )}>
                    {currentTurn === 'captainA'
                        ? `${captainA.standoff_nickname || captainA.username}'s Turn`
                        : `${captainB.standoff_nickname || captainB.username}'s Turn`}
                </h2>

                <div className="flex items-center gap-2 mt-1 lg:mt-2 text-muted-foreground font-mono text-sm lg:text-base">
                    <Clock className="w-3 h-3 lg:w-4 lg:h-4" />
                    <span>{localTimeLeft}s remaining</span>
                </div>
            </motion.div>

            {/* Timer Progress Bar */}
            <motion.div
                className="relative w-full max-w-md mx-auto h-1 bg-white/10 rounded-full overflow-hidden mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                <motion.div
                    className={cn("h-full transition-all duration-1000", currentTurn === 'captainA' ? "bg-blue-500" : "bg-red-500")}
                    initial={{ width: "100%" }}
                    animate={{ width: `${(localTimeLeft / 15) * 100}%` }}
                />
            </motion.div>

            {/* Main Layout - Mobile: stacked, Desktop: 3 columns */}
            <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-6 flex-1 relative z-10">

                {/* Team Alpha */}
                <div className="lg:col-span-3 order-2 lg:order-1">
                    <div className="flex items-center justify-between px-2 mb-2 lg:mb-3">
                        <h3 className="text-blue-400 font-bold tracking-widest uppercase text-xs lg:text-sm flex items-center gap-2">
                            <span className="w-1.5 h-6 lg:w-2 lg:h-8 bg-blue-500 rounded-full" />
                            Team Alpha
                        </h3>
                        <span className="text-xs text-blue-400/60 font-mono">{teamA.length}/5</span>
                    </div>

                    <Card className="bg-black/20 border-blue-500/10 p-2 lg:p-3 space-y-2 min-h-[120px] lg:min-h-[300px]">
                        <PlayerCard player={captainA} isCaptain isTurn={currentTurn === 'captainA'} teamColor="alpha" />

                        <AnimatePresence mode='popLayout'>
                            {teamA.filter(p => p.id !== captainA.id && p.player_id !== captainA.player_id).map(player => (
                                <PlayerCard key={player.id || player.player_id} player={player} teamColor="alpha" layoutId={player.id || player.player_id} />
                            ))}
                        </AnimatePresence>

                        {Array.from({ length: Math.max(0, 5 - teamA.length) }).map((_, i) => (
                            <div key={`empty-a-${i}`} className="h-12 lg:h-14 border border-dashed border-blue-500/20 rounded-xl flex items-center justify-center bg-blue-500/5">
                                <UserPlus className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500/20" />
                            </div>
                        ))}
                    </Card>
                </div>

                {/* Player Pool */}
                <div className="lg:col-span-6 order-1 lg:order-2">
                    <div className="text-center mb-2 lg:mb-3">
                        <h3 className="text-yellow-100/60 font-medium tracking-widest uppercase text-xs lg:text-sm">
                            Available Players ({pool.length})
                        </h3>
                    </div>

                    <div className="max-h-[200px] lg:max-h-[400px] overflow-y-auto rounded-xl border border-white/5 bg-black/20 p-2 lg:p-4">
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3">
                            <AnimatePresence>
                                {pool.map(player => (
                                    <PlayerCard
                                        key={player.id || player.player_id}
                                        player={player}
                                        onClick={() => onPick(player)}
                                        disabled={!canPick}
                                        layoutId={player.id || player.player_id}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>

                        {pool.length === 0 && (
                            <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
                                All players picked
                            </div>
                        )}
                    </div>

                    {canPick && (
                        <p className="text-center text-green-400 text-xs lg:text-sm mt-2 animate-pulse">
                            👆 Tap a player to pick them for your team!
                        </p>
                    )}
                </div>

                {/* Team Bravo */}
                <div className="lg:col-span-3 order-3">
                    <div className="flex items-center justify-between px-2 mb-2 lg:mb-3 flex-row-reverse lg:flex-row-reverse">
                        <h3 className="text-red-400 font-bold tracking-widest uppercase text-xs lg:text-sm flex items-center gap-2">
                            Team Bravo
                            <span className="w-1.5 h-6 lg:w-2 lg:h-8 bg-red-500 rounded-full" />
                        </h3>
                        <span className="text-xs text-red-400/60 font-mono">{teamB.length}/5</span>
                    </div>

                    <Card className="bg-black/20 border-red-500/10 p-2 lg:p-3 space-y-2 min-h-[120px] lg:min-h-[300px]">
                        <PlayerCard player={captainB} isCaptain isTurn={currentTurn === 'captainB'} teamColor="bravo" />

                        <AnimatePresence mode='popLayout'>
                            {teamB.filter(p => p.id !== captainB.id && p.player_id !== captainB.player_id).map(player => (
                                <PlayerCard key={player.id || player.player_id} player={player} teamColor="bravo" layoutId={player.id || player.player_id} />
                            ))}
                        </AnimatePresence>

                        {Array.from({ length: Math.max(0, 5 - teamB.length) }).map((_, i) => (
                            <div key={`empty-b-${i}`} className="h-12 lg:h-14 border border-dashed border-red-500/20 rounded-xl flex items-center justify-center bg-red-500/5">
                                <UserPlus className="w-4 h-4 lg:w-5 lg:h-5 text-red-500/20" />
                            </div>
                        ))}
                    </Card>
                </div>
            </div>
        </div>
    );
};
