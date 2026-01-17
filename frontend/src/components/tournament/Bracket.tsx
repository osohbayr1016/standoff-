
import { Badge } from "@/components/ui/badge";

interface Clan {
    id: string;
    name: string;
    tag: string;
    logo: string | null;
}

interface Match {
    id: string;
    round: number; // 1 = Ro16/Quarters, etc. Higher number = later round? Or inverse?
    // Backend says: 1 = Round 1 (First), 2 = Round 2.
    bracket_match_id: number;
    alpha_clan: Clan | null;
    bravo_clan: Clan | null;
    winner_team: 'alpha' | 'bravo' | null;
    alpha_score: number | null;
    bravo_score: number | null;
    status: string;
}

interface BracketProps {
    matches: Match[];
}

export default function Bracket({ matches }: BracketProps) {
    // Group matches by round
    const rounds = matches.reduce((acc, match) => {
        const r = match.round || 1;
        if (!acc[r]) acc[r] = [];
        acc[r].push(match);
        return acc;
    }, {} as Record<number, Match[]>);

    const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);

    // Determine Round Names based on total rounds
    // If 4 rounds: Ro16, Quarters, Semis, Finals
    // If 3 rounds: Quarters, Semis, Finals
    const totalRounds = roundNumbers.length;

    const getRoundName = (r: number) => {
        const diff = totalRounds - r;
        if (diff === 0) return "Grand Final";
        if (diff === 1) return "Semi Finals";
        if (diff === 2) return "Quarter Finals";
        return `Round ${r}`;
    };

    return (
        <div className="w-full h-full overflow-hidden bg-[#0f1012] p-4 rounded-xl border border-white/5">
            <div className="w-full h-full overflow-x-auto pb-4 custom-scrollbar">
                <div className="flex gap-16 min-w-max px-8 py-8 items-center justify-center">
                    {roundNumbers.map((round, rIndex) => (
                        <div key={round} className="flex flex-col gap-8 justify-center min-w-[280px]">
                            <h3 className="text-center font-bold text-yellow-500/80 mb-4 uppercase tracking-widest text-sm">
                                {getRoundName(round)}
                            </h3>

                            <div className={`flex flex-col justify-around h-full gap-8 ${rIndex > 0 ? 'mt-0' : ''}`}>
                                {rounds[round].sort((a, b) => a.bracket_match_id - b.bracket_match_id).map((match) => (
                                    <div key={match.id} className="relative group">
                                        <MatchCard match={match} />

                                        {/* Connector Lines */}
                                        {rIndex < roundNumbers.length - 1 && (
                                            <div className="absolute right-[-64px] top-1/2 -mt-px w-16 h-[2px] bg-white/5 group-hover:bg-yellow-500/30 transition-colors" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function MatchCard({ match }: { match: Match }) {
    const isCompleted = match.status === 'completed';
    const isLive = match.status === 'in_progress';

    return (
        <div className={`
            w-[280px] bg-[#1a1b1e] border border-white/5 rounded-lg overflow-hidden relative
            transition-all duration-300 hover:border-white/20 hover:shadow-lg hover:shadow-black/50
            ${isLive ? 'ring-1 ring-red-500/50' : ''}
        `}>
            {/* Header / Status */}
            <div className="bg-[#151618] px-3 py-1.5 flex justify-between items-center text-[10px] uppercase tracking-wider text-zinc-500">
                <span>Match #{match.bracket_match_id}</span>
                {isLive && <Badge variant="outline" className="h-4 text-[9px] border-red-500/50 text-red-500 animate-pulse">LIVE</Badge>}
                {isCompleted && <span className="text-zinc-400">Ended</span>}
            </div>

            {/* Teams */}
            <div className="p-0">
                {/* Alpha Team */}
                <div className={`
                    flex items-center justify-between px-4 py-3 border-b border-white/5
                    ${match.winner_team === 'alpha' ? 'bg-gradient-to-r from-yellow-500/10 to-transparent' : ''}
                    ${!match.alpha_clan ? 'opacity-50' : ''}
                `}>
                    <div className="flex items-center gap-3">
                        {match.alpha_clan?.logo ? (
                            <img src={match.alpha_clan.logo} alt="" className="w-8 h-8 rounded object-cover" />
                        ) : (
                            <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center">
                                <span className="text-zinc-500 text-xs">?</span>
                            </div>
                        )}
                        <span className={`font-medium ${match.winner_team === 'alpha' ? 'text-yellow-500' : 'text-zinc-300'}`}>
                            {match.alpha_clan?.name || 'TBD'}
                        </span>
                    </div>
                    <span className={`font-mono font-bold ${match.winner_team === 'alpha' ? 'text-white' : 'text-zinc-600'}`}>
                        {match.alpha_score !== null ? match.alpha_score : '-'}
                    </span>
                </div>

                {/* Bravo Team */}
                <div className={`
                    flex items-center justify-between px-4 py-3
                    ${match.winner_team === 'bravo' ? 'bg-gradient-to-r from-yellow-500/10 to-transparent' : ''}
                    ${!match.bravo_clan ? 'opacity-50' : ''}
                `}>
                    <div className="flex items-center gap-3">
                        {match.bravo_clan?.logo ? (
                            <img src={match.bravo_clan.logo} alt="" className="w-8 h-8 rounded object-cover" />
                        ) : (
                            <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center">
                                <span className="text-zinc-500 text-xs">?</span>
                            </div>
                        )}
                        <span className={`font-medium ${match.winner_team === 'bravo' ? 'text-yellow-500' : 'text-zinc-300'}`}>
                            {match.bravo_clan?.name || 'TBD'}
                        </span>
                    </div>
                    <span className={`font-mono font-bold ${match.winner_team === 'bravo' ? 'text-white' : 'text-zinc-600'}`}>
                        {match.bravo_score !== null ? match.bravo_score : '-'}
                    </span>
                </div>
            </div>
        </div>
    );
}
