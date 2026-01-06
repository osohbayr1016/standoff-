import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, X, RefreshCw, Clock, MapPin, Trophy, Pencil, Eye, Filter, Copy, User } from "lucide-react";
import { toast } from "sonner";
import LoadingSpinner from "../LoadingSpinner";

import type { PendingMatch } from "./types";
import { ShieldAlert } from "lucide-react";

interface MatchesTabProps {
    backendUrl: string;
    onViewLobby?: (lobbyId: string) => void;
    userId: string;
}

export default function MatchesTab({ backendUrl, onViewLobby, userId }: MatchesTabProps) {
    const [matchesCategory, setMatchesCategory] = useState("active");
    const [matchTypeFilter, setMatchTypeFilter] = useState("all"); // 'all', 'competitive', 'league', 'clan_war', 'casual'
    const [activeMatches, setActiveMatches] = useState<PendingMatch[]>([]);
    const [pendingReviews, setPendingReviews] = useState<PendingMatch[]>([]);
    const [recentMatches, setRecentMatches] = useState<PendingMatch[]>([]);
    const [cancelledMatches, setCancelledMatches] = useState<PendingMatch[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Edit Result Modal (Existing)
    const [isEditResultModalOpen, setIsEditResultModalOpen] = useState(false);
    const [editingMatch, setEditingMatch] = useState<PendingMatch | null>(null);
    const [editAlphaScore, setEditAlphaScore] = useState("");
    const [editBravoScore, setEditBravoScore] = useState("");
    const [editWinner, setEditWinner] = useState("alpha");

    // Review Modal (New)
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [reviewingMatch, setReviewingMatch] = useState<PendingMatch | null>(null);
    const [reviewAlphaScore, setReviewAlphaScore] = useState("");
    const [reviewBravoScore, setReviewBravoScore] = useState("");
    const [reviewWinner, setReviewWinner] = useState("alpha");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (matchesCategory === "active") fetchActiveMatches();
        if (matchesCategory === "pending") fetchPendingReviews();
        if (matchesCategory === "history") fetchRecentMatches();
        if (matchesCategory === "cancelled") fetchCancelledMatches();
    }, [matchesCategory]);

    const fetchActiveMatches = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${backendUrl}/api/moderator/active-matches`, {
                headers: { 'X-User-Id': userId },
                credentials: 'include'
            });
            if (res.ok) setActiveMatches((await res.json()).matches);
        } catch (error) {
            toast.error("Failed to fetch active matches");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPendingReviews = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${backendUrl}/api/moderator/pending-reviews`, {
                headers: { 'X-User-Id': userId },
                credentials: 'include'
            });
            if (res.ok) setPendingReviews((await res.json()).matches);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchRecentMatches = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${backendUrl}/api/moderator/recent-matches`, {
                headers: { 'X-User-Id': userId },
                credentials: 'include'
            });
            if (res.ok) setRecentMatches((await res.json()).matches);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCancelledMatches = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${backendUrl}/api/moderator/cancelled-matches`, {
                headers: { 'X-User-Id': userId },
                credentials: 'include'
            });
            if (res.ok) setCancelledMatches((await res.json()).matches);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    // Open Review Dialog
    const openReviewModal = (match: PendingMatch) => {
        setReviewingMatch(match);
        setReviewAlphaScore(match.alpha_score?.toString() || "0");
        setReviewBravoScore(match.bravo_score?.toString() || "0");
        setReviewWinner(match.winner_team || (match.alpha_score! > match.bravo_score! ? "alpha" : "bravo") || "alpha");
        setIsReviewModalOpen(true);
    };

    // Submit Review (Approve/Reject)
    const handleSubmitReview = async (approved: boolean) => {
        if (!reviewingMatch) return;
        setIsSubmitting(true);

        try {
            const res = await fetch(`${backendUrl}/api/moderator/matches/${reviewingMatch.id}/review`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId
                },
                credentials: 'include',
                body: JSON.stringify({
                    approved,
                    // Send corrected scores/winner if approving
                    alpha_score: approved ? parseInt(reviewAlphaScore) : undefined,
                    bravo_score: approved ? parseInt(reviewBravoScore) : undefined,
                    winner_team: approved ? reviewWinner : undefined
                })
            });

            if (res.ok) {
                toast.success(approved ? "Match Approved" : "Match Rejected");
                setIsReviewModalOpen(false);
                fetchPendingReviews();
            } else {
                toast.error("Failed to review match");
            }
        } catch (error) {
            toast.error("Error submitting review");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Quick Reject (bypasses modal if needed, or reuses logic) - reusing logic via separate handler if we wanted direct button
    // But user wants to confirm. So we use modal.

    const handleEditResultSubmit = async () => {
        if (!editingMatch || !editAlphaScore || !editBravoScore) return;

        try {
            const res = await fetch(`${backendUrl}/api/moderator/matches/${editingMatch.id}/edit-result`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId
                },
                credentials: 'include',
                body: JSON.stringify({
                    alpha_score: parseInt(editAlphaScore),
                    bravo_score: parseInt(editBravoScore),
                    winner_team: editWinner
                })
            });

            if (res.ok) {
                toast.success("Match result updated");
                setIsEditResultModalOpen(false);
                fetchRecentMatches();
            } else {
                toast.error("Failed to update result");
            }
        } catch (error) {
            toast.error("Error updating result");
        }
    };

    // Cancel Match (Moderator Action)
    const handleCancelMatch = async (matchId: string) => {
        if (!confirm("Are you sure you want to cancel this match? This action cannot be undone.")) return;

        try {
            const res = await fetch(`${backendUrl}/api/matches/${matchId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId // Pass mod ID as requester
                },
                body: JSON.stringify({
                    host_id: userId, // Backend uses this to check permissions
                    status: 'cancelled'
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Match cancelled successfully");
                fetchActiveMatches(); // Refresh list
            } else {
                toast.error(data.error || "Failed to cancel match");
            }
        } catch (err) {
            toast.error("Network error");
        }
    };

    const openEditResultModal = (match: PendingMatch) => {
        setEditingMatch(match);
        setEditAlphaScore(match.alpha_score?.toString() || "0");
        setEditBravoScore(match.bravo_score?.toString() || "0");
        setEditWinner(match.winner_team || "alpha");
        setIsEditResultModalOpen(true);
    };

    const getMatchList = () => {
        let list: PendingMatch[] = [];
        switch (matchesCategory) {
            case "active": list = activeMatches; break;
            case "pending": list = pendingReviews; break;
            case "history": list = recentMatches; break;
            case "cancelled": list = cancelledMatches; break;
            default: list = [];
        }

        if (matchTypeFilter !== 'all') {
            list = list.filter(m => m.match_type === matchTypeFilter);
        }
        return list;
    };

    const matches = getMatchList();

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <Tabs value={matchesCategory} onValueChange={setMatchesCategory} className="w-full md:w-auto">
                    <TabsList className="bg-[#1e1f22] border border-white/5">
                        <TabsTrigger value="active" className="data-[state=active]:bg-green-500/10 data-[state=active]:text-green-500">Active</TabsTrigger>
                        <TabsTrigger value="pending" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-500">Pending</TabsTrigger>
                        <TabsTrigger value="history">History</TabsTrigger>
                        <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Select value={matchTypeFilter} onValueChange={setMatchTypeFilter}>
                        <SelectTrigger className="w-[150px] bg-[#1e1f22] border-white/10 text-white">
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-zinc-400" />
                                <SelectValue placeholder="Filter Type" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="bg-[#1e1f22] border-white/10 text-white">
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="competitive">Competitive</SelectItem>
                            <SelectItem value="league">League</SelectItem>
                            <SelectItem value="clan_war">Clan War</SelectItem>
                            <SelectItem value="casual">Casual</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button variant="outline" size="sm" onClick={() => {
                        if (matchesCategory === "active") fetchActiveMatches();
                        if (matchesCategory === "pending") fetchPendingReviews();
                        if (matchesCategory === "history") fetchRecentMatches();
                        if (matchesCategory === "cancelled") fetchCancelledMatches();
                    }}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <LoadingSpinner />
                    </div>
                ) : matches.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500 bg-[#1e1f22]/50 rounded-xl border border-white/5 border-dashed">
                        No matches found in this category.
                    </div>
                ) : (
                    matches.map(match => (
                        <Card key={match.id} className="bg-[#1e1f22] border-white/5 hover:border-white/10 transition-colors group">
                            <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-4 flex-1">
                                    <Avatar className="h-12 w-12 rounded-lg border border-white/10">
                                        <AvatarImage src={match.host_avatar ? `https://cdn.discordapp.com/avatars/${match.host_id}/${match.host_avatar}.png` : undefined} />
                                        <AvatarFallback className="bg-zinc-800 text-zinc-500 font-bold font-mono">
                                            {match.match_type.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-white">Match #{match.id.slice(0, 8)}</h3>
                                            <Badge variant={
                                                match.status === 'finished' ? 'default' :
                                                    match.status === 'cancelled' ? 'destructive' :
                                                        match.status === 'pending_review' ? 'secondary' : 'outline'
                                            } className={
                                                match.status === 'finished' ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' :
                                                    match.status === 'pending_review' ? 'bg-orange-500/20 text-orange-500 hover:bg-orange-500/30' : ''
                                            }>
                                                {match.status.replace('_', ' ')}
                                            </Badge>
                                            <Badge variant="outline" className={
                                                match.match_type === 'league' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                                                    match.match_type === 'competitive' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                                        match.match_type === 'clan_war' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                            "text-zinc-400 border-zinc-700 bg-zinc-900/50"
                                            }>
                                                {match.match_type.replace('_', ' ')}
                                            </Badge>
                                        </div>
                                        {match.host_username && (
                                            <div className="flex items-center gap-2 mt-1 mx-1 text-sm text-zinc-400">
                                                <User className="h-3 w-3" />
                                                <span
                                                    className="cursor-pointer hover:text-white transition-colors flex items-center gap-1"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(match.host_username || "");
                                                        toast.success("Username copied to clipboard");
                                                    }}
                                                    title="Click to copy username"
                                                >
                                                    {match.host_username}
                                                    <Copy className="h-3 w-3 opacity-50" />
                                                </span>
                                            </div>
                                        )}

                                        <div className="text-sm text-zinc-400 mt-1 flex items-center gap-3">
                                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {match.map_name || 'Random Map'}</span>
                                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(match.created_at).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                            <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> {match.alpha_score ?? '-'} : {match.bravo_score ?? '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    {matchesCategory === "pending" && (
                                        <Button size="sm" variant="default" className="bg-orange-600 hover:bg-orange-700 flex-1 md:flex-none" onClick={() => openReviewModal(match)}>
                                            <Eye className="h-4 w-4 mr-2" /> Review
                                        </Button>
                                    )}

                                    {matchesCategory === "history" && (
                                        <Button size="sm" variant="outline" onClick={() => openEditResultModal(match)}>
                                            <Pencil className="h-4 w-4 mr-2" /> Edit Result
                                        </Button>
                                    )}

                                    <Button size="sm" variant="secondary" onClick={() => onViewLobby && onViewLobby(match.id)}>
                                        <Eye className="h-4 w-4 mr-2" /> View Lobby
                                    </Button>

                                    {matchesCategory === "active" && (match.status === 'drafting' || match.status === 'waiting' || match.status === 'map_ban' || match.status === 'in_progress') && (
                                        <Button size="sm" variant="destructive" onClick={() => handleCancelMatch(match.id)}>
                                            <ShieldAlert className="h-4 w-4 mr-2" /> Cancel
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Review Dialog */}
            <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
                <DialogContent className="bg-[#1e1f22] border-white/10 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Review Match Result</DialogTitle>
                        <DialogDescription>Verify the screenshot and confirm the winner.</DialogDescription>
                    </DialogHeader>

                    {reviewingMatch && (
                        <div className="space-y-6">
                            {/* Screenshot */}
                            <div className="bg-black/50 rounded-lg overflow-hidden border border-white/10 min-h-[300px] flex items-center justify-center">
                                {reviewingMatch.result_screenshot_url ? (
                                    <img
                                        src={reviewingMatch.result_screenshot_url}
                                        alt="Match Result"
                                        className="max-w-full h-auto object-contain"
                                    />
                                ) : (
                                    <div className="text-zinc-500 flex flex-col items-center">
                                        <X className="h-8 w-8 mb-2" />
                                        <span>No screenshot uploaded</span>
                                    </div>
                                )}
                            </div>

                            {/* Rosters */}
                            {reviewingMatch.players && reviewingMatch.players.length > 0 && (
                                <div className="grid grid-cols-2 gap-4 bg-zinc-900/50 p-4 rounded-xl border border-white/5">
                                    <div className="space-y-3">
                                        <h4 className="font-bold text-blue-400 text-xs uppercase tracking-wider flex items-center justify-between">
                                            Team Alpha
                                            <span className="text-zinc-500">{reviewingMatch.players.filter(p => p.team === 'alpha').length} Players</span>
                                        </h4>
                                        <div className="space-y-1">
                                            {reviewingMatch.players.filter(p => p.team === 'alpha').map(p => (
                                                <div key={p.player_id} className="flex items-center gap-2 text-sm bg-black/20 p-2 rounded border border-white/5">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={`https://cdn.discordapp.com/avatars/${p.player_id}/${p.discord_avatar}.png`} />
                                                        <AvatarFallback className="text-[10px]">{p.discord_username?.substring(0, 2)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="overflow-hidden">
                                                        <div className="text-white font-medium truncate text-xs" title={p.discord_username}>{p.discord_username}</div>
                                                        <div className="text-zinc-500 text-[10px] truncate">{p.standoff_nickname || 'No Nick'}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="font-bold text-red-400 text-xs uppercase tracking-wider flex items-center justify-between">
                                            Team Bravo
                                            <span className="text-zinc-500">{reviewingMatch.players.filter(p => p.team === 'bravo').length} Players</span>
                                        </h4>
                                        <div className="space-y-1">
                                            {reviewingMatch.players.filter(p => p.team === 'bravo').map(p => (
                                                <div key={p.player_id} className="flex items-center gap-2 text-sm bg-black/20 p-2 rounded border border-white/5">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={`https://cdn.discordapp.com/avatars/${p.player_id}/${p.discord_avatar}.png`} />
                                                        <AvatarFallback className="text-[10px]">{p.discord_username?.substring(0, 2)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="overflow-hidden">
                                                        <div className="text-white font-medium truncate text-xs" title={p.discord_username}>{p.discord_username}</div>
                                                        <div className="text-zinc-500 text-[10px] truncate">{p.standoff_nickname || 'No Nick'}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Verification Controls */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-900/50 p-4 rounded-xl border border-white/5">
                                <div className="space-y-4">
                                    <h4 className="font-bold text-sm text-zinc-400 uppercase">Match Details</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Team Alpha Score</Label>
                                            <Input
                                                type="number"
                                                value={reviewAlphaScore}
                                                onChange={(e) => setReviewAlphaScore(e.target.value)}
                                                className="bg-zinc-900 border-white/10"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Team Bravo Score</Label>
                                            <Input
                                                type="number"
                                                value={reviewBravoScore}
                                                onChange={(e) => setReviewBravoScore(e.target.value)}
                                                className="bg-zinc-900 border-white/10"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Declared Winner</Label>
                                        <Select value={reviewWinner} onValueChange={setReviewWinner}>
                                            <SelectTrigger className="bg-zinc-900 border-white/10">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-zinc-900 border-white/10">
                                                <SelectItem value="alpha">Team Alpha (Winner)</SelectItem>
                                                <SelectItem value="bravo">Team Bravo (Winner)</SelectItem>
                                                <SelectItem value="draw">Draw</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="flex flex-col justify-end gap-3">
                                    <Button
                                        className="w-full bg-green-600 hover:bg-green-700"
                                        onClick={() => handleSubmitReview(true)}
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <Check className="h-4 w-4 mr-2" />
                                        )}
                                        {isSubmitting ? 'Processing...' : 'Approve & Confirm Stats'}
                                    </Button>
                                    <Button
                                        className="w-full"
                                        variant="destructive"
                                        onClick={() => handleSubmitReview(false)}
                                        disabled={isSubmitting}
                                    >
                                        <X className="h-4 w-4 mr-2" /> Reject Result
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Edit Result Dialog (Legacy/History) */}
            <Dialog open={isEditResultModalOpen} onOpenChange={setIsEditResultModalOpen}>
                <DialogContent className="bg-[#1e1f22] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Edit Match Result</DialogTitle>
                        <DialogDescription>Manually correct the score for Match #{editingMatch?.id.slice(0, 8)}</DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Team Alpha Score</Label>
                            <Input
                                type="number"
                                value={editAlphaScore}
                                onChange={(e) => setEditAlphaScore(e.target.value)}
                                className="bg-zinc-900 border-white/10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Team Bravo Score</Label>
                            <Input
                                type="number"
                                value={editBravoScore}
                                onChange={(e) => setEditBravoScore(e.target.value)}
                                className="bg-zinc-900 border-white/10"
                            />
                        </div>

                        <div className="col-span-2 space-y-2">
                            <Label>Winner</Label>
                            <Select value={editWinner} onValueChange={setEditWinner}>
                                <SelectTrigger className="bg-zinc-900 border-white/10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-white/10">
                                    <SelectItem value="alpha">Team Alpha</SelectItem>
                                    <SelectItem value="bravo">Team Bravo</SelectItem>
                                    <SelectItem value="draw">Draw</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditResultModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleEditResultSubmit}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
