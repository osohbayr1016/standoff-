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

    // Calculate ELO needed for next rank
    const eloNeeded = nextThreshold ? Math.max(0, nextThreshold.min - elo) : 0;

    // Calculate progress within current level (0 to 1)
    let levelProgress = 0;
    if (nextThreshold) {
        const range = nextThreshold.min - currentThreshold.min;
        const progress = elo - currentThreshold.min;
        levelProgress = Math.max(0, Math.min(1, progress / range));
    } else {
        levelProgress = 1; // Max level
    }

    // Calculate total progress for horizontal bar (from 100 to 2001)
    const minElo = 100;
    const maxElo = 2001;
    const totalProgress = Math.min(100, Math.max(0, ((elo - minElo) / (maxElo - minElo)) * 100));

    // Get color for rank segments
    const getRankColor = (level: number): string => {
        if (level <= 3) return '#22c55e'; // Green
        if (level <= 5) return '#eab308'; // Yellow
        if (level <= 9) return '#f97316'; // Orange
        return '#ef4444'; // Red
    };

    // Calculate position percentage for each threshold (equal spacing)
    const getPosition = (index: number): number => {
        // Equal spacing: divide 100% by number of thresholds
        return (index / (ELO_THRESHOLDS.length - 1)) * 100;
    };

    // Calculate line and gap dimensions for 10 lines with gaps - All exactly the same size
    const gapWidth = 0.3; // Small black gap between lines (in %)
    const totalGapWidth = gapWidth * (ELO_THRESHOLDS.length - 1); // Total width of all gaps (9 gaps = 2.7%)
    const availableWidth = 100 - totalGapWidth; // Available width for lines (97.3%)
    const lineWidth = availableWidth / ELO_THRESHOLDS.length; // Width of each line - All 10 lines exactly same size (9.73%)

    return (
        <div className={cn("w-full bg-[#1e1e1e] rounded-xl border border-white/5 p-4 sm:p-6 md:p-8", className)}>
            {/* Top Section: Rank Circle, ELO, and ELO Needed */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 mb-6 sm:mb-8 md:mb-12">
                {/* Left Side: Rank Circle + ELO Number */}
                <div className="flex items-center gap-4 sm:gap-6 md:gap-8 flex-1 min-w-0">
                    {/* Large Rank Image */}
                    <div className="relative flex-shrink-0">
                        <img
                            src={`/ranks/${currentLevel}.png`}
                            alt={`Rank ${currentLevel}`}
                            className="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 lg:h-32 lg:w-32 object-contain"
                        />
                    </div>

                    {/* Large ELO Number */}
                    <div className="min-w-0">
                        <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black font-display tracking-tighter text-white">
                            {elo.toLocaleString()}
                        </div>
                    </div>
                </div>

                {/* Right Side: ELO Needed */}
                {nextThreshold ? (
                    <div className="text-left sm:text-right flex-shrink-0">
                        <div className="text-2xl sm:text-3xl md:text-4xl font-bold font-display text-white mb-1">
                            {eloNeeded}
                        </div>
                        <div className="text-[9px] sm:text-[10px] md:text-xs text-[#888] uppercase tracking-widest font-bold leading-tight">
                            Elo needed to next skill rank
                        </div>
                    </div>
                ) : (
                    <div className="text-left sm:text-right flex-shrink-0">
                        <div className="text-xl sm:text-2xl md:text-3xl font-black font-display text-[#ef4444]">
                            MAX RANK
                        </div>
                        <div className="text-[9px] sm:text-[10px] md:text-xs text-[#ef4444]/60 uppercase tracking-widest font-bold mt-1">
                            TOP REGION
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Section: Rank Progression Bar with Dashed Lines */}
            <div className="relative w-full overflow-hidden">
                <div className="relative w-full px-2 sm:px-4" style={{ paddingTop: '20px', paddingBottom: '40px', minHeight: '120px' }}>
                        {/* Rank Images - Placed Above Dashed Line */}
                        <div className="relative flex justify-between items-start w-full" style={{ marginBottom: '15px' }}>
                            {ELO_THRESHOLDS.map((threshold, index) => {
                                const isCurrent = threshold.level === currentLevel;
                                const position = getPosition(index);

                                return (
                                    <div
                                        key={threshold.level}
                                        className="absolute flex flex-col items-center"
                                        style={{ 
                                            left: `${position}%`, 
                                            transform: 'translateX(-50%)',
                                            top: '0px'
                                        }}
                                    >
                                        {/* Rank Image - Full Color, No Filters, No Progress Circle - All Exactly Same Size */}
                                        <div className="relative mb-2 flex items-center justify-center" style={{ width: '48px', height: '48px', flexShrink: 0 }}>
                                            <img
                                                src={`/ranks/${threshold.level}.png`}
                                                alt={`Rank ${threshold.level}`}
                                                className="object-contain"
                                                style={{ 
                                                    width: '48px', 
                                                    height: '48px',
                                                    display: 'block',
                                                    flexShrink: 0
                                                }}
                                            />
                                        </div>

                                        {/* ELO Threshold Number Below Image */}
                                        <span 
                                            className={cn(
                                                "font-bold font-mono whitespace-nowrap transition-colors",
                                                "text-[10px] sm:text-xs md:text-sm",
                                                "mt-1",
                                                isCurrent 
                                                    ? "text-white scale-110" 
                                                    : "text-[#888]"
                                            )}
                                        >
                                            {threshold.min}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* 10 Individual Lines with Gaps - Each Line Centered on Rank Image - All Same Size */}
                        <div className="absolute left-0 right-0" style={{ top: '70px' }}>
                            <div className="relative w-full h-0.5 sm:h-1">
                                {ELO_THRESHOLDS.map((threshold, index) => {
                                    const isPast = threshold.level < currentLevel;
                                    const isCurrent = threshold.level === currentLevel;
                                    const rankPosition = getPosition(index);
                                    const segmentColor = getRankColor(threshold.level);
                                    
                                    // Calculate line start position (centered on rank image) - All lines same size
                                    const lineStart = rankPosition - (lineWidth / 2);
                                    
                                    // Calculate filled width for current segment
                                    let filledWidth = 0;
                                    if (isPast) {
                                        filledWidth = lineWidth; // Fully filled
                                    } else if (isCurrent) {
                                        const nextThresh = ELO_THRESHOLDS[index + 1];
                                        if (nextThresh) {
                                            const progressInSegment = (elo - threshold.min) / (nextThresh.min - threshold.min);
                                            filledWidth = lineWidth * Math.max(0, Math.min(1, progressInSegment));
                                        }
                                    }
                                    
                                    return (
                                        <React.Fragment key={threshold.level}>
                                            {/* Base solid line (background) - All exactly same size */}
                                            <div
                                                className="absolute h-full bg-[#2a2a2a]"
                                                style={{
                                                    left: `${lineStart}%`,
                                                    width: `${lineWidth}%`,
                                                    minWidth: 0,
                                                    maxWidth: 'none'
                                                }}
                                            />
                                            {/* Colored progress line */}
                                            {filledWidth > 0 && (
                                                <div
                                                    className="absolute h-full bg-[currentColor] transition-all duration-1000"
                                                    style={{
                                                        left: `${lineStart}%`,
                                                        width: `${filledWidth}%`,
                                                        color: segmentColor,
                                                    }}
                                                />
                                            )}
                                            {/* Gap after line (except for last one) */}
                                            {index < ELO_THRESHOLDS.length - 1 && (
                                                <div
                                                    className="absolute h-full bg-[#1e1e1e]"
                                                    style={{
                                                        left: `${lineStart + lineWidth}%`,
                                                        width: `${gapWidth}%`,
                                                    }}
                                                />
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
            </div>
        </div>
    );
};

export default EloProgressBar;
