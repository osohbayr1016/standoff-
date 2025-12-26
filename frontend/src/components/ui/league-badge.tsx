import { cn } from "@/lib/utils";

export type LeagueTier = 'bronze' | 'silver' | 'gold';

interface LeagueBadgeProps {
    elo: number;
    className?: string;
    showLabel?: boolean;
}

export function getLeagueTier(elo: number): LeagueTier {
    if (elo >= 1600) return 'gold';
    if (elo >= 1200) return 'silver';
    return 'bronze';
}

export function getLeagueTierLabel(tier: LeagueTier): string {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function LeagueBadge({ elo, className, showLabel = false }: LeagueBadgeProps) {
    const tier = getLeagueTier(elo);
    const label = getLeagueTierLabel(tier);

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <img
                src={`/ranks/${tier}.png`}
                alt={`${label} League`}
                className="h-8 w-8 object-contain"
            />
            {showLabel && (
                <span className="text-sm font-semibold text-muted-foreground">
                    {label}
                </span>
            )}
        </div>
    );
}
