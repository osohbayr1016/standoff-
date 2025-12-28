import { ELO_THRESHOLDS, getLevelFromElo } from './LevelBadge';
import { cn } from "@/lib/utils";

interface EloProgressBarProps {
    elo: number;
    className?: string;
    averageElo?: number;
    totalMatches?: number;
}

const EloProgressBar: React.FC<EloProgressBarProps> = ({ elo, className, averageElo = 1245, totalMatches = 0 }) => {
    const currentLevel = getLevelFromElo(elo);
    const nextThreshold = ELO_THRESHOLDS.find(t => t.level === currentLevel + 1);

    // Calculate ELO needed for next rank
    const eloNeeded = nextThreshold ? Math.max(0, nextThreshold.min - elo) : 0;

    // Calculate overall progress across all levels (0 to 100%)
    // This is for the continuous bar if we wanted one, but for segmented we just light up segments
    // However, the user wants a segmented bar.

    return (
        <div className={cn("w-full bg-[#1e2024] rounded-xl overflow-hidden shadow-2xl font-sans", className)}>
            {/* Top Section: Main Stats */}
            <div className="p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-10 relative overflow-hidden">
                {/* Background ambient glow */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#ff5500]/5 via-transparent to-transparent pointer-events-none" />

                {/* Left: Skill Level Circular Indicator */}
                <div className="flex items-center gap-8 relative z-10">
                    <div className="relative">
                        {/* Circular Progress Gauge (Static full ring for aesthetic, could be dynamic) */}
                        <div className="w-32 h-32 md:w-36 md:h-36 rounded-full border-4 border-[#2d2f33] relative flex items-center justify-center bg-[#181a1e]">
                            <svg className="absolute inset-0 w-full h-full -rotate-90 text-[#ff5500]" viewBox="0 0 100 100">
                                <circle
                                    className="text-[#2d2f33]"
                                    strokeWidth="4"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r="46"
                                    cx="50"
                                    cy="50"
                                />
                                <circle
                                    className="text-[#ff5500] drop-shadow-[0_0_10px_rgba(255,85,0,0.5)]"
                                    strokeWidth="4"
                                    strokeDasharray={`${(elo / 3000) * 289} 289`}
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r="46"
                                    cx="50"
                                    cy="50"
                                />
                            </svg>

                            {/* Rank Image */}
                            <img
                                src={`/ranks/${currentLevel}.png`}
                                alt={`Level ${currentLevel}`}
                                className="w-20 h-20 md:w-24 md:h-24 object-contain drop-shadow-2xl z-10"
                            />
                        </div>

                        {/* Level Badge Overlay */}
                        <div className="absolute -bottom-2 -right-2 bg-[#ff5500] text-black w-10 h-10 flex items-center justify-center rounded-sm skew-x-[-10deg] shadow-[0_4px_10px_rgba(0,0,0,0.5)] z-20">
                            <span className="font-black text-xl skew-x-[10deg]">{currentLevel}</span>
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <span className="text-[#9ca3af] font-bold tracking-widest text-xs uppercase mb-1">Skill Level</span>
                        <span className="text-white font-black text-5xl md:text-6xl italic tracking-tighter">
                            LEVEL {currentLevel}
                        </span>
                    </div>
                </div>

                {/* Right: Massive ELO Score */}
                <div className="text-center md:text-right relative z-10">
                    <div className="flex flex-col items-center md:items-end">
                        <div className="flex items-baseline gap-2">
                            <span className="text-7xl md:text-8xl font-black text-white tracking-tighter drop-shadow-lg">
                                {elo.toLocaleString()}
                            </span>
                            <span className="text-2xl font-black text-[#ff5500] uppercase italic tracking-tighter self-start mt-4">
                                ELO
                            </span>
                        </div>

                        {nextThreshold ? (
                            <div className="bg-[#121418] px-4 py-2 rounded flex items-center gap-3 mt-2 border border-white/5">
                                <span className="text-[#9ca3af] text-[10px] font-bold uppercase tracking-widest">
                                    Elo needed for next rank
                                </span>
                                <span className="text-[#ff5500] font-black text-xl">{eloNeeded}</span>
                            </div>
                        ) : (
                            <div className="bg-[#121418] px-4 py-2 rounded flex items-center gap-3 mt-2 border border-white/5">
                                <span className="text-[#ff5500] text-[10px] font-bold uppercase tracking-widest">
                                    Maximum Rank Achieved
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Section: Segmented Progress Bar & Stats */}
            <div className="bg-[#181a1e] px-8 py-6 border-t border-white/5">

                {/* Segmented Bar */}
                <div className="flex gap-1 h-3 w-full mb-12 mt-4">
                    {ELO_THRESHOLDS.map((threshold) => {
                        const isReached = elo >= threshold.min;
                        // Logic for current segment fill
                        let fillPercentage = 0;

                        if (currentLevel > threshold.level) {
                            fillPercentage = 100;
                        } else if (currentLevel === threshold.level) {
                            if (nextThreshold) {
                                const range = nextThreshold.min - threshold.min;
                                const progress = elo - threshold.min;
                                fillPercentage = (progress / range) * 100;
                            } else {
                                fillPercentage = 100;
                            }
                        }

                        return (
                            <div key={threshold.level} className="flex-1 relative group">
                                {/* Rank Image Above */}
                                <div className={cn(
                                    "absolute -top-10 left-1/2 -translate-x-1/2 transition-all duration-300",
                                    currentLevel === threshold.level ? "scale-125 opacity-100 z-10" : "scale-100 opacity-50 grayscale group-hover:grayscale-0 group-hover:opacity-100"
                                )}>
                                    <img
                                        src={`/ranks/${threshold.level}.png`}
                                        alt={`Lvl ${threshold.level}`}
                                        className="w-8 h-8 object-contain drop-shadow-md"
                                    />
                                </div>

                                {/* Segment Bar */}
                                <div className="h-full bg-[#2d2f33] rounded-sm overflow-hidden relative">
                                    {/* Fill */}
                                    <div
                                        className={cn("h-full transition-all duration-500 ease-out",
                                            isReached ? "bg-[#ff5500]" : "bg-transparent"
                                        )}
                                        style={{
                                            width: currentLevel === threshold.level ? `${fillPercentage}%` : (currentLevel > threshold.level ? '100%' : '0%')
                                        }}
                                    >
                                        {currentLevel === threshold.level && (
                                            <div className="absolute right-0 top-0 h-full w-2 bg-white/50 blur-[2px]" />
                                        )}
                                    </div>
                                </div>

                                {/* Label below (absolute positioned to be consistent) */}
                                <div className={cn(
                                    "absolute top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold transition-colors duration-300",
                                    currentLevel === threshold.level ? "text-white" : "text-[#555]"
                                )}>
                                    {threshold.min}
                                </div>

                            </div>
                        );
                    })}
                </div>

                {/* Footer Stats */}
                <div className="flex flex-wrap gap-8 items-center pt-2">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-[#ff5500] shadow-[0_0_8px_#ff5500]" />
                        <span className="text-[#9ca3af] text-[10px] font-bold uppercase tracking-widest">Regional Average:</span>
                        <span className="text-white text-sm font-black italic">{averageElo.toLocaleString()} ELO</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-[#5b9bd5]" />
                        <span className="text-[#9ca3af] text-[10px] font-bold uppercase tracking-widest">Total Matches:</span>
                        <span className="text-white text-sm font-black italic">{totalMatches.toLocaleString()}</span>
                    </div>

                    <div className="ml-auto opacity-20 hover:opacity-100 transition-opacity">
                        <span className="text-[9px] font-black text-white uppercase tracking-[0.5em]">PRECISION MATCHMAKING</span>
                    </div>
                </div>
            </div >
        </div >
    );
};

export default EloProgressBar;
