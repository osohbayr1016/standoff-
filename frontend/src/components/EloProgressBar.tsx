import React from 'react';
import { ELO_THRESHOLDS, getLevelFromElo } from './LevelBadge';
import { cn } from "@/lib/utils";

interface EloProgressBarProps {
    elo: number;
    className?: string;
}

const EloProgressBar: React.FC<EloProgressBarProps> = ({ elo, className }) => {
    const currentLevel = getLevelFromElo(elo);
    const currentThreshold = ELO_THRESHOLDS.find(t => t.level === currentLevel) || ELO_THRESHOLDS[0];
    const nextThreshold = ELO_THRESHOLDS.find(t => t.level === currentLevel + 1);

    // Calculate total progress from 0 (Level 1 start) to Max (Level 10 start)
    // We treat Level 10 start (2001) as 100% for the bar visual
    const minElo = ELO_THRESHOLDS[0].min; // 100
    const maxElo = ELO_THRESHOLDS[8].max; // 2000 (End of Level 9 / Start of Level 10)

    // Cap progress at 100% if over 2001
    const totalProgressPercent = Math.min(100, Math.max(0, ((elo - minElo) / (maxElo - minElo)) * 100));

    const eloNeeded = nextThreshold ? nextThreshold.min - elo : 0;

    // Circular Progress Calculation for Header (Current Level Only)
    // Progress within the current level bucket
    let levelProgress = 0;
    if (nextThreshold) {
        levelProgress = Math.max(0, Math.min(1, (elo - currentThreshold.min) / (nextThreshold.min - currentThreshold.min)));
    } else {
        levelProgress = 1;
    }

    const radius = 32;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (levelProgress * circumference);

    return (
        <div className={cn("w-full bg-[#1e1e1e] rounded-xl border border-white/5 p-6 animate-fade-in font-sans", className)}>
            {/* Top Section */}
            <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-6">
                    {/* Ring Chart with Icon */}
                    <div className="relative h-20 w-20 flex items-center justify-center">
                        {/* SVG Ring */}
                        <svg className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-[0_0_15px_rgba(255,85,0,0.3)]" viewBox="0 0 80 80">
                            {/* Track */}
                            <circle
                                cx="40" cy="40" r={radius}
                                fill="none"
                                stroke="#2a2a2a"
                                strokeWidth="6"
                            />
                            {/* Progress */}
                            <circle
                                cx="40" cy="40" r={radius}
                                fill="none"
                                stroke="#ff5500" // Faceit Orange
                                strokeWidth="6"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                className="transition-all duration-1000 ease-out"
                            />
                        </svg>

                        {/* Level Image */}
                        <img
                            src={`/ranks/${currentLevel}.png`}
                            alt={`Level ${currentLevel}`}
                            className="h-9 w-9 object-contain relative z-10"
                        />
                    </div>

                    <div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-black font-display tracking-tighter text-white">
                                {elo.toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Elo Needed */}
                {nextThreshold ? (
                    <div className="text-right">
                        <div className="text-4xl font-bold font-display text-white">{eloNeeded}</div>
                        <div className="text-[10px] text-[#888] uppercase tracking-widest font-bold mt-1">ELO NEEDED TO NEXT RANK</div>
                    </div>
                ) : (
                    <div className="text-right">
                        <div className="text-3xl font-black font-display text-[#ff5500] flex items-center justify-end gap-2">
                            MAX RANK
                        </div>
                        <div className="text-[10px] text-[#ff5500]/60 uppercase tracking-widest font-bold mt-1">TOP REGION</div>
                    </div>
                )}
            </div>

            {/* Progress Bar Container */}
            <div className="relative pt-4 pb-2 px-2">
                {/* Main Line Background */}
                <div className="absolute top-[19px] left-0 right-0 h-1 bg-[#2a2a2a] rounded-full -z-0" />

                {/* Main Line Progress (All Orange) */}
                <div
                    className="absolute top-[19px] left-0 h-1 bg-[#ff5500] rounded-full -z-0 transition-all duration-1000 shadow-[0_0_10px_#ff5500]"
                    style={{ width: `${totalProgressPercent}%` }}
                />

                {/* Levels Strip */}
                <div className="flex justify-between items-start relative z-10 w-full">
                    {ELO_THRESHOLDS.map((threshold) => {
                        const isPastOrCurrent = threshold.level <= currentLevel;
                        const isCurrent = threshold.level === currentLevel;

                        // Calculate position roughly for the text, though flex-between handles spacing well
                        return (
                            <div key={threshold.level} className="flex flex-col items-center group relative w-8">
                                {/* Dot on the line */}
                                <div className={cn(
                                    "w-3 h-3 rounded-full border-2 transition-all duration-500 mb-4 z-20",
                                    isPastOrCurrent
                                        ? "bg-[#1e1e1e] border-[#ff5500]" // Orange border, dark fill for active
                                        : "bg-[#2a2a2a] border-transparent" // Dark for inactive
                                )}>
                                    {isCurrent && (
                                        <div className="absolute inset-0 bg-[#ff5500] rounded-full animate-ping opacity-20" />
                                    )}
                                </div>

                                {/* Level Image (Faded if not current) */}
                                <div className={cn(
                                    "transition-all duration-300 absolute -top-8",
                                    isCurrent ? "opacity-100 scale-125 -translate-y-1" : "opacity-0 group-hover:opacity-100"
                                )}>
                                    {/* Only show image on hover or if current, to keep it clean like faceit often does, or show small? 
                                         Creating specific look: Faceit shows numbers below line. 
                                     */}
                                    <img
                                        src={`/ranks/${threshold.level}.png`}
                                        alt={`Lvl ${threshold.level}`}
                                        className="h-6 w-6 object-contain"
                                    />
                                </div>

                                {/* Min ELO Text below line */}
                                <span className={cn(
                                    "text-[10px] font-bold font-mono transition-colors mt-1",
                                    isCurrent ? "text-white scale-110" : "text-[#555]",
                                    threshold.level === 10 && "text-[#ff5500]"
                                )}>
                                    {threshold.min}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default EloProgressBar;
