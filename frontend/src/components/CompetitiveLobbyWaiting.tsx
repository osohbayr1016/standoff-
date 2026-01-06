import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Swords, Users, Clock, UserPlus } from 'lucide-react';
import LevelBadge from './LevelBadge';
import { cn } from '@/lib/utils';

interface MatchPlayer {
    player_id: string;
    team: string;
    discord_username?: string;
    discord_avatar?: string;
    elo?: number;
    standoff_nickname?: string;
}

interface CompetitiveLobbyWaitingProps {
    players: MatchPlayer[];
    maxPlayers: number;
    mapName?: string;
    matchType: 'competitive' | 'league';
}

export const CompetitiveLobbyWaiting: React.FC<CompetitiveLobbyWaitingProps> = ({
    players,
    maxPlayers,
    mapName,
    matchType
}) => {
    const emptySlots = maxPlayers - players.length;

    return (
        <div className="w-full min-h-[60vh] flex flex-col gap-6 p-6 relative overflow-hidden rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-purple-500/5 pointer-events-none" />

            {/* Header */}
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="relative z-10 flex flex-col items-center justify-center text-center"
            >
                <div className="flex items-center gap-3 mb-4">
                    <Badge variant="outline" className="px-4 py-1.5 text-lg border-yellow-500/50 text-yellow-500 bg-yellow-500/10 uppercase tracking-widest">
                        <Swords className="w-4 h-4 mr-2" />
                        {matchType === 'league' ? 'League Match' : 'Competitive Match'}
                    </Badge>
                </div>

                {mapName && (
                    <p className="text-muted-foreground text-sm">Map: <span className="text-white font-medium">{mapName}</span></p>
                )}

                <div className="flex items-center gap-2 mt-4 text-2xl font-bold">
                    <Users className="w-6 h-6 text-yellow-500" />
                    <span className={cn("transition-colors", players.length >= maxPlayers ? "text-green-400" : "text-white")}>
                        {players.length} / {maxPlayers}
                    </span>
                </div>

                <p className="text-muted-foreground text-sm mt-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Match will <span className="text-yellow-500 font-semibold">auto-start</span> when full
                </p>
            </motion.div>

            {/* Player Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 relative z-10 max-w-5xl mx-auto w-full">
                {players.map((player, index) => (
                    <motion.div
                        key={player.player_id}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: index * 0.05 }}
                    >
                        <Card className="p-4 bg-white/5 border-white/10 hover:bg-white/10 transition-colors flex flex-col items-center gap-3">
                            <Avatar className="w-16 h-16 border-2 border-yellow-500/30">
                                <AvatarImage src={`https://cdn.discordapp.com/avatars/${player.player_id}/${player.discord_avatar}.png`} />
                                <AvatarFallback className="bg-yellow-500/20 text-yellow-500 text-lg">
                                    {(player.standoff_nickname || player.discord_username || 'P')[0].toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="text-center">
                                <p className="font-semibold text-white truncate max-w-[100px] text-sm">
                                    {player.standoff_nickname || player.discord_username || 'Player'}
                                </p>
                                <LevelBadge elo={player.elo || 1000} showElo className="mt-1 justify-center" />
                            </div>
                        </Card>
                    </motion.div>
                ))}

                {/* Empty Slots */}
                {Array.from({ length: emptySlots }).map((_, i) => (
                    <motion.div
                        key={`empty-${i}`}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 0.5 }}
                        transition={{ delay: (players.length + i) * 0.05 }}
                    >
                        <Card className="p-4 bg-white/5 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 h-full min-h-[140px]">
                            <UserPlus className="w-8 h-8 text-white/20" />
                            <p className="text-xs text-white/30">Waiting...</p>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Footer Note */}
            <div className="text-center text-xs text-muted-foreground mt-4">
                <p>🏆 Top 2 Elo players will be <span className="text-yellow-500">Captains</span> and pick their teams</p>
            </div>
        </div>
    );
};
