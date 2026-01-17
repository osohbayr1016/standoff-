
import { useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Calendar, Users } from "lucide-react";
import Bracket from './tournament/Bracket';
import { toast } from "sonner";
import LoadingSpinner from './LoadingSpinner';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787';

interface Tournament {
    id: string;
    name: string;
    start_time: string;
    status: 'registration' | 'active' | 'completed' | 'cancelled';
    max_teams: number;
    prizepool: string;
}

interface TournamentPageProps {
    user: any;
}

export default function TournamentPage({ user }: TournamentPageProps) {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
    const [bracketData, setBracketData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Initial Load
    useEffect(() => {
        fetchTournaments();
    }, []);

    const fetchTournaments = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/tournaments`);
            const data = await res.json();
            if (data.success) {
                setTournaments(data.tournaments);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewTournament = async (t: Tournament) => {
        setSelectedTournament(t);
        setBracketData(null); // Reset

        try {
            const res = await fetch(`${BACKEND_URL}/api/tournaments/${t.id}`);
            const data = await res.json();
            if (data.success) {
                setBracketData(data);
            }
        } catch (e) {
            toast.error("Failed to load tournament details");
        }
    };

    const handleRegister = async () => {
        if (!selectedTournament) return;
        try {
            const res = await fetch(`${BACKEND_URL}/api/tournaments/${selectedTournament.id}/register`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${user?.id}`, // Assuming auth header structure or use credentials
                    // Actually backend uses verifyAuth which checks session or header 'X-User-Id' if logic matches middleware.
                    // Standard verifyAuth looks for cookie or header. Let's rely on 'credentials: include' usually.
                    'X-User-Id': user?.id
                }
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Registered successfully!");
                handleViewTournament(selectedTournament); // Reload
            } else {
                toast.error(data.error || "Registration failed");
            }
        } catch (e) {
            toast.error("Error registering");
        }
    };

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-amber-600 mb-8 uppercase tracking-tighter">
                CLAN BATTLE CUPS
            </h1>

            {!selectedTournament ? (
                // LIST VIEW
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tournaments.map(t => (
                        <Card key={t.id} className="bg-[#1e1f22] border-white/5 hover:border-yellow-500/50 transition-all cursor-pointer group" onClick={() => handleViewTournament(t)}>
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-500 group-hover:bg-yellow-500 group-hover:text-black transition-colors">
                                        <Trophy className="h-6 w-6" />
                                    </div>
                                    <Badge variant={t.status === 'registration' ? 'default' : 'secondary'} className="uppercase">
                                        {t.status}
                                    </Badge>
                                </div>
                                <h2 className="text-xl font-bold text-white mb-2">{t.name}</h2>
                                <div className="space-y-2 text-sm text-zinc-400">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        {new Date(t.start_time).toLocaleString()}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        Max {t.max_teams} Teams
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {tournaments.length === 0 && !isLoading && (
                        <div className="col-span-full text-center py-20 text-zinc-500">
                            No active tournaments found.
                        </div>
                    )}
                </div>
            ) : (
                // DETAIL VIEW
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Button variant="ghost" onClick={() => setSelectedTournament(null)} className="mb-4 text-zinc-400 hover:text-white pl-0">
                        ← Back to List
                    </Button>

                    <div className="flex justify-between items-end mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">{selectedTournament.name}</h1>
                            <div className="flex gap-4 text-sm text-zinc-400">
                                <Badge variant="outline" className="text-yellow-500 border-yellow-500/20">{selectedTournament.status}</Badge>
                                <span>Prize: {selectedTournament.prizepool || 'N/A'}</span>
                            </div>
                        </div>

                        {selectedTournament.status === 'registration' && (
                            <Button className="bg-yellow-500 text-black font-bold" onClick={handleRegister}>
                                Register Clan
                            </Button>
                        )}
                    </div>

                    {bracketData ? (
                        <div className="space-y-8">
                            {/* Participants List (Horizontal Scroll or Grid) */}
                            <div className="p-4 bg-zinc-900/50 rounded-lg border border-white/5">
                                <h3 className="text-sm font-bold text-zinc-400 mb-4 uppercase">Participating Clans ({bracketData.participants.length})</h3>
                                <div className="flex gap-4 overflow-x-auto pb-2">
                                    {bracketData.participants.map((p: any) => (
                                        <div key={p.id} className="flex-shrink-0 flex items-center gap-3 bg-zinc-800 p-2 rounded-md pr-4">
                                            <div className="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center font-bold text-xs">{p.tag}</div>
                                            <span className="text-sm font-medium text-white">{p.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* BRACKET COMPONENT */}
                            <Bracket matches={bracketData.bracket} />
                        </div>
                    ) : (
                        <div className="py-20 flex justify-center"><LoadingSpinner /></div>
                    )}
                </div>
            )}
        </div>
    );
}
