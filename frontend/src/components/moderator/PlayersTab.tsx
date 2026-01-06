import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Ban, History, Shield, MoreHorizontal, CheckCircle2, Crown } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "../LoadingSpinner";
import type { User, EloHistoryEntry } from "./types";

interface PlayersTabProps {
    backendUrl: string;
    userId: string;
}

export default function PlayersTab({ backendUrl, userId }: PlayersTabProps) {
    const [players, setPlayers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    const [selectedPlayer, setSelectedPlayer] = useState<User | null>(null);
    const [playerHistory, setPlayerHistory] = useState<EloHistoryEntry[]>([]);
    const [manualEloChange, setManualEloChange] = useState("");
    const [manualEloReason, setManualEloReason] = useState("");
    const [isAdjusting, setIsAdjusting] = useState(false);

    useEffect(() => {
        const timeout = setTimeout(() => {
            fetchPlayers(1, searchQuery);
        }, 300);
        return () => clearTimeout(timeout);
    }, [searchQuery]);

    const fetchPlayers = async (pageNum: number, search?: string) => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({ page: pageNum.toString(), limit: '10' });
            if (search) params.append('search', search);

            const res = await fetch(`${backendUrl}/api/moderator/players?${params}`, {
                headers: { 'X-User-Id': userId },
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setPlayers(data.players || []);
                // Backend returns 'total' count, calculate totalPages (limit 50 in backend? Need to check limit)
                // Backend moderator.ts line 831 says limit = 50.
                setTotalPages(Math.ceil((data.total || 0) / 50));
                setPage(pageNum);
            }
        } catch (error) {
            console.error("Failed to fetch players", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPlayerHistory = async (playerId: string) => {
        try {
            const res = await fetch(`${backendUrl}/api/profile/${playerId}/elo-history`, {
                headers: { 'X-User-Id': userId },
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setPlayerHistory(data.history || []);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleBanUser = async (userIdTarget: string, isBanned: boolean) => {
        if (!confirm(`Are you sure you want to ${isBanned ? 'unban' : 'ban'} this user?`)) return;

        try {
            // Use specific endpoint for ban/unban
            const endpoint = isBanned
                ? `${backendUrl}/api/moderator/players/${userIdTarget}/unban`
                : `${backendUrl}/api/moderator/players/${userIdTarget}/ban`;

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId
                },
                credentials: 'include'
            });

            if (res.ok) {
                toast.success(`User ${!isBanned ? 'banned' : 'unbanned'} successfully`);
                fetchPlayers(page, searchQuery);
            } else {
                toast.error("Failed to update ban status");
            }
        } catch (error) {
            toast.error("Error updating user");
        }
    };

    const handleGrantVIP = async (userIdTarget: string) => {
        try {
            const res = await fetch(`${backendUrl}/api/moderator/players/${userIdTarget}/vip/grant`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId
                },
                credentials: 'include'
            });

            if (res.ok) {
                toast.success("VIP granted for 30 days");
                fetchPlayers(page, searchQuery);
            }
        } catch (error) {
            toast.error("Failed to grant VIP");
        }
    };

    const handleManualEloAdjust = async () => {
        if (!selectedPlayer || !manualEloChange) return;
        setIsAdjusting(true);

        try {
            const res = await fetch(`${backendUrl}/api/moderator/players/${selectedPlayer.id}/elo-adjust`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId
                },
                credentials: 'include',
                body: JSON.stringify({
                    elo_change: parseInt(manualEloChange), // Backend expects elo_change
                    reason: manualEloReason || "Manual Adjustment"
                })
            });

            if (res.ok) {
                toast.success("Elo adjusted successfully");
                fetchPlayers(page, searchQuery);
                fetchPlayerHistory(selectedPlayer.id);
                setManualEloChange("");
                setManualEloReason("");
            } else {
                toast.error("Failed to adjust Elo");
            }
        } catch (error) {
            toast.error("Error adjusting Elo");
        } finally {
            setIsAdjusting(false);
        }
    };

    const openPlayerDetails = (user: User) => {
        setSelectedPlayer(user);
        fetchPlayerHistory(user.id);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4 bg-[#1e1f22] p-4 rounded-xl border border-white/5">
                <Search className="h-5 w-5 text-zinc-500" />
                <Input
                    placeholder="Search by username, ID, or nickname..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none text-white focus-visible:ring-0 placeholder:text-zinc-500"
                />
            </div>

            <div className="space-y-2">
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <LoadingSpinner />
                    </div>
                ) : (
                    players.map(user => (
                        <Card key={user.id} className="bg-[#1e1f22] border-white/5 hover:bg-[#2b2d31] transition-colors">
                            <CardContent className="p-3 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-10 w-10 border border-white/10">
                                        <AvatarImage src={user.discord_avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.discord_avatar}.png` : undefined} />
                                        <AvatarFallback>{user.discord_username?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>

                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white">{user.standoff_nickname || user.discord_username}</span>
                                            {user.is_vip ? <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-[10px]">VIP</Badge> : null}
                                            {user.banned ? <Badge variant="destructive" className="text-[10px]">BANNED</Badge> : null}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                                            <span>ID: {user.id}</span>
                                            <span className="text-zinc-600">|</span>
                                            <span className="text-yellow-500 font-mono">{user.elo} Elo</span>
                                            <span className="text-zinc-600">|</span>
                                            <span>Wins: {user.wins}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openPlayerDetails(user)}>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchPlayers(page - 1, searchQuery)}
                        disabled={page === 1}
                    >
                        Previous
                    </Button>
                    <span className="flex items-center text-sm text-zinc-400">Page {page} of {totalPages}</span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchPlayers(page + 1, searchQuery)}
                        disabled={page === totalPages}
                    >
                        Next
                    </Button>
                </div>
            )}

            <Dialog open={!!selectedPlayer} onOpenChange={(open) => !open && setSelectedPlayer(null)}>
                <DialogContent className="bg-[#1e1f22] border-white/10 text-white max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Player Management</DialogTitle>
                    </DialogHeader>

                    {selectedPlayer && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 p-4 bg-zinc-900/50 rounded-xl border border-white/5">
                                <Avatar className="h-16 w-16">
                                    <AvatarImage src={selectedPlayer.discord_avatar ? `https://cdn.discordapp.com/avatars/${selectedPlayer.id}/${selectedPlayer.discord_avatar}.png` : undefined} />
                                    <AvatarFallback>U</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold">{selectedPlayer.discord_username}</h3>
                                    <div className="flex gap-2 mt-2">
                                        <Badge variant="outline" className="border-yellow-500/20 text-yellow-500">{selectedPlayer.elo} Elo</Badge>
                                        <Badge variant="outline">W{selectedPlayer.wins} / L{selectedPlayer.losses}</Badge>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleBanUser(selectedPlayer.id, !!selectedPlayer.banned)}
                                    >
                                        {selectedPlayer.banned ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
                                        {selectedPlayer.banned ? "Unban" : "Ban"}
                                    </Button>
                                    {!selectedPlayer.is_vip && (
                                        <Button variant="outline" size="sm" onClick={() => handleGrantVIP(selectedPlayer.id)}>
                                            <Crown className="h-4 w-4 mr-2 text-yellow-500" /> Grant VIP
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-bold text-sm text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                    <Shield className="h-4 w-4" /> Manual Adjustment
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Elo Change (+/-)</Label>
                                        <Input
                                            placeholder="-25 or 50"
                                            value={manualEloChange}
                                            onChange={(e) => setManualEloChange(e.target.value)}
                                            className="bg-zinc-900 border-white/10"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Reason</Label>
                                        <Input
                                            placeholder="Griefing, Smurfing..."
                                            value={manualEloReason}
                                            onChange={(e) => setManualEloReason(e.target.value)}
                                            className="bg-zinc-900 border-white/10"
                                        />
                                    </div>
                                </div>
                                <Button onClick={handleManualEloAdjust} disabled={!manualEloChange || isAdjusting} className="w-full">
                                    {isAdjusting ? <LoadingSpinner className="h-4 w-4 mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                                    Apply Adjustment
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-sm text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                    <History className="h-4 w-4" /> Match History
                                </h4>
                                <div className="max-h-[200px] overflow-y-auto space-y-1 pr-2">
                                    {playerHistory.map(entry => (
                                        <div key={entry.id} className="flex items-center justify-between p-2 bg-zinc-900/30 rounded text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className={entry.elo_change >= 0 ? "text-green-500" : "text-red-500"}>
                                                    {entry.elo_change > 0 ? "+" : ""}{entry.elo_change}
                                                </span>
                                                <span className="text-zinc-500 text-xs">{entry.reason}</span>
                                            </div>
                                            <span className="text-zinc-600 text-xs">
                                                {new Date(entry.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div >
    );
}
