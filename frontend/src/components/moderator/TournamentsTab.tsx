
import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trophy, Plus, Play, Calendar, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "../LoadingSpinner";

interface TournamentsTabProps {
    backendUrl: string;
    userId: string;
}

export default function TournamentsTab({ backendUrl, userId }: TournamentsTabProps) {
    const [tournaments, setTournaments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [addingClanId, setAddingClanId] = useState<string | null>(null);

    // Form
    const [formData, setFormData] = useState({
        name: '',
        start_time: '',
        prizepool: '',
        max_teams: 16
    });

    useEffect(() => {
        fetchTournaments();
    }, []);

    const fetchTournaments = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${backendUrl}/api/tournaments`);
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

    const handleCreate = async () => {
        try {
            const res = await fetch(`${backendUrl}/api/moderator/tournaments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Tournament created");
                setIsCreateOpen(false);
                fetchTournaments();
            } else {
                toast.error("Failed to create");
            }
        } catch (e) {
            toast.error("Error creating tournament");
        }
    };

    const handleStart = async (id: string) => {
        if (!confirm("Start tournament? This will generate the bracket.")) return;
        try {
            const res = await fetch(`${backendUrl}/api/moderator/tournaments/${id}/start`, {
                method: 'POST',
                headers: { 'X-User-Id': userId }
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Tournament started!");
                fetchTournaments();
            } else {
                toast.error(data.error || "Failed to start");
            }
        } catch (e) {
            toast.error("Error starting tournament");
        }
    };

    const [selectedTournament, setSelectedTournament] = useState<any>(null);
    const [isManageOpen, setIsManageOpen] = useState(false);
    const [clanTagInput, setClanTagInput] = useState('');
    const [participants, setParticipants] = useState<any[]>([]);
    const [isBracketOpen, setIsBracketOpen] = useState(false);
    const [bracketMatches, setBracketMatches] = useState<any[]>([]);

    const handleManageBracket = async (t: any) => {
        setSelectedTournament(t);
        try {
            const res = await fetch(`${backendUrl}/api/tournaments/${t.id}`);
            const data = await res.json();
            if (data.success) {
                setBracketMatches(data.bracket || []);
            }
        } catch (e) { console.error(e); }
        setIsBracketOpen(true);
    };

    const handleForceWin = async (matchId: string, team: 'alpha' | 'bravo') => {
        if (!confirm(`Force win for team ${team}? This will advance the bracket.`)) return;
        try {
            const res = await fetch(`${backendUrl}/api/moderator/matches/${matchId}/force-result`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
                body: JSON.stringify({ winner_team: team })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Match updated!");
                const refreshRes = await fetch(`${backendUrl}/api/tournaments/${selectedTournament.id}`);
                const refreshData = await refreshRes.json();
                if (refreshData.success) setBracketMatches(refreshData.bracket);
            } else {
                toast.error(data.error);
            }
        } catch (e) { toast.error("Error updating match"); }
    };

    const fetchParticipants = async (tId: string) => {
        try {
            const res = await fetch(`${backendUrl}/api/tournaments/${tId}`);
            const data = await res.json();
            if (data.success) {
                setParticipants(data.participants);
            }
        } catch (e) { console.error(e); }
    };

    const [availableClans, setAvailableClans] = useState<any[]>([]);

    const fetchAvailableClans = async () => {
        try {
            const res = await fetch(`${backendUrl}/api/clans`);
            const data = await res.json();
            if (data.clans) {
                setAvailableClans(data.clans);
            }
        } catch (e) { console.error(e); }
    };

    const handleManage = (t: any) => {
        setSelectedTournament(t);
        fetchParticipants(t.id);
        fetchAvailableClans(); // Fetch clans when opening manage
        setIsManageOpen(true);
    };

    const handleAddParticipant = async (tagToAdd: string, clanIdForSpinner: string) => {
        if (!selectedTournament) return;
        setAddingClanId(clanIdForSpinner);
        try {
            const res = await fetch(`${backendUrl}/api/moderator/tournaments/${selectedTournament.id}/participants`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
                body: JSON.stringify({ clan_tag: tagToAdd })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                fetchParticipants(selectedTournament.id);
            } else {
                toast.error(data.error);
            }
        } catch (e) { toast.error("Failed to add"); }
        finally { setAddingClanId(null); }
    };
    // ... (lines 176-310 skipped for brevity in prompt, effectively finding the button loop)


    const handleRemoveParticipant = async (clanId: string) => {
        if (!confirm("Remove clan?")) return;
        try {
            const res = await fetch(`${backendUrl}/api/moderator/tournaments/${selectedTournament.id}/participants/${clanId}`, {
                method: 'DELETE',
                headers: { 'X-User-Id': userId }
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Removed");
                fetchParticipants(selectedTournament.id);
            } else {
                toast.error(data.error);
            }
        } catch (e) { toast.error("Failed to remove"); }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Tournaments Management</h2>
                <Button onClick={() => setIsCreateOpen(true)} className="bg-yellow-500 text-black">
                    <Plus className="h-4 w-4 mr-2" /> Create Tournament
                </Button>
            </div>

            <div className="grid gap-4">
                {isLoading ? <LoadingSpinner /> : tournaments.map(t => (
                    <Card key={t.id} className="bg-[#1e1f22] border-white/5">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-500">
                                    <Trophy className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg">{t.name}</h3>
                                    <div className="flex gap-4 text-sm text-zinc-400 mt-1">
                                        <Badge variant="outline" className="border-white/10">{t.status}</Badge>
                                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(t.start_time).toLocaleDateString()}</span>
                                        <span>Max: {t.max_teams} Teams</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button onClick={() => handleManage(t)} variant="outline" className="text-white border-white/10">
                                    Participants
                                </Button>
                                <Button onClick={() => handleManageBracket(t)} variant="outline" className="text-white border-white/10">
                                    Bracket
                                </Button>
                                {t.status === 'registration' && (
                                    <Button onClick={() => handleStart(t.id)} className="bg-green-600 hover:bg-green-700 text-white">
                                        <Play className="h-4 w-4 mr-2" /> Start & Generate Bracket
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="bg-[#1e1f22] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Create Tournament</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-zinc-900" />
                        </div>
                        <div className="space-y-2">
                            <Label>Start Time (ISO)</Label>
                            <Input type="datetime-local" onChange={e => setFormData({ ...formData, start_time: new Date(e.target.value).toISOString() })} className="bg-zinc-900" />
                        </div>
                        <div className="space-y-2">
                            <Label>Prize Pool</Label>
                            <Input value={formData.prizepool} onChange={e => setFormData({ ...formData, prizepool: e.target.value })} className="bg-zinc-900" placeholder="e.g. 100,000 MNT" />
                        </div>
                        <div className="space-y-2">
                            <Label>Max Teams</Label>
                            <Input type="number" value={formData.max_teams} onChange={e => setFormData({ ...formData, max_teams: parseInt(e.target.value) })} className="bg-zinc-900" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreate} className="bg-yellow-500 text-black">Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
                <DialogContent className="bg-[#1e1f22] border-white/10 text-white max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Manage Participants - {selectedTournament?.name}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 mb-6">
                        <Label>Add Participant</Label>
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search clans to add..."
                                value={clanTagInput}
                                onChange={e => setClanTagInput(e.target.value)}
                                className="pl-8 bg-zinc-900 border-white/10"
                            />
                        </div>
                        <div className="border border-white/5 rounded-md max-h-[200px] overflow-y-auto p-2 bg-zinc-900/50">
                            {isLoading ? (
                                <div className="text-center p-2 text-muted-foreground text-sm">Loading clans...</div>
                            ) : (
                                (() => {
                                    // Filter available clans: Must match search AND not be already participating
                                    const filtered = availableClans.filter(c =>
                                        !participants.some(p => p.clan_id === c.id) &&
                                        (c.name.toLowerCase().includes(clanTagInput.toLowerCase()) || c.tag.toLowerCase().includes(clanTagInput.toLowerCase()))
                                    );

                                    if (filtered.length === 0) return <div className="text-center p-2 text-muted-foreground text-sm">No clans found</div>;

                                    return (
                                        <div className="grid gap-1">
                                            {filtered.map(clan => (
                                                <div key={clan.id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded transition-colors group">
                                                    <div className="flex items-center gap-2">
                                                        {clan.logo_url ? (
                                                            <img src={clan.logo_url} className="w-6 h-6 rounded" />
                                                        ) : (
                                                            <div className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center text-[10px] font-bold">{clan.tag}</div>
                                                        )}
                                                        <span className="text-sm">
                                                            <span className="font-bold text-yellow-500">[{clan.tag}]</span> {clan.name}
                                                        </span>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        disabled={addingClanId === clan.id}
                                                        className="h-7 text-xs bg-blue-600 hover:bg-blue-700 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100"
                                                        onClick={() => handleAddParticipant(clan.tag, clan.id)}
                                                    >
                                                        {addingClanId === clan.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()
                            )}
                        </div>
                    </div>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {participants.length === 0 ? <p className="text-zinc-500">No participants yet.</p> : participants.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded border border-white/5">
                                <div className="flex items-center gap-3">
                                    {p.logo_url ? (
                                        <img src={p.logo_url} className="w-8 h-8 rounded" />
                                    ) : (
                                        <div className="w-8 h-8 bg-zinc-800 rounded flex items-center justify-center font-bold text-xs">{p.tag}</div>
                                    )}
                                    <div>
                                        <div className="font-bold text-sm">[{p.tag}] {p.name}</div>
                                        <div className="text-xs text-zinc-500">Seed: {p.seed || '-'}</div>
                                    </div>
                                </div>
                                <Button size="sm" variant="destructive" onClick={() => handleRemoveParticipant(p.clan_id)}>Remove</Button>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isBracketOpen} onOpenChange={setIsBracketOpen}>
                <DialogContent className="bg-[#1e1f22] border-white/10 text-white max-w-4xl h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Manage Bracket - {selectedTournament?.name}</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4">
                        {bracketMatches.length === 0 ? <p>No generated bracket matches yet.</p> : bracketMatches.map(m => (
                            <div key={m.id} className="p-4 bg-zinc-900/50 border border-white/5 rounded-lg flex items-center justify-between">
                                <div>
                                    <div className="text-xs text-zinc-500 uppercase font-bold mb-1">Round {m.round} - Match {m.bracket_match_id}</div>
                                    <div className="flex items-center gap-4">
                                        <div className={`flex items-center gap-2 ${m.winner_team === 'alpha' ? 'text-green-400 font-bold' : ''}`}>
                                            {m.alpha_clan ? m.alpha_clan.tag : 'TBD'} <span className="text-zinc-500">({m.alpha_score})</span>
                                        </div>
                                        <span className="text-zinc-600">vs</span>
                                        <div className={`flex items-center gap-2 ${m.winner_team === 'bravo' ? 'text-green-400 font-bold' : ''}`}>
                                            {m.bravo_clan ? m.bravo_clan.tag : 'TBD'} <span className="text-zinc-500">({m.bravo_score})</span>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-xs">
                                        Status: <Badge variant="outline" className="text-xs border-white/10">{m.status}</Badge>
                                        {m.winner_team && <span className="ml-2 text-green-500">Winner: {m.winner_team === 'alpha' ? 'Alpha' : 'Bravo'}</span>}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <Button size="sm" variant="outline" onClick={() => handleForceWin(m.id, 'alpha')} disabled={!!m.winner_team}>Win Alpha</Button>
                                    <Button size="sm" variant="outline" onClick={() => handleForceWin(m.id, 'bravo')} disabled={!!m.winner_team}>Win Bravo</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
