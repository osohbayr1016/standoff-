
import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trophy, Plus, Play, Calendar, Search, Loader2, Users, Check } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "../LoadingSpinner";

interface TournamentsTabProps {
    backendUrl: string;
    userId: string;
}

import TournamentBracket from './TournamentBracket';

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

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete tournament "${name}"? This will delete all matches and participants.`)) return;
        try {
            const res = await fetch(`${backendUrl}/api/moderator/tournaments/${id}`, {
                method: 'DELETE',
                headers: { 'X-User-Id': userId }
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Tournament deleted");
                fetchTournaments();
            } else {
                toast.error(data.error || "Failed to delete");
            }
        } catch (e) {
            toast.error("Error deleting tournament");
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

    const [editingMatch, setEditingMatch] = useState<any>(null);
    const [isEditMatchOpen, setIsEditMatchOpen] = useState(false);
    const [editFormData, setEditFormData] = useState({
        status: '',
        alpha_clan_id: '',
        bravo_clan_id: '',
        winner_team: '',
        alpha_score: '',
        bravo_score: ''
    });

    const handleEditMatch = (match: any) => {
        setEditingMatch(match);
        setEditFormData({
            status: match.status,
            alpha_clan_id: match.alpha_clan?.id || '',
            bravo_clan_id: match.bravo_clan?.id || '',
            winner_team: match.winner_team || '',
            alpha_score: match.alpha_score?.toString() || '0',
            bravo_score: match.bravo_score?.toString() || '0'
        });
        fetchAvailableClans(); // Ensure clan list is populated
        setIsEditMatchOpen(true);
    };

    const handleUpdateMatch = async () => {
        if (!editingMatch) return;
        try {
            const body: any = {};
            if (editFormData.status) body.status = editFormData.status;
            // Send null if empty string to clear? Or just ignore?
            // User might want to CLEAR a team -> send null?
            // Backend accepts null. If id is empty string, convert to NULL or just don't send?
            // Let's send what is explicitly set.
            // If empty string and was present, we might want to clear it.
            // But typical use is setting a team.

            if (editFormData.alpha_clan_id) body.alpha_clan_id = editFormData.alpha_clan_id;
            if (editFormData.bravo_clan_id) body.bravo_clan_id = editFormData.bravo_clan_id;

            // Winner handling
            if (editFormData.winner_team) body.winner_team = editFormData.winner_team;
            if (editFormData.winner_team === 'none') body.winner_team = null;

            if (editFormData.alpha_score !== '') body.alpha_score = parseInt(editFormData.alpha_score);
            if (editFormData.bravo_score !== '') body.bravo_score = parseInt(editFormData.bravo_score);

            const res = await fetch(`${backendUrl}/api/moderator/matches/${editingMatch.id}/force-update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Match updated!");
                setIsEditMatchOpen(false);
                // Refresh bracket
                const refreshRes = await fetch(`${backendUrl}/api/tournaments/${selectedTournament.id}`);
                const refreshData = await refreshRes.json();
                if (refreshData.success) setBracketMatches(refreshData.bracket);
            } else {
                toast.error(data.error || "Update failed");
            }
        } catch (e) { toast.error("Error updating match"); }
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
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Trophy className="h-7 w-7 text-yellow-500" />
                        Tournaments Management
                    </h2>
                    <p className="text-sm text-zinc-400 mt-1">Organize and manage clan tournaments</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold shadow-lg shadow-yellow-500/20">
                    <Plus className="h-4 w-4 mr-2" /> Create Tournament
                </Button>
            </div>

            {/* Statistics Card */}
            {tournaments.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-yellow-500/10 to-transparent border-yellow-500/20">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-zinc-400 uppercase tracking-wider">Total</p>
                                    <p className="text-2xl font-bold text-white mt-1">{tournaments.length}</p>
                                </div>
                                <Trophy className="h-8 w-8 text-yellow-500/50" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-zinc-400 uppercase tracking-wider">Active</p>
                                    <p className="text-2xl font-bold text-white mt-1">{tournaments.filter(t => t.status === 'active').length}</p>
                                </div>
                                <Play className="h-8 w-8 text-green-500/50" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-zinc-400 uppercase tracking-wider">Registration</p>
                                    <p className="text-2xl font-bold text-white mt-1">{tournaments.filter(t => t.status === 'registration').length}</p>
                                </div>
                                <Users className="h-8 w-8 text-blue-500/50" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-zinc-400 uppercase tracking-wider">Completed</p>
                                    <p className="text-2xl font-bold text-white mt-1">{tournaments.filter(t => t.status === 'completed').length}</p>
                                </div>
                                <Check className="h-8 w-8 text-purple-500/50" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && tournaments.length === 0 ? (
                <Card className="bg-gradient-to-br from-yellow-500/5 to-transparent border-yellow-500/10">
                    <CardContent className="p-12 text-center space-y-4">
                        <div className="flex justify-center mb-4">
                            <div className="p-6 bg-yellow-500/10 rounded-full">
                                <Trophy className="h-16 w-16 text-yellow-500" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-white">No Tournaments Yet</h3>
                        <p className="text-zinc-400 max-w-md mx-auto">
                            Create your first tournament to start organizing competitive clan battles.
                            Tournaments are a great way to engage your community and showcase the best clans!
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-4">
                            <Button onClick={() => setIsCreateOpen(true)} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
                                <Plus className="h-4 w-4 mr-2" /> Create Your First Tournament
                            </Button>
                        </div>
                        <div className="pt-6 border-t border-white/5 mt-6">
                            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Quick Tips</p>
                            <div className="grid sm:grid-cols-3 gap-3 text-left max-w-2xl mx-auto">
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-sm font-semibold text-white mb-1">📅 Schedule</p>
                                    <p className="text-xs text-zinc-400">Set start and end times</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-sm font-semibold text-white mb-1">🏆 Prize Pool</p>
                                    <p className="text-xs text-zinc-400">Motivate participants</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-sm font-semibold text-white mb-1">⚔️ Bracket</p>
                                    <p className="text-xs text-zinc-400">Auto-generated on start</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
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
                                        Overview
                                    </Button>
                                    {t.status === 'registration' && (
                                        <Button onClick={() => handleStart(t.id)} className="bg-green-600 hover:bg-green-700 text-white">
                                            <Play className="h-4 w-4 mr-2" /> Start & Generate Bracket
                                        </Button>
                                    )}
                                    <Button onClick={() => handleDelete(t.id, t.name)} variant="destructive" className="ml-2">
                                        Delete
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

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
                        <DialogTitle>Tournament Overview - {selectedTournament?.name}</DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto bg-black/50 rounded-lg p-4">
                        {bracketMatches.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                                <Trophy className="h-12 w-12 mb-4 opacity-20" />
                                <p>No bracket generated yet</p>
                            </div>
                        ) : (
                            <TournamentBracket
                                matches={bracketMatches}
                                onManageMatch={handleForceWin}
                                onEditMatch={handleEditMatch}
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Match Dialog */}
            <Dialog open={isEditMatchOpen} onOpenChange={setIsEditMatchOpen}>
                <DialogContent className="bg-[#1e1f22] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Edit Match {editingMatch?.bracket_match_id}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Status */}
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={editFormData.status} onValueChange={(v) => setEditFormData({ ...editFormData, status: v })}>
                                <SelectTrigger className="bg-zinc-900 border-white/10"><SelectValue placeholder="Status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="waiting">Waiting</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                    <SelectItem value="pending_review">Pending Review</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Clans */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Alpha Team</Label>
                                <Select value={editFormData.alpha_clan_id} onValueChange={(v) => setEditFormData({ ...editFormData, alpha_clan_id: v })}>
                                    <SelectTrigger className="bg-zinc-900 border-white/10"><SelectValue placeholder="Select Clan" /></SelectTrigger>
                                    <SelectContent>
                                        {availableClans.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.tag}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Bravo Team</Label>
                                <Select value={editFormData.bravo_clan_id} onValueChange={(v) => setEditFormData({ ...editFormData, bravo_clan_id: v })}>
                                    <SelectTrigger className="bg-zinc-900 border-white/10"><SelectValue placeholder="Select Clan" /></SelectTrigger>
                                    <SelectContent>
                                        {availableClans.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.tag}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Scores */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Alpha Score</Label>
                                <Input
                                    type="number"
                                    className="bg-zinc-900 border-white/10"
                                    value={editFormData.alpha_score}
                                    onChange={e => setEditFormData({ ...editFormData, alpha_score: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Bravo Score</Label>
                                <Input
                                    type="number"
                                    className="bg-zinc-900 border-white/10"
                                    value={editFormData.bravo_score}
                                    onChange={e => setEditFormData({ ...editFormData, bravo_score: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Winner */}
                        <div className="space-y-2">
                            <Label>Winner</Label>
                            <Select value={editFormData.winner_team} onValueChange={(v) => setEditFormData({ ...editFormData, winner_team: v })}>
                                <SelectTrigger className="bg-zinc-900 border-white/10"><SelectValue placeholder="No Winner" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None (Clear)</SelectItem>
                                    <SelectItem value="alpha">Alpha</SelectItem>
                                    <SelectItem value="bravo">Bravo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsEditMatchOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpdateMatch}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
