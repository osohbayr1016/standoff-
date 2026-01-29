import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

interface Match {
    id: string;
    round: number;
    bracket_match_id: number;
    alpha_clan?: { id: string; tag: string; logo?: string };
    bravo_clan?: { id: string; tag: string; logo?: string };
    winner_team?: 'alpha' | 'bravo';
    alpha_score?: number;
    bravo_score?: number;
    status: string;
}

interface TournamentBracketProps {
    matches: Match[];
    onManageMatch?: (matchId: string, team: 'alpha' | 'bravo') => void;
    onEditMatch?: (match: Match) => void;
}

export default function TournamentBracket({ matches, onManageMatch, onEditMatch }: TournamentBracketProps) {
    // Group matches by round
    const rounds: { [key: number]: Match[] } = {};

    matches.forEach(m => {
        const rVal = m.round;
        const r = typeof rVal === 'number' ? rVal : parseInt(rVal as any);
        if (isNaN(r) || !r) return;
        if (!rounds[r]) rounds[r] = [];
        rounds[r].push(m);
    });

    const round1Count = rounds[1]?.length || 0;
    const totalRounds = round1Count > 0 ? Math.ceil(Math.log2(round1Count)) + 1 : 1;

    const getMatch = (round: number, matchIndex: number) => {
        const matchId = matchIndex + 1;
        return rounds[round]?.find(m => m.bracket_match_id === matchId);
    };

    return (
        <div className="flex gap-16 overflow-x-auto p-12 min-w-[800px] items-stretch">
            {Array.from({ length: totalRounds }, (_, i) => i + 1).map(roundNum => {
                const matchCount = Math.ceil(round1Count / Math.pow(2, roundNum - 1));

                return (
                    <div key={roundNum} className="flex flex-col justify-around flex-1 relative gap-8">
                        <h3 className="text-center font-bold text-zinc-500 uppercase tracking-wider mb-4 absolute -top-10 w-full text-sm">
                            {roundNum === totalRounds ? 'Grand Final' :
                                roundNum === totalRounds - 1 ? 'Semi Finals' :
                                    `Round ${roundNum}`}
                        </h3>

                        {Array.from({ length: matchCount }).map((_, idx) => {
                            const match = getMatch(roundNum, idx);
                            return (
                                <div key={`${roundNum}-${idx}`} className="relative flex items-center group justify-center">
                                    <div className="relative z-10">
                                        {match ? (
                                            <MatchCard
                                                match={match}
                                                onManage={onManageMatch ? (team) => onManageMatch(match.id, team) : undefined}
                                                onEdit={onEditMatch ? () => onEditMatch(match) : undefined}
                                            />
                                        ) : (
                                            <PlaceholderCard />
                                        )}
                                    </div>
                                    {roundNum < totalRounds && (
                                        <div className="absolute right-0 translate-x-full w-8 h-[2px] bg-white/10 hidden md:block" style={{
                                            right: '-32px', width: '32px'
                                        }}></div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}

function PlaceholderCard() {
    return (
        <Card className="w-64 bg-zinc-900/30 border-white/5 border-dashed relative z-10 opacity-50">
            <div className="p-3 space-y-2">
                <div className="flex justify-between items-center text-xs text-zinc-700 mb-1">
                    <span>TBD</span>
                    <Badge variant="outline" className="text-[10px] h-4 border-white/5 text-zinc-700">Waiting</Badge>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-black/20">
                    <span className="font-bold text-zinc-600">TBD</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-black/20">
                    <span className="font-bold text-zinc-600">TBD</span>
                </div>
            </div>
        </Card>
    )
}

function MatchCard({ match, onManage, onEdit }: { match: Match, onManage?: (team: 'alpha' | 'bravo') => void, onEdit?: () => void }) {
    return (
        <Card className="w-64 bg-zinc-900 border-white/10 relative z-10 group/card">
            <div className="p-3 space-y-2">
                <div className="flex justify-between items-center text-xs text-zinc-500 mb-1">
                    <span>Match {match.bracket_match_id}</span>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] h-4 border-white/5">{match.status}</Badge>
                        {onEdit && (
                            <Button size="icon" variant="ghost" className="h-4 w-4 text-zinc-600 hover:text-white opacity-0 group-hover/card:opacity-100 transition-opacity" onClick={onEdit} title="Edit Match (Mod Only)">
                                <Settings className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Alpha Team */}
                <div className={`flex justify-between items-center p-2 rounded ${match.winner_team === 'alpha' ? 'bg-green-500/10 text-green-400' : 'bg-black/20'}`}>
                    <div className="flex items-center gap-2 overflow-hidden">
                        {match.alpha_clan?.logo ? (
                            <img src={match.alpha_clan.logo} alt="" className="w-6 h-6 rounded object-cover" />
                        ) : (
                            <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-[8px] font-bold text-zinc-500">
                                {match.alpha_clan?.tag?.[0] || '?'}
                            </div>
                        )}
                        <span className="font-bold truncate max-w-[80px] text-sm">{match.alpha_clan?.tag || 'TBD'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm">{match.alpha_score ?? 0}</span>
                        {onManage && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 text-zinc-600 hover:text-white"
                                onClick={() => onManage('alpha')}
                                disabled={!!match.winner_team}
                                title="Force Win"
                            >W</Button>
                        )}
                    </div>
                </div>

                {/* Bravo Team */}
                <div className={`flex justify-between items-center p-2 rounded ${match.winner_team === 'bravo' ? 'bg-green-500/10 text-green-400' : 'bg-black/20'}`}>
                    <div className="flex items-center gap-2 overflow-hidden">
                        {match.bravo_clan?.logo ? (
                            <img src={match.bravo_clan.logo} alt="" className="w-6 h-6 rounded object-cover" />
                        ) : (
                            <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-[8px] font-bold text-zinc-500">
                                {match.bravo_clan?.tag?.[0] || '?'}
                            </div>
                        )}
                        <span className="font-bold truncate max-w-[80px] text-sm">{match.bravo_clan?.tag || 'TBD'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm">{match.bravo_score ?? 0}</span>
                        {onManage && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 text-zinc-600 hover:text-white"
                                onClick={() => onManage('bravo')}
                                disabled={!!match.winner_team}
                                title="Force Win"
                            >W</Button>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
}
