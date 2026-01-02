import React from 'react';
import { Trophy, Coins, Crown, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface RewardTierProps {
    rank: 1 | 2 | 3;
    amount: number;
    label: string;
}

const RewardTier: React.FC<RewardTierProps> = ({ rank, amount, label }) => {
    const getStyles = (rank: number) => {
        switch (rank) {
            case 1:
                return {
                    container: "bg-gradient-to-b from-[#FFD700]/20 to-[#FFD700]/5 border-[#FFD700]/30 shadow-[0_0_15px_rgba(255,215,0,0.15)]",
                    icon: "text-[#FFD700] drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]",
                    text: "text-[#FFD700]",
                    badge: "bg-[#FFD700] text-black",
                    border: "border-[#FFD700]/50"
                };
            case 2:
                return {
                    container: "bg-gradient-to-b from-[#C0C0C0]/20 to-[#C0C0C0]/5 border-[#C0C0C0]/30 shadow-[0_0_15px_rgba(192,192,192,0.1)]",
                    icon: "text-[#C0C0C0] drop-shadow-[0_0_8px_rgba(192,192,192,0.5)]",
                    text: "text-[#C0C0C0]",
                    badge: "bg-[#C0C0C0] text-black",
                    border: "border-[#C0C0C0]/50"
                };
            case 3:
                return {
                    container: "bg-gradient-to-b from-[#CD7F32]/20 to-[#CD7F32]/5 border-[#CD7F32]/30 shadow-[0_0_15px_rgba(205,127,50,0.1)]",
                    icon: "text-[#CD7F32] drop-shadow-[0_0_8px_rgba(205,127,50,0.5)]",
                    text: "text-[#CD7F32]",
                    badge: "bg-[#CD7F32] text-black",
                    border: "border-[#CD7F32]/50"
                };
            default:
                return {
                    container: "bg-zinc-900",
                    icon: "text-white",
                    text: "text-white",
                    badge: "bg-white text-black",
                    border: "border-white/10"
                };
        }
    };

    const styles = getStyles(rank);

    return (
        <div className={cn(
            "relative group overflow-hidden rounded-xl border p-4 transition-all duration-300 hover:scale-[1.02]",
            styles.container,
            styles.border
        )}>
            {/* Background Glow Effect */}
            <div className={cn(
                "absolute -right-4 -top-4 h-24 w-24 rounded-full blur-3xl opacity-20",
                styles.icon.split(' ')[0].replace('text-', 'bg-')
            )} />

            <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className={cn(
                            "flex h-12 w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border",
                            styles.border
                        )}>
                            {rank === 1 ? (
                                <Crown className={cn("h-6 w-6 animate-pulse", styles.icon)} />
                            ) : (
                                <Trophy className={cn("h-6 w-6", styles.icon)} />
                            )}
                        </div>
                        <div className={cn(
                            "absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shadow-sm",
                            styles.badge
                        )}>
                            #{rank}
                        </div>
                    </div>

                    <div>
                        <div className={cn("text-xs font-bold uppercase tracking-widest opacity-80", styles.text)}>
                            {label}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <Coins className={cn("h-4 w-4", styles.text)} />
                            <span className={cn("text-xl font-black font-display tracking-tight", styles.text)}>
                                {amount.toLocaleString()} <span className="text-xs ml-0.5 opacity-70">GOLD</span>
                            </span>
                        </div>
                    </div>
                </div>

                {rank === 1 && (
                    <Sparkles className="h-5 w-5 text-[#FFD700] animate-spin-slow opacity-50" />
                )}
            </div>
        </div>
    );
};

const RewardsCard = () => {
    return (
        <Card className="bg-zinc-950/50 backdrop-blur-sm border-white/10 overflow-hidden">
            <div className="p-6 relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Crown className="h-5 w-5 text-[#FFD700]" />
                            Weekly Rewards
                        </h2>
                        <p className="text-sm text-zinc-400 mt-1">
                            Top 3 players receive GOLD prizes every week
                        </p>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-[#ff5500]/10 border border-[#ff5500]/20 text-[#ff5500] text-xs font-bold uppercase tracking-wider animate-pulse">
                        Active Pool
                    </div>
                </div>

                {/* Rewards List */}
                <div className="grid gap-3">
                    <RewardTier rank={1} amount={1500} label="Champion" />
                    <RewardTier rank={2} amount={1000} label="Runner Up" />
                    <RewardTier rank={3} amount={500} label="Third Place" />
                </div>

                {/* Footer Info */}
                <div className="mt-4 pt-4 border-t border-white/5 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                        <div>
                            Resets every Sunday at 00:00 UTC
                        </div>
                        <div className="flex items-center gap-1">
                            Total Pool: <span className="text-white font-bold">3,000 GOLD</span>
                        </div>
                    </div>
                    <div className="text-center text-xs text-zinc-600 bg-zinc-900/50 py-1.5 rounded-lg border border-white/5">
                        Sponsored by <a href="https://daisuke.mn/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline hover:text-primary/80 font-bold">daisuke.mn</a>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default RewardsCard;
