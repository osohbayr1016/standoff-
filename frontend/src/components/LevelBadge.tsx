import React from 'react';
import { cn } from "@/lib/utils";

interface LevelBadgeProps {
    elo: number;
    className?: string;
    showElo?: boolean;
}

export const ELO_THRESHOLDS = [
    { level: 1, min: 0, max: 800 },
    { level: 2, min: 801, max: 950 },
    { level: 3, min: 951, max: 1100 },
    { level: 4, min: 1101, max: 1250 },
    { level: 5, min: 1251, max: 1400 },
    { level: 6, min: 1401, max: 1550 },
    { level: 7, min: 1551, max: 1700 },
    { level: 8, min: 1701, max: 1850 },
    { level: 9, min: 1851, max: 2000 },
    { level: 10, min: 2001, max: Infinity }
];

export const getLevelFromElo = (elo: number): number => {
    const threshold = ELO_THRESHOLDS.find(t => elo >= t.min && elo <= t.max);
    return threshold ? threshold.level : 10;
};

const LevelBadge: React.FC<LevelBadgeProps> = ({ elo, className, showElo = false }) => {
    const level = getLevelFromElo(elo);

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <img
                src={`/ranks/${level}.png`}
                alt={`Level ${level}`}
                className="h-6 w-6 object-contain"
                onError={(e) => {
                    // Fallback to text if image fails (e.g. hasn't been uploaded yet)
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement?.classList.add('fallback-text');
                }}
            />
            <span className="fallback-hidden font-bold text-xs bg-zinc-800 px-1.5 py-0.5 rounded text-white" style={{ display: 'none' }}>
                Lvl {level}
            </span>
            {showElo && <span className="font-mono font-bold text-sm text-muted-foreground">{elo}</span>}
        </div>
    );
};

export default LevelBadge;
