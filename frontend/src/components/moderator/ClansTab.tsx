import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Shield, Plus, Pencil, UserCog, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LoadingSpinner from "../LoadingSpinner";
import type { Clan } from "./types";

interface ClansTabProps {
    backendUrl: string;
    userId: string;
}

export default function ClansTab({ backendUrl, userId }: ClansTabProps) {
    const [clans, setClans] = useState<Clan[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Dialog States
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isLeaderOpen, setIsLeaderOpen] = useState(false);

    const [selectedClan, setSelectedClan] = useState<Clan | null>(null);

    // Form States
    const [formData, setFormData] = useState({ name: '', tag: '', description: '', logo_url: '', max_members: 20 });
    const [leaderIdInput, setLeaderIdInput] = useState('');
    const [newLeaderId, setNewLeaderId] = useState('');

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchClans();
        }, 500);
        return () => clearTimeout(timeout);
    }, [searchQuery]);

    const fetchClans = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append('q', searchQuery);

            const res = await fetch(`${backendUrl}/api/moderator/clans?${params}`, {
                headers: { 'X-User-Id': userId }
            });
            const data = await res.json();
            if (data.success) {
                setClans(data.clans);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch clans");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateClan = async () => {
        try {
            const res = await fetch(`${backendUrl}/api/moderator/clans`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
                body: JSON.stringify({ ...formData, leader_id: leaderIdInput })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Clan created successfully");
                setIsCreateOpen(false);
                fetchClans();
                setFormData({ name: '', tag: '', description: '', logo_url: '', max_members: 20 });
                setLeaderIdInput('');
            } else {
                toast.error(data.error || "Failed to create clan");
            }
        } catch (error) {
            toast.error("Error creating clan");
        }
    };

    const handleEditClan = async () => {
        if (!selectedClan) return;
        try {
            const res = await fetch(`${backendUrl}/api/moderator/clans/${selectedClan.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Clan updated");
                setIsEditOpen(false);
                fetchClans();
            } else {
                toast.error(data.error || "Failed to update");
            }
        } catch (error) {
            toast.error("Error updating clan");
        }
    };

    const handleChangeLeader = async () => {
        if (!selectedClan) return;
        try {
            const res = await fetch(`${backendUrl}/api/moderator/clans/${selectedClan.id}/leader`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
                body: JSON.stringify({ new_leader_id: newLeaderId })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Leader changed");
                setIsLeaderOpen(false);
                fetchClans();
            } else {
                toast.error(data.error || "Failed to change leader");
            }
        } catch (error) {
            toast.error("Error changing leader");
        }
    };

    const handleDeleteClan = async (id: string) => {
        if (!confirm("Are you sure? This will delete the clan and kick all members.")) return;
        try {
            const res = await fetch(`${backendUrl}/api/moderator/clans/${id}`, {
                method: 'DELETE',
                headers: { 'X-User-Id': userId }
            });
            if (res.ok) {
                toast.success("Clan deleted");
                fetchClans();
            } else {
                toast.error("Failed to delete clan");
            }
        } catch (error) {
            toast.error("Error deleting clan");
        }
    };

    const openEdit = (clan: Clan) => {
        setSelectedClan(clan);
        setFormData({
            name: clan.name,
            tag: clan.tag,
            description: clan.description || '',
            logo_url: clan.logo_url || '',
            max_members: clan.max_members
        });
        setIsEditOpen(true);
    };

    const openLeader = (clan: Clan) => {
        setSelectedClan(clan);
        setNewLeaderId('');
        setIsLeaderOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                        placeholder="Search clans by name or tag..."
                        className="pl-9 bg-zinc-900 border-white/10 text-white"
                        value={searchQuery} // Fixed: Corrected search query binding from fetchPlayers to searchQuery
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <Button onClick={() => setIsCreateOpen(true)} className="bg-yellow-500 hover:bg-yellow-600 text-black">
                    <Plus className="h-4 w-4 mr-2" /> Create Clan
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? (
                    <div className="col-span-full flex justify-center py-12">
                        <LoadingSpinner />
                    </div>
                ) : (
                    clans.map(clan => (
                        <Card key={clan.id} className="bg-[#1e1f22] border-white/5 overflow-hidden group">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-12 w-12 border border-white/10">
                                            <AvatarImage src={clan.logo_url} />
                                            <AvatarFallback className="bg-zinc-800 text-yellow-500 font-bold">{clan.tag}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-white">{clan.name}</h3>
                                                <Badge variant="outline" className="text-yellow-500 border-yellow-500/20 bg-yellow-500/10">
                                                    {clan.tag}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
                                                <Users className="h-3 w-3" />
                                                <span>{clan.member_count} / {clan.max_members}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={() => openEdit(clan)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={() => openLeader(clan)}>
                                            <UserCog className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/20" onClick={() => handleDeleteClan(clan.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-white/5 text-sm text-zinc-400">
                                    <div className="flex justify-between items-center">
                                        <span>Leader:</span>
                                        <span className="text-white flex items-center gap-1">
                                            <Shield className="h-3 w-3 text-yellow-500" />
                                            {clan.leader_name || 'Unknown'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                        <span>Elo:</span>
                                        <span className="text-white font-mono">{clan.elo}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )))}
            </div>

            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="bg-[#1e1f22] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Create Clan</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Clan Name</Label>
                                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-zinc-900" />
                            </div>
                            <div className="space-y-2">
                                <Label>Tag</Label>
                                <Input value={formData.tag} onChange={e => setFormData({ ...formData, tag: e.target.value })} className="bg-zinc-900" maxLength={4} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Leader ID (Player ID)</Label>
                            <Input value={leaderIdInput} onChange={e => setLeaderIdInput(e.target.value)} placeholder="Player ID (UUID)" className="bg-zinc-900" />
                        </div>
                        <div className="space-y-2">
                            <Label>Max Members</Label>
                            <Select value={formData.max_members.toString()} onValueChange={v => setFormData({ ...formData, max_members: parseInt(v) })}>
                                <SelectTrigger className="bg-zinc-900"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="20">20 Members</SelectItem>
                                    <SelectItem value="50">50 Members</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreateClan} className="bg-yellow-500 text-black">Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="bg-[#1e1f22] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Edit Clan</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Clan Name</Label>
                                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="bg-zinc-900" />
                            </div>
                            <div className="space-y-2">
                                <Label>Tag</Label>
                                <Input value={formData.tag} onChange={e => setFormData({ ...formData, tag: e.target.value })} className="bg-zinc-900" maxLength={4} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="bg-zinc-900" />
                        </div>
                        <div className="space-y-2">
                            <Label>Logo URL</Label>
                            <Input value={formData.logo_url} onChange={e => setFormData({ ...formData, logo_url: e.target.value })} className="bg-zinc-900" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleEditClan} className="bg-yellow-500 text-black">Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Change Leader Dialog */}
            <Dialog open={isLeaderOpen} onOpenChange={setIsLeaderOpen}>
                <DialogContent className="bg-[#1e1f22] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Change Leader</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-zinc-400">Transfer ownership of <strong>{selectedClan?.name}</strong> to another player. The current leader will become a member.</p>
                        <div className="space-y-2">
                            <Label>New Leader ID</Label>
                            <Input value={newLeaderId} onChange={e => setNewLeaderId(e.target.value)} placeholder="Player ID (UUID)" className="bg-zinc-900" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleChangeLeader} className="bg-red-500 hover:bg-red-600 text-white">Transfer Leadership</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
