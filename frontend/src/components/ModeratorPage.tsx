import { useState, useEffect } from 'react';
import { useWebSocket } from './WebSocketContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
    Users, Activity, FileText, Ban, Check, X, Search,
    Gamepad2, RefreshCw, LayoutDashboard, TrendingUp, Menu, ShieldAlert, Shield,
    Play, XCircle, Crown, Flag, PlusCircle, Trophy, Swords, ImageIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

// Interfaces
interface PendingMatch {
    id: string;
    lobby_url: string;
    host_id: string;
    host_username?: string;
    host_avatar?: string;
    status: string;
    player_count: number;
    result_screenshot_url?: string;
    winner_team?: string;
    alpha_score?: number;
    bravo_score?: number;
    created_at: string;
    updated_at: string;
    players?: MatchPlayer[];
    match_type: string;
    map_name?: string;
}

interface MatchPlayer {
    player_id: string;
    team: string;
    discord_username: string;
    discord_avatar?: string;
    standoff_nickname?: string;
    elo: number;
}

interface User {
    id: string;
    discord_username: string;
    discord_avatar: string | null;
    role: string;
    elo: number;
    mmr?: number;
    wins: number;
    losses: number;
    banned: number;
    standoff_nickname?: string;
    is_vip?: number | boolean;
    vip_until?: string;
}

interface EloHistoryEntry {
    id: number;
    match_id: string;
    elo_before: number;
    elo_after: number;
    elo_change: number;
    reason: string;
    created_at: string;
    result_screenshot_url?: string;
}

interface ModeratorStats {
    totalPlayers: number;
    waitingMatches: number;
    activeMatches: number;
    pendingReviews: number;
    completedMatches: number;
    bannedPlayers: number;
}

interface VIPRequest {
    id: string;
    user_id: string;
    discord_username: string;
    phone_number?: string;
    screenshot_url: string;
    message?: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    reviewed_at?: string;
    rejection_reason?: string;
    user_discord_username?: string;
    user_discord_avatar?: string;
}

interface ModeratorPageProps {
    user: { id: string; role?: string } | null;
    backendUrl: string;
    onViewLobby?: (lobbyId: string) => void;
}

export default function ModeratorPage({ user, backendUrl, onViewLobby }: ModeratorPageProps) {
    const { } = useWebSocket();
    const [activeView, setActiveView] = useState('overview');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
    const [activeMatchesList, setActiveMatchesList] = useState<PendingMatch[]>([]);
    const [cancelledMatches, setCancelledMatches] = useState<PendingMatch[]>([]);
    const [completedMatches, setCompletedMatches] = useState<PendingMatch[]>([]); // New: Recent completed
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState<ModeratorStats | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [, setTotalUsers] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [vipRequests, setVipRequests] = useState<VIPRequest[]>([]);
    const [vipFilter, setVipFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');

    // Edit Result State
    const [editResultMatch, setEditResultMatch] = useState<PendingMatch | null>(null);
    const [editResultForm, setEditResultForm] = useState({
        winner_team: 'alpha',
        alpha_score: 0,
        bravo_score: 0
    });

    // Clan State
    const [clans, setClans] = useState<any[]>([]);
    const [clanRequests, setClanRequests] = useState<any[]>([]);
    const [selectedClan, setSelectedClan] = useState<any>(null);

    // Assuming fetchClans is defined elsewhere, we'll verify it.
    // Defining fetchClanDetails here.
    const fetchClanDetails = async (clanId: string) => {
        try {
            const res = await fetch(`${backendUrl}/api/moderator/clans/${clanId}`, {
                headers: { 'X-User-Id': user!.id }
            });
            const data = await res.json();
            if (data.success) {
                setSelectedClan({ ...data.clan, members: data.members });
            }
        } catch (error) {
            console.error('Failed to fetch clan details', error);
        }
    };

    const handleSaveClan = async () => {
        if (!selectedClan) return;
        setProcessing(true);
        try {
            const res = await fetch(`${backendUrl}/api/moderator/clans/${selectedClan.id}/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user!.id
                },
                body: JSON.stringify({
                    name: selectedClan.name,
                    tag: selectedClan.tag,
                    elo: selectedClan.elo,
                    leader_id: selectedClan.leader_id
                })
            });
            if (res.ok) {
                fetchClans(currentPage, searchQuery);
                setSelectedClan(null);
            }
        } catch (e) { console.error(e); }
        finally { setProcessing(false); }
    };

    // Fetch Completed Matches (Recent)
    const fetchRecentMatches = async () => {
        try {
            const res = await fetch(`${backendUrl}/api/moderator/recent-matches`, {
                headers: { 'X-User-Id': user!.id }
            });
            const data = await res.json();
            if (data.success) {
                setCompletedMatches(data.matches);
            }
        } catch (e) { console.error(e); }
    };

    // Fetch Cancelled Matches
    const fetchCancelledMatches = async () => {
        try {
            const res = await fetch(`${backendUrl}/api/moderator/cancelled-matches`, {
                headers: { 'X-User-Id': user!.id }
            });
            const data = await res.json();
            if (data.success) {
                setCancelledMatches(data.matches);
            }
        } catch (e) { console.error(e); }
    };

    // const [totalClans, setTotalClans] = useState(0);

    // Match Creation State
    const [createMatchForm, setCreateMatchForm] = useState({
        host_id: '',
        match_type: 'casual',
        map_name: 'Sandstone',
        max_players: 10,
        clan_id: ''
    });

    // Modal States
    const [selectedMatch, setSelectedMatch] = useState<PendingMatch | null>(null);
    const [matchPlayers, setMatchPlayers] = useState<MatchPlayer[]>([]);
    const [reviewWinner, setReviewWinner] = useState<'alpha' | 'bravo'>('alpha');
    const [alphaScore, setAlphaScore] = useState(0);
    const [bravoScore, setBravoScore] = useState(0);
    const [eloChange, setEloChange] = useState(25);
    const [reviewNotes, setReviewNotes] = useState('');
    const [processing, setProcessing] = useState(false);
    const [uploadingScreenshot, setUploadingScreenshot] = useState(false);

    const [selectedPlayer, setSelectedPlayer] = useState<User | null>(null);
    const [playerHistory, setPlayerHistory] = useState<EloHistoryEntry[]>([]);
    const [manualEloChange, setManualEloChange] = useState(0);
    const [manualReason, setManualReason] = useState('');

    // Alert Dialog States
    const [errorDialogOpen, setErrorDialogOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{ title: string; description: string; action: () => Promise<void> } | null>(null);

    // Mock chart data - Matches Faceit Orange Theme
    const activityData = [
        { date: 'Jun 24', players: 45 },
        { date: 'Jun 25', players: 52 },
        { date: 'Jun 26', players: 48 },
        { date: 'Jun 27', players: 61 },
        { date: 'Jun 28', players: 55 },
        { date: 'Jun 29', players: 67 },
        { date: 'Jun 30', players: 58 },
    ];

    // Fetch functions
    const fetchStats = async () => {
        try {
            const response = await fetch(`${backendUrl}/api/moderator/stats`, {
                headers: { 'X-User-Id': user?.id || '' }
            });
            const data = await response.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    const fetchPendingReviews = async () => {
        try {
            const response = await fetch(`${backendUrl}/api/moderator/pending-reviews`, {
                headers: { 'X-User-Id': user?.id || '' }
            });
            const data = await response.json();
            if (data.success) {
                setPendingMatches(data.matches);
            }
        } catch (err) {
            console.error('Error fetching pending reviews:', err);
        }
    };

    const fetchActiveMatches = async () => {
        try {
            const response = await fetch(`${backendUrl}/api/moderator/active-matches`, {
                headers: { 'X-User-Id': user?.id || '' }
            });
            const data = await response.json();
            if (data.success) {
                setActiveMatchesList(data.matches);
            }
        } catch (err) {
            console.error('Error fetching active matches:', err);
        }
    };

    const fetchPlayers = async (page: number, search?: string) => {
        try {
            let url = `${backendUrl}/api/moderator/players?page=${page}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;

            const response = await fetch(url, {
                headers: { 'X-User-Id': user?.id || '' }
            });
            const data = await response.json();
            if (data.success) {
                setUsers(data.players);
                setTotalUsers(data.total);
            }
        } catch (err) {
            console.error('Error fetching players:', err);
        }
    };

    const fetchMatchDetails = async (matchId: string) => {
        try {
            const response = await fetch(`${backendUrl}/api/moderator/matches/${matchId}`, {
                headers: { 'X-User-Id': user?.id || '' }
            });
            const data = await response.json();
            if (data.success) {
                setSelectedMatch(data.match);
                setMatchPlayers(data.players);
                setReviewWinner(data.match.winner_team || 'alpha');
                setAlphaScore(data.match.alpha_score || 0);
                setBravoScore(data.match.bravo_score || 0);

                // Pre-set correct Elo change based on match type
                if (data.match.match_type === 'competitive') {
                    setEloChange(10);
                } else {
                    setEloChange(25);
                }
            }
        } catch (err) {
            console.error('Error fetching match details:', err);
        }
    };

    const fetchPlayerHistory = async (playerId: string) => {
        try {
            const response = await fetch(`${backendUrl}/api/moderator/players/${playerId}/history`, {
                headers: { 'X-User-Id': user?.id || '' }
            });
            const data = await response.json();
            if (data.success) {
                setSelectedPlayer(data.player);
                setPlayerHistory(data.eloHistory);
            }
        } catch (err) {
            console.error('Error fetching player history:', err);
        }
    };

    const fetchVipRequests = async (status: string) => {
        setProcessing(true);
        try {
            const response = await fetch(`${backendUrl}/api/moderator/vip-requests?status=${status}`, {
                headers: { 'X-User-Id': user?.id || '' }
            });
            const data = await response.json();
            if (data.success) {
                setVipRequests(data.requests);
            }
        } catch (err) {
            console.error('Error fetching VIP requests:', err);
        } finally {
            setProcessing(false);
        }
    };

    const fetchClans = async (page: number, search?: string) => {
        try {
            let url = `${backendUrl}/api/moderator/clans?page=${page}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            const response = await fetch(url, { headers: { 'X-User-Id': user?.id || '' } });
            const data = await response.json();
            if (data.success) {
                setClans(data.clans);
                // setTotalClans(data.total);
            }
        } catch (e) { console.error(e); }
    };

    const fetchClanRequests = async () => {
        try {
            const res = await fetch(`${backendUrl}/api/moderator/clan-requests`, {
                headers: { 'X-User-Id': user?.id || '' }
            });
            const data = await res.json();
            if (data.success) {
                setClanRequests(data.requests);
            }
        } catch (e) { console.error(e); }
    };

    const handleClanRequest = async (id: string, action: 'approve' | 'reject', rejectionReason?: string) => {
        if (!confirm(`Are you sure you want to ${action} this request?`)) return;
        setProcessing(true);
        try {
            const body = action === 'reject' ? { reason: rejectionReason } : {};
            const res = await fetch(`${backendUrl}/api/moderator/clan-requests/${id}/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Id': user?.id || '' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.success) {
                fetchClanRequests();
                fetchClans(1);
                setErrorMessage(`Request ${action}ed`); // Using error dialog for success feedback momentarily
                setErrorDialogOpen(true);
            } else {
                setErrorMessage(data.error);
                setErrorDialogOpen(true);
            }
        } catch (e) { console.error(e); }
        finally { setProcessing(false); }
    };

    const handleDeleteClan = async (clanId: string) => {
        if (!confirm('Are you sure? This will delete the clan and all memberships.')) return;
        try {
            const res = await fetch(`${backendUrl}/api/moderator/clans/${clanId}/delete`, {
                method: 'POST', headers: { 'X-User-Id': user?.id || '' }
            });
            if (res.ok) fetchClans(currentPage, searchQuery);
        } catch (e) { console.error(e); }
    };

    const handleCreateMatch = async () => {
        setProcessing(true);
        try {
            const res = await fetch(`${backendUrl}/api/moderator/matches/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Id': user?.id || '' },
                body: JSON.stringify(createMatchForm)
            });
            const data = await res.json();
            if (data.success) {
                setErrorMessage(`Match Created! ID: ${data.matchId}`); // Abuse error dialog for success msg for now
                setErrorDialogOpen(true);
                setCreateMatchForm({ ...createMatchForm, host_id: '' });
                fetchActiveMatches();
            } else {
                setErrorMessage(data.error);
                setErrorDialogOpen(true);
            }
        } catch (e) { console.error(e); }
        finally { setProcessing(false); }
    };

    useEffect(() => {
        fetchStats();
        fetchPendingReviews();
        fetchActiveMatches();
        fetchVipRequests(vipFilter);
        fetchClanRequests();
    }, [backendUrl, user, vipFilter]);

    useEffect(() => {
        if (activeView === 'clans') {
            fetchClans(1);
        } else if (activeView === 'history') { // Changed from cancelled
            fetchCancelledMatches();
            fetchRecentMatches(); // Fetch completed too
        }
    }, [activeView]);

    // Sidebar navigation items
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'reviews', label: 'Reviews', icon: FileText, badge: stats?.pendingReviews },
        { id: 'clan-requests', label: 'Clan Requests', icon: ShieldAlert, badge: clanRequests.length },
        { id: 'vip-requests', label: 'VIP Requests', icon: Crown },
        { id: 'players', label: 'Players', icon: Users },
        { id: 'clans', label: 'Clans', icon: Flag },
        { id: 'matches', label: 'Active Matches', icon: Gamepad2 },
        { id: 'history', label: 'History', icon: XCircle }, // Changed ID and Label
        { id: 'matchmaking', label: 'Match Creation', icon: PlusCircle },
    ];

    const handleEditResultSubmit = async () => {
        if (!editResultMatch) return;
        setProcessing(true);
        try {
            const res = await fetch(`${backendUrl}/api/moderator/matches/${editResultMatch.id}/edit-result`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Id': user?.id || '' },
                body: JSON.stringify(editResultForm)
            });
            const data = await res.json();
            if (data.success) {
                setEditResultMatch(null);
                setErrorMessage("Match Result Updated Successfully"); // Reuse for success
                setErrorDialogOpen(true);
                fetchRecentMatches(); // Refresh list
            } else {
                setErrorMessage(data.error);
                setErrorDialogOpen(true);
            }
        } catch (e) {
            setErrorMessage('Network error');
            setErrorDialogOpen(true);
        } finally {
            setProcessing(false);
        }
    };

    const handleReviewMatch = async (approved: boolean) => {
        if (!selectedMatch) return;
        setProcessing(true);

        try {
            const response = await fetch(`${backendUrl}/api/moderator/matches/${selectedMatch.id}/review`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user?.id || ''
                },
                body: JSON.stringify({
                    approved,
                    winner_team: approved ? reviewWinner : undefined,
                    alpha_score: approved ? alphaScore : undefined,
                    bravo_score: approved ? bravoScore : undefined,
                    elo_change: eloChange,
                    notes: reviewNotes
                })
            });

            const data = await response.json();
            if (data.success) {
                setSelectedMatch(null);
                setMatchPlayers([]);
                fetchPendingReviews();
                fetchStats();
            } else {
                setErrorMessage(data.error || 'Failed to review match');
                setErrorDialogOpen(true);
            }
        } catch (err) {
            setErrorMessage('Network error');
            setErrorDialogOpen(true);
        } finally {
            setProcessing(false);
        }
    };

    const handleManualEloAdjust = async () => {
        if (!selectedPlayer || manualEloChange === 0 || !manualReason) return;
        setProcessing(true);

        try {
            const response = await fetch(`${backendUrl}/api/moderator/players/${selectedPlayer.id}/elo-adjust`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user?.id || ''
                },
                body: JSON.stringify({
                    elo_change: manualEloChange,
                    reason: manualReason
                })
            });

            const data = await response.json();
            if (data.success) {
                setManualEloChange(0);
                setManualReason('');
                fetchPlayerHistory(selectedPlayer.id);
                setUsers(users.map(u => u.id === selectedPlayer.id ? { ...u, elo: data.newElo } : u));
            } else {
                setErrorMessage(data.error || 'Failed to adjust ELO');
                setErrorDialogOpen(true);
            }
        } catch (err) {
            setErrorMessage('Network error');
            setErrorDialogOpen(true);
        } finally {
            setProcessing(false);
        }
    };

    const handleBanToggle = async (playerId: string, ban: boolean) => {
        try {
            const endpoint = ban ? 'ban' : 'unban';
            const response = await fetch(`${backendUrl}/api/moderator/players/${playerId}/${endpoint}`, {
                method: 'POST',
                headers: { 'X-User-Id': user?.id || '' }
            });
            const data = await response.json();
            if (data.success) {
                fetchPlayers(currentPage, searchQuery);
            } else {
                setErrorMessage('Failed to update ban status');
                setErrorDialogOpen(true);
            }
        } catch (err) {
            setErrorMessage('Network error');
            setErrorDialogOpen(true);
        }
    };

    const handleVipToggle = async (playerId: string, grant: boolean) => {
        if (!user) return;
        setProcessing(true);

        try {
            const endpoint = grant ? 'grant' : 'revoke';
            const response = await fetch(`${backendUrl}/api/moderator/players/${playerId}/vip/${endpoint}`, {
                method: 'POST',
                headers: { 'X-User-Id': user.id }
            });

            const data = await response.json();
            if (data.success) {
                // Refresh player data
                if (selectedPlayer && selectedPlayer.id === playerId) {
                    fetchPlayerHistory(playerId);
                }
                fetchPlayers(currentPage, searchQuery);
            } else {
                setErrorMessage(data.error || `Failed to ${grant ? 'grant' : 'revoke'} VIP`);
                setErrorDialogOpen(true);
            }
        } catch (err) {
            setErrorMessage('Network error');
            setErrorDialogOpen(true);
        } finally {
            setProcessing(false);
        }
    };

    const handleCancelMatch = (matchId: string) => {
        setConfirmConfig({
            title: "Cancel Match?",
            description: "Are you sure you want to cancel this match? This action cannot be undone.",
            action: async () => {
                try {
                    const response = await fetch(`${backendUrl}/api/moderator/matches/${matchId}/cancel`, {
                        method: 'POST',
                        headers: { 'X-User-Id': user?.id || '' }
                    });

                    if (response.ok) {
                        fetchActiveMatches();
                    } else {
                        setErrorMessage('Failed to cancel match');
                        setErrorDialogOpen(true);
                    }
                } catch (error) {
                    console.error('Error cancelling match:', error);
                    setErrorMessage('Network error');
                    setErrorDialogOpen(true);
                }
            }
        });
        setConfirmDialogOpen(true);
    };

    const handleForceStartMatch = (matchId: string) => {
        setConfirmConfig({
            title: "Force Start Match?",
            description: "Are you sure you want to force start this match? This will immediately retrieve the lobby status.",
            action: async () => {
                try {
                    const response = await fetch(`${backendUrl}/api/moderator/matches/${matchId}/force-start`, {
                        method: 'POST',
                        headers: { 'X-User-Id': user?.id || '' }
                    });

                    if (response.ok) {
                        fetchActiveMatches();
                    } else {
                        setErrorMessage('Failed to force start match');
                        setErrorDialogOpen(true);
                    }
                } catch (error) {
                    console.error('Error starting match:', error);
                    setErrorMessage('Network error');
                    setErrorDialogOpen(true);
                }
            }
        });
        setConfirmDialogOpen(true);
    };

    const handleVipRequest = async (requestId: string, approve: boolean, reason?: string) => {
        if (!user) return;
        setProcessing(true);

        try {
            const endpoint = approve ? 'approve' : 'reject';
            const response = await fetch(`${backendUrl}/api/moderator/vip-requests/${requestId}/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user.id
                },
                body: JSON.stringify({ reason })
            });

            const data = await response.json();
            if (data.success) {
                fetchVipRequests(vipFilter);
                fetchStats();
            } else {
                setErrorMessage(data.error || `Failed to ${endpoint} VIP request`);
                setErrorDialogOpen(true);
            }
        } catch (err) {
            setErrorMessage('Network error');
            setErrorDialogOpen(true);
        } finally {
            setProcessing(false);
        }
    };

    const alphaPlayers = matchPlayers.filter(p => p.team === 'alpha');
    const bravoPlayers = matchPlayers.filter(p => p.team === 'bravo');

    // Get team leader names (first player in each team)
    const alphaLeader = alphaPlayers[0];
    const bravoLeader = bravoPlayers[0];
    const alphaTeamName = alphaLeader
        ? (alphaLeader.standoff_nickname || alphaLeader.discord_username || 'Team Alpha')
        : 'Team Alpha';
    const bravoTeamName = bravoLeader
        ? (bravoLeader.standoff_nickname || bravoLeader.discord_username || 'Team Bravo')
        : 'Team Bravo';



    const renderClanRequests = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-bold font-display text-white">Clan Requests</h3>
                    <p className="text-muted-foreground">Review and approve new clan creations</p>
                </div>
                <Button variant="outline" onClick={fetchClanRequests} disabled={processing}>
                    <RefreshCw className={cn("mr-2 h-4 w-4", processing && "animate-spin")} />
                    {processing ? 'Loading...' : 'Refresh'}
                </Button>
            </div>

            {clanRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border border-dashed border-white/10 rounded-lg">
                    <ShieldAlert className="h-12 w-12 mb-4 text-gray-500" />
                    <h3 className="text-lg font-medium text-white">No Pending Requests</h3>
                    <p>All clan requests have been handled.</p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {clanRequests.map((req) => (
                        <Card key={req.id} className="bg-zinc-950 border-white/10 hover:border-primary/50 transition-all overflow-hidden group">
                            <div className="relative aspect-video w-full bg-zinc-900 cursor-pointer" onClick={() => window.open(req.screenshot_url, '_blank')}>
                                <img src={req.screenshot_url} alt="Payment" className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                                <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                                    <Badge variant="outline" className="bg-black/50 text-white border-white/20 backdrop-blur-sm">
                                        {req.clan_size} Members
                                    </Badge>
                                    <span className="text-[10px] text-gray-400">{new Date(req.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <CardContent className="p-4 space-y-4">
                                <div>
                                    <div className="flex justify-between items-start">
                                        <h4 className="text-lg font-bold text-white mb-1">[{req.clan_tag}] {req.clan_name}</h4>
                                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">{req.status}</Badge>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={`https://cdn.discordapp.com/avatars/${req.user_id}/${req.discord_avatar}.png`} />
                                            <AvatarFallback>{req.discord_username?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="text-xs text-gray-300">Leader: <span className="text-white font-medium">{req.discord_username}</span></span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-2">
                                    <Button
                                        className="bg-green-600 hover:bg-green-700 text-white font-bold"
                                        size="sm"
                                        onClick={() => handleClanRequest(req.id, 'approve')}
                                        disabled={processing}
                                    >
                                        <Check className="mr-2 h-4 w-4" /> Approve
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="font-bold"
                                        onClick={() => {
                                            const reason = prompt('Rejection reason:');
                                            if (reason) handleClanRequest(req.id, 'reject', reason);
                                        }}
                                        disabled={processing}
                                    >
                                        <X className="mr-2 h-4 w-4" /> Reject
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );

    const renderDashboard = () => (
        <div className="space-y-8 animate-fade-in">
            {/* Stats Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="hover:shadow-lg transition-all border-t-4 border-t-primary bg-zinc-950/50 backdrop-blur-sm border-white/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Total Players</CardTitle>
                        <Users className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{stats?.totalPlayers || 0}</div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <TrendingUp className="h-3 w-3 text-green-500" />
                            <span className="text-green-500">+12%</span> last 30 days
                        </p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-lg transition-all border-t-4 border-t-green-500 bg-zinc-950/50 backdrop-blur-sm border-white/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Active Matches</CardTitle>
                        <Activity className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{stats?.activeMatches || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Live games in progress</p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-lg transition-all border-t-4 border-t-orange-500 bg-zinc-950/50 backdrop-blur-sm border-white/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Pending Reviews</CardTitle>
                        <ShieldAlert className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{stats?.pendingReviews || 0}</div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            Requires moderator action
                        </p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-lg transition-all border-t-4 border-t-red-600 bg-zinc-950/50 backdrop-blur-sm border-white/10">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-400">Banned Players</CardTitle>
                        <Ban className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{stats?.bannedPlayers || 0}</div>
                        <p className="text-xs text-muted-foreground mt-1">Permanent & Temporary</p>
                    </CardContent>
                </Card>
            </div>

            {/* Chart */}
            <Card className="col-span-4 bg-zinc-950/50 backdrop-blur-sm border-white/10">
                <CardHeader>
                    <CardTitle className="text-white">Player Activity</CardTitle>
                    <CardDescription>Daily active users (7d)</CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer
                        config={{
                            players: {
                                label: "Players",
                                color: "hsl(24, 95%, 53%)", // Faceit Orange
                            },
                        }}
                        className="h-[300px] w-full"
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={activityData}>
                                <defs>
                                    <linearGradient id="colorPlayers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(24, 95%, 53%)" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="hsl(24, 95%, 53%)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-white/5" />
                                <XAxis dataKey="date" className="text-xs" stroke="#666" />
                                <YAxis className="text-xs" stroke="#666" />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Area type="monotone" dataKey="players" stroke="hsl(24, 95%, 53%)" fillOpacity={1} fill="url(#colorPlayers)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </CardContent>
            </Card>

            {/* Recent Activity */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-zinc-950/50 backdrop-blur-sm border-white/10">
                    <CardHeader>
                        <CardTitle className="text-white">Recent Reviews</CardTitle>
                        <CardDescription>Latest match reviews pending approval</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {pendingMatches.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                                    <Check className="h-8 w-8 mb-2 text-green-500" />
                                    <p>All clean. No reviews pending.</p>
                                </div>
                            ) : (
                                pendingMatches.slice(0, 3).map(match => (
                                    <div key={match.id} className="flex items-center justify-between border-b border-white/5 pb-4 last:border-0 last:pb-0">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium leading-none text-white">
                                                Match #{match.id.slice(0, 8)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Host: {match.host_username}
                                            </p>
                                        </div>
                                        <Button size="sm" variant="outline" className="text-primary hover:text-white hover:bg-primary" onClick={() => fetchMatchDetails(match.id)}>
                                            Review
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-zinc-950/50 backdrop-blur-sm border-white/10">
                    <CardHeader>
                        <CardTitle className="text-white">Quick Actions</CardTitle>
                        <CardDescription>Common moderator tasks</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Button variant="secondary" className="w-full justify-start bg-zinc-900 text-gray-300 hover:bg-zinc-800 hover:text-white" onClick={() => { setActiveView('players'); fetchPlayers(1); }}>
                            <Search className="mr-2 h-4 w-4" /> Find Player
                        </Button>
                        <Button variant="secondary" className="w-full justify-start bg-zinc-900 text-gray-300 hover:bg-zinc-800 hover:text-white" onClick={() => { setActiveView('matches'); fetchActiveMatches(); }}>
                            <Gamepad2 className="mr-2 h-4 w-4" /> View Active Lobbies
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );

    const renderReviews = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-bold font-display text-white">Match Reviews</h3>
                    <p className="text-muted-foreground">Review and approve match results</p>
                </div>
                <Button variant="outline" onClick={fetchPendingReviews}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                </Button>
            </div>

            {/* League Reviews */}
            <div className="space-y-4">
                <h4 className="text-lg font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-2">
                    <Trophy className="h-5 w-5" /> League Matches
                </h4>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {pendingMatches.filter(m => m.match_type === 'league').map(match => (
                        <Card key={match.id} className="cursor-pointer hover:shadow-lg transition-all bg-zinc-950 border-white/10 hover:border-yellow-500/50 group" onClick={() => fetchMatchDetails(match.id)}>
                            <div className="relative aspect-video w-full bg-zinc-900 overflow-hidden rounded-t-lg">
                                {match.result_screenshot_url ? (
                                    <img src={match.result_screenshot_url} alt="Result" className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">No Screenshot</div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                                <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                                    <Badge variant="secondary" className="bg-orange-500 text-white border-none">Pending</Badge>
                                    <span className="text-xs text-gray-300">{new Date(match.updated_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <CardContent className="p-4">
                                <h4 className="font-bold text-white mb-1">Match #{match.id.slice(0, 8)}</h4>
                                <p className="text-sm text-gray-400 mb-4">Host: {match.host_username}</p>
                                <Button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold">Review League</Button>
                            </CardContent>
                        </Card>
                    ))}
                    {pendingMatches.filter(m => m.match_type === 'league').length === 0 && (
                        <div className="col-span-full p-8 text-center text-muted-foreground border border-dashed border-white/10 rounded-lg">
                            No pending league reviews.
                        </div>
                    )}
                </div>
            </div>

            <div className="w-full h-px bg-white/10 my-4" />

            {/* Competitive Reviews */}
            <div className="space-y-4">
                <h4 className="text-lg font-bold text-blue-500 uppercase tracking-widest flex items-center gap-2">
                    <Swords className="h-5 w-5" /> Competitive Matches
                </h4>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {pendingMatches.filter(m => m.match_type === 'competitive').map(match => (
                        <Card key={match.id} className="cursor-pointer hover:shadow-lg transition-all bg-zinc-950 border-white/10 hover:border-blue-500/50 group" onClick={() => fetchMatchDetails(match.id)}>
                            <div className="relative aspect-video w-full bg-zinc-900 overflow-hidden rounded-t-lg">
                                {match.result_screenshot_url ? (
                                    <img src={match.result_screenshot_url} alt="Result" className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">No Screenshot</div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                                <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                                    <Badge variant="secondary" className="bg-orange-500 text-white border-none">Pending</Badge>
                                    <span className="text-xs text-gray-300">{new Date(match.updated_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <CardContent className="p-4">
                                <h4 className="font-bold text-white mb-1">Match #{match.id.slice(0, 8)}</h4>
                                <p className="text-sm text-gray-400 mb-4">Host: {match.host_username}</p>
                                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold">Review Competitive</Button>
                            </CardContent>
                        </Card>
                    ))}
                    {pendingMatches.filter(m => m.match_type === 'competitive').length === 0 && (
                        <div className="col-span-full p-8 text-center text-muted-foreground border border-dashed border-white/10 rounded-lg">
                            No pending competitive reviews.
                        </div>
                    )}
                </div>
            </div>

            <div className="w-full h-px bg-white/10 my-4" />

            {/* Clan War Reviews */}
            <div className="space-y-4">
                <h4 className="text-lg font-bold text-purple-500 uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5" /> Clan Wars
                </h4>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {pendingMatches.filter(m => m.match_type === 'clan_war' || m.match_type === 'clan_match').map(match => (
                        <Card key={match.id} className="cursor-pointer hover:shadow-lg transition-all bg-zinc-950 border-white/10 hover:border-purple-500/50 group" onClick={() => fetchMatchDetails(match.id)}>
                            <div className="relative aspect-video w-full bg-zinc-900 overflow-hidden rounded-t-lg">
                                {match.result_screenshot_url ? (
                                    <img src={match.result_screenshot_url} alt="Result" className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">No Screenshot</div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                                <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                                    <Badge variant="secondary" className="bg-orange-500 text-white border-none">Pending</Badge>
                                    <span className="text-xs text-gray-300">{new Date(match.updated_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <CardContent className="p-4">
                                <h4 className="font-bold text-white mb-1">Match #{match.id.slice(0, 8)}</h4>
                                <p className="text-sm text-gray-400 mb-4">Host: {match.host_username}</p>
                                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold">Review Clan War</Button>
                            </CardContent>
                        </Card>
                    ))}
                    {pendingMatches.filter(m => m.match_type === 'clan_war' || m.match_type === 'clan_match').length === 0 && (
                        <div className="col-span-full p-8 text-center text-muted-foreground border border-dashed border-white/10 rounded-lg">
                            No pending clan war reviews.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const renderPlayers = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-bold font-display text-white">Player Management</h3>
                    <p className="text-muted-foreground">Search and manage players</p>
                </div>
            </div>
            <div className="flex items-center space-x-2">
                <Input
                    placeholder="Search players by name..."
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchPlayers(1, searchQuery)}
                    className="max-w-[300px] bg-zinc-900 border-white/10 text-white"
                />
                <Button onClick={() => fetchPlayers(1, searchQuery)}>Search</Button>
            </div>

            <Card className="bg-zinc-950/50 backdrop-blur-sm border-white/10">
                <Table>
                    <TableHeader className="bg-zinc-900/50">
                        <TableRow className="border-white/10 hover:bg-transparent">
                            <TableHead className="text-gray-400">Player</TableHead>
                            <TableHead className="text-gray-400">ELO</TableHead>
                            <TableHead className="text-gray-400">W/L</TableHead>
                            <TableHead className="text-gray-400">Role</TableHead>
                            <TableHead className="text-gray-400">Status</TableHead>
                            <TableHead className="text-right text-gray-400">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((u) => (
                            <TableRow key={u.id} className="border-white/5 hover:bg-white/5 transition-colors">
                                <TableCell className="font-medium text-white">
                                    <div className="flex items-center space-x-2">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={`https://cdn.discordapp.com/avatars/${u.id}/${u.discord_avatar}.png`} />
                                            <AvatarFallback>{u.discord_username[0]?.toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1">
                                                <span>{u.discord_username}</span>
                                                {u.is_vip === 1 && (
                                                    <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-[8px] h-3 px-1 border-none text-black font-bold">VIP</Badge>
                                                )}
                                            </div>
                                            {u.standoff_nickname && <span className="text-xs text-muted-foreground">{u.standoff_nickname}</span>}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-primary font-mono">{u.elo || 1000}</TableCell>
                                <TableCell className="text-gray-400">{u.wins}/{u.losses}</TableCell>
                                <TableCell>
                                    <Badge variant={u.role === 'admin' ? 'destructive' : u.role === 'moderator' ? 'default' : 'secondary'} className="uppercase text-[10px]">
                                        {u.role}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {u.banned === 1 ? <Badge variant="destructive">Banned</Badge> : <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Active</Badge>}
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button variant="ghost" size="sm" onClick={() => fetchPlayerHistory(u.id)} className="text-gray-400 hover:text-white">History</Button>
                                    <Button
                                        variant={u.banned === 1 ? "default" : "destructive"}
                                        size="sm"
                                        onClick={() => handleBanToggle(u.id, u.banned !== 1)}
                                    >
                                        {u.banned === 1 ? 'Unban' : 'Ban'}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
            <div className="flex items-center justify-end space-x-2 py-4">
                <Button variant="outline" size="sm" onClick={() => { setCurrentPage(p => p - 1); fetchPlayers(currentPage - 1, searchQuery); }} disabled={currentPage === 1}>
                    Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setCurrentPage(p => p + 1); fetchPlayers(currentPage + 1, searchQuery); }} disabled={users.length < 50}>
                    Next
                </Button>
            </div>
        </div>
    );

    const renderVipRequests = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-bold font-display text-white">VIP Requests</h3>
                    <p className="text-muted-foreground">Review payment screenshots and grant VIP status</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={vipFilter} onValueChange={(v: any) => setVipFilter(v)}>
                        <SelectTrigger className="w-[180px] bg-zinc-900 border-white/10">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => fetchVipRequests(vipFilter)} disabled={processing}>
                        <RefreshCw className={cn("mr-2 h-4 w-4", processing && "animate-spin")} />
                        {processing ? 'Loading...' : 'Refresh'}
                    </Button>
                </div>
            </div>

            {processing && vipRequests.length === 0 ? (
                <div className="col-span-full h-64 flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {vipRequests.map(req => (
                        <Card key={req.id} className="bg-zinc-950 border-white/10 hover:border-yellow-500/50 transition-all group overflow-hidden">
                            <div className="relative aspect-video w-full bg-zinc-900 cursor-pointer" onClick={() => window.open(req.screenshot_url, '_blank')}>
                                <img src={req.screenshot_url} alt="Payment" className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                                <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                                    <Badge variant={req.status === 'pending' ? 'default' : req.status === 'approved' ? 'secondary' : 'destructive'}>
                                        {req.status}
                                    </Badge>
                                    <span className="text-[10px] text-gray-400">{new Date(req.created_at).toLocaleString()}</span>
                                </div>
                            </div>
                            <CardContent className="p-4 space-y-4">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={`https://cdn.discordapp.com/avatars/${req.user_id}/${req.user_discord_avatar}.png`} />
                                        <AvatarFallback>{req.user_discord_username?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-white">{req.user_discord_username}</span>
                                        <span className="text-[10px] text-gray-400 font-mono">{req.user_id}</span>
                                    </div>
                                </div>

                                {req.phone_number && (
                                    <div className="text-xs text-gray-300">
                                        <span className="text-gray-500 mr-2">Phone:</span>
                                        {req.phone_number}
                                    </div>
                                )}

                                {req.message && (
                                    <div className="text-xs text-gray-300 bg-zinc-900/50 p-2 rounded italic border-l-2 border-primary">
                                        "{req.message}"
                                    </div>
                                )}

                                {req.status === 'pending' && user?.role === 'admin' && (
                                    <div className="grid grid-cols-2 gap-2 pt-2">
                                        <Button
                                            size="sm"
                                            className="bg-green-600 hover:bg-green-700 text-white font-bold"
                                            onClick={() => {
                                                setConfirmConfig({
                                                    title: `Approve VIP for ${req.user_discord_username}?`,
                                                    description: "This will grant the user VIP status.",
                                                    action: async () => handleVipRequest(req.id, true)
                                                });
                                                setConfirmDialogOpen(true);
                                            }}
                                            disabled={processing}
                                        >
                                            <Check className="mr-2 h-4 w-4" /> Approve
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            className="font-bold"
                                            onClick={() => {
                                                const reason = prompt('Rejection reason:');
                                                if (reason !== null) {
                                                    handleVipRequest(req.id, false, reason);
                                                }
                                            }}
                                            disabled={processing}
                                        >
                                            <X className="mr-2 h-4 w-4" /> Reject
                                        </Button>
                                    </div>
                                )}

                                {req.status === 'rejected' && req.rejection_reason && (
                                    <div className="text-xs text-red-400 bg-red-900/10 p-2 rounded border border-red-900/30">
                                        <span className="font-bold">Rejected:</span> {req.rejection_reason}
                                    </div>
                                )}

                                {req.status === 'approved' && (
                                    <div className="text-xs text-green-400 bg-green-900/10 p-2 rounded border border-green-900/30">
                                        <span className="font-bold">Approved at:</span> {req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString() : 'N/A'}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                    {vipRequests.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center p-12 text-muted-foreground border border-dashed border-white/10 rounded-lg">
                            <Check className="h-12 w-12 mb-4 text-green-500" />
                            <h3 className="text-lg font-medium text-white">No requests</h3>
                            <p>No VIP requests found for this filter.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    const renderClans = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold font-display text-white">Clan Management</h3>
                <div className="flex gap-2">
                    <Input placeholder="Search clans..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-[200px] bg-zinc-900 border-white/10" />
                    <Button onClick={() => fetchClans(1, searchQuery)}>Search</Button>
                </div>
            </div>
            <Card className="bg-zinc-950/50 backdrop-blur-sm border-white/10">
                <Table>
                    <TableHeader className="bg-zinc-900/50">
                        <TableRow className="border-white/10"><TableHead>Name</TableHead><TableHead>Tag</TableHead><TableHead>Leader</TableHead><TableHead>Members</TableHead><TableHead>Actions</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                        {clans.map(c => (
                            <TableRow key={c.id}>
                                <TableCell className="text-white">{c.name}</TableCell>
                                <TableCell><Badge variant="outline">{c.tag}</Badge></TableCell>
                                <TableCell className="text-gray-400">{c.leader_username}</TableCell>
                                <TableCell className="text-gray-400">{c.member_count}</TableCell>
                                <TableCell>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => fetchClanDetails(c.id)}>View / Edit</Button>
                                        <Button variant="destructive" size="sm" onClick={() => handleDeleteClan(c.id)}>Delete</Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );

    const renderMatchmaking = () => (
        <div className="space-y-6 animate-fade-in max-w-xl mx-auto">
            <h3 className="text-2xl font-bold font-display text-white">Manual Match Creation</h3>
            <Card className="bg-zinc-950/50 border-white/10">
                <CardContent className="space-y-4 pt-6">
                    <div className="space-y-2">
                        <label className="text-gray-400 text-sm">Host ID (Discord User ID)</label>
                        <Input value={createMatchForm.host_id} onChange={e => setCreateMatchForm({ ...createMatchForm, host_id: e.target.value })} placeholder="Host ID" className="bg-zinc-900 border-white/10" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-gray-400 text-sm">Match Type</label>
                        <Select value={createMatchForm.match_type} onValueChange={(v: any) => setCreateMatchForm({ ...createMatchForm, match_type: v })}>
                            <SelectTrigger className="bg-zinc-900 border-white/10"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="casual">Casual</SelectItem>
                                <SelectItem value="league">League</SelectItem>
                                <SelectItem value="clan_lobby">Clan Lobby</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-gray-400 text-sm">Map</label>
                        <Select value={createMatchForm.map_name} onValueChange={v => setCreateMatchForm({ ...createMatchForm, map_name: v })}>
                            <SelectTrigger className="bg-zinc-900 border-white/10"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Sandstone">Sandstone</SelectItem>
                                <SelectItem value="Rust">Rust</SelectItem>
                                <SelectItem value="Province">Province</SelectItem>
                                <SelectItem value="Sakura">Sakura</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-gray-400 text-sm">Max Players</label>
                        <Input type="number" value={createMatchForm.max_players} onChange={e => setCreateMatchForm({ ...createMatchForm, max_players: parseInt(e.target.value) })} className="bg-zinc-900 border-white/10" />
                    </div>
                    {createMatchForm.match_type === 'clan_lobby' && (
                        <div className="space-y-2">
                            <label className="text-gray-400 text-sm">Clan ID (Optional)</label>
                            <Input value={createMatchForm.clan_id} onChange={e => setCreateMatchForm({ ...createMatchForm, clan_id: e.target.value })} placeholder="Clan ID" className="bg-zinc-900 border-white/10" />
                        </div>
                    )}
                    <Button className="w-full mt-4" onClick={handleCreateMatch} disabled={processing}>
                        {processing ? 'Creating...' : 'Create Match'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );

    // Submit Result State
    const [submitResultMatch, setSubmitResultMatch] = useState<PendingMatch | null>(null);
    const [submitResultForm, setSubmitResultForm] = useState({
        winner_team: 'alpha',
        alpha_score: 10,
        bravo_score: 8,
        screenshot_url: ''
    });

    // Screenshot Upload Handler
    const handleScreenshotUpload = async (file: File, isReview: boolean = false) => {
        setUploadingScreenshot(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${backendUrl}/api/upload`, {
                method: 'POST',
                headers: {
                    'X-User-Id': user?.id || ''
                },
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                if (isReview) {
                    // Update the selected match's screenshot URL for review
                    if (selectedMatch) {
                        setSelectedMatch({ ...selectedMatch, result_screenshot_url: data.url });
                    }
                } else {
                    // Update submit result form
                    setSubmitResultForm({ ...submitResultForm, screenshot_url: data.url });
                }
            } else {
                setErrorMessage(data.error || 'Failed to upload screenshot');
                setErrorDialogOpen(true);
            }
        } catch (error) {
            setErrorMessage('Network error during upload');
            setErrorDialogOpen(true);
        } finally {
            setUploadingScreenshot(false);
        }
    };

    const handleSubmitResult = async () => {
        if (!submitResultMatch) return;
        setProcessing(true);
        try {
            const res = await fetch(`${backendUrl}/api/moderator/matches/${submitResultMatch.id}/force-result`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Id': user?.id || '' },
                body: JSON.stringify(submitResultForm)
            });
            const data = await res.json();
            if (data.success) {
                setErrorMessage('Result Submitted Successfully'); // Use existing error dialog for success
                setErrorDialogOpen(true);
                setSubmitResultMatch(null);
                fetchActiveMatches();
            } else {
                setErrorMessage(data.error || 'Failed to submit result');
                setErrorDialogOpen(true);
            }
        } catch (e) {
            setErrorMessage('Network error');
            setErrorDialogOpen(true);
        } finally {
            setProcessing(false);
        }
    };

    const renderMatches = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-bold font-display text-white">Active Matches</h3>
                    <p className="text-muted-foreground">Live lobbies and matches in progress</p>
                </div>
                <Button variant="outline" onClick={fetchActiveMatches}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                </Button>
            </div>

            {/* League Matches */}
            <div className="space-y-4">
                <h4 className="text-lg font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-2">
                    <Trophy className="h-5 w-5" /> League Matches
                </h4>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {activeMatchesList.filter(m => m.match_type === 'league').map(match => (
                        <MatchCard key={match.id} match={match} color="yellow" icon={<Trophy className="h-4 w-4" />} onViewLobby={onViewLobby} onForceStart={handleForceStartMatch} onCancel={handleCancelMatch} onSubmitResult={(m: any) => setSubmitResultMatch(m)} />
                    ))}
                    {activeMatchesList.filter(m => m.match_type === 'league').length === 0 && (
                        <EmptyPlaceholder text="No active league matches." />
                    )}
                </div>
            </div>

            <div className="w-full h-px bg-white/10 my-4" />

            {/* Competitive Matches */}
            <div className="space-y-4">
                <h4 className="text-lg font-bold text-blue-500 uppercase tracking-widest flex items-center gap-2">
                    <Swords className="h-5 w-5" /> Competitive Matches
                </h4>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {activeMatchesList.filter(m => m.match_type === 'competitive').map(match => (
                        <MatchCard key={match.id} match={match} color="blue" icon={<Swords className="h-4 w-4" />} onViewLobby={onViewLobby} onForceStart={handleForceStartMatch} onCancel={handleCancelMatch} onSubmitResult={(m: any) => setSubmitResultMatch(m)} />
                    ))}
                    {activeMatchesList.filter(m => m.match_type === 'competitive').length === 0 && (
                        <EmptyPlaceholder text="No active competitive matches." />
                    )}
                </div>
            </div>

            <div className="w-full h-px bg-white/10 my-4" />

            {/* Clan War Matches */}
            <div className="space-y-4">
                <h4 className="text-lg font-bold text-purple-500 uppercase tracking-widest flex items-center gap-2">
                    <Swords className="h-5 w-5" /> Clan Wars
                </h4>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {activeMatchesList.filter(m => m.match_type === 'clan_war' || m.match_type === 'clan_match').map(match => (
                        <MatchCard key={match.id} match={match} color="purple" icon={<Swords className="h-4 w-4" />} onViewLobby={onViewLobby} onForceStart={handleForceStartMatch} onCancel={handleCancelMatch} onSubmitResult={(m: any) => setSubmitResultMatch(m)} />
                    ))}
                    {activeMatchesList.filter(m => m.match_type === 'clan_war' || m.match_type === 'clan_match').length === 0 && (
                        <EmptyPlaceholder text="No active clan wars." />
                    )}
                </div>
            </div>

            <div className="w-full h-px bg-white/10 my-4" />

            {/* Casual Matches */}
            <div className="space-y-4">
                <h4 className="text-lg font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Gamepad2 className="h-5 w-5" /> Casual Matches
                </h4>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {activeMatchesList.filter(m => ['league', 'competitive', 'clan_war', 'clan_match'].indexOf(m.match_type) === -1).map(match => (
                        <MatchCard key={match.id} match={match} color="gray" icon={<Gamepad2 className="h-4 w-4" />} onViewLobby={onViewLobby} onForceStart={handleForceStartMatch} onCancel={handleCancelMatch} onSubmitResult={(m: any) => setSubmitResultMatch(m)} />
                    ))}
                    {activeMatchesList.filter(m => ['league', 'competitive', 'clan_war', 'clan_match'].indexOf(m.match_type) === -1).length === 0 && (
                        <EmptyPlaceholder text="No active casual matches." />
                    )}
                </div>
            </div>

            {/* Submit Result Modal */}
            <Dialog open={!!submitResultMatch} onOpenChange={(open) => !open && setSubmitResultMatch(null)}>
                <DialogContent className="max-w-2xl bg-zinc-950 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-display flex items-center gap-2">
                            <Swords className="h-6 w-6 text-primary" />
                            Manual Result Submission
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Manually override and submit the final score for this match.
                        </DialogDescription>
                    </DialogHeader>

                    {submitResultMatch && (
                        <div className="space-y-6 pt-2">
                            {/* Match Context Banner */}
                            <div className="bg-zinc-900/50 border border-white/5 rounded-lg p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-16 bg-zinc-800 rounded overflow-hidden relative">
                                        {/* Placeholder for Map Image if available, or just icon */}
                                        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold uppercase text-white/20">
                                            {submitResultMatch.map_name || 'Map'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="font-bold text-white mb-0.5">{submitResultMatch.map_name || 'Unknown Map'}</div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                                            <span className="font-mono">#{submitResultMatch.id.slice(0, 8)}</span>
                                            <span className="w-1 h-1 rounded-full bg-gray-500"></span>
                                            <span className="uppercase text-yellow-500">{submitResultMatch.match_type}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Status</div>
                                    <Badge variant="outline" className="border-white/10 text-white">{submitResultMatch.status}</Badge>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Team Alpha Input */}
                                <Card className={`bg-cyan-950/10 border-cyan-500/20 transition-all ${submitResultForm.winner_team === 'alpha' ? 'ring-2 ring-cyan-500 shadow-lg shadow-cyan-900/20' : ''}`}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-bold text-cyan-400 uppercase tracking-wider flex justify-between items-center">
                                            Team Alpha (CT)
                                            {submitResultForm.winner_team === 'alpha' && <Crown className="h-4 w-4 text-cyan-400" />}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Score</label>
                                            <Input
                                                type="number"
                                                className="bg-zinc-900/80 border-cyan-500/10 text-3xl font-black text-center h-16 text-cyan-400 focus-visible:ring-cyan-500/50"
                                                value={submitResultForm.alpha_score}
                                                onChange={(e) => setSubmitResultForm({ ...submitResultForm, alpha_score: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <Button
                                            variant={submitResultForm.winner_team === 'alpha' ? 'default' : 'outline'}
                                            className={`w-full ${submitResultForm.winner_team === 'alpha' ? 'bg-cyan-600 hover:bg-cyan-700 text-white' : 'border-cyan-500/20 text-cyan-500 hover:bg-cyan-950/30'}`}
                                            onClick={() => setSubmitResultForm({ ...submitResultForm, winner_team: 'alpha' })}
                                        >
                                            Mark as Winner
                                        </Button>
                                    </CardContent>
                                </Card>

                                {/* Team Bravo Input */}
                                <Card className={`bg-orange-950/10 border-orange-500/20 transition-all ${submitResultForm.winner_team === 'bravo' ? 'ring-2 ring-orange-500 shadow-lg shadow-orange-900/20' : ''}`}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-bold text-orange-400 uppercase tracking-wider flex justify-between items-center">
                                            Team Bravo (T)
                                            {submitResultForm.winner_team === 'bravo' && <Crown className="h-4 w-4 text-orange-400" />}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Score</label>
                                            <Input
                                                type="number"
                                                className="bg-zinc-900/80 border-orange-500/10 text-3xl font-black text-center h-16 text-orange-400 focus-visible:ring-orange-500/50"
                                                value={submitResultForm.bravo_score}
                                                onChange={(e) => setSubmitResultForm({ ...submitResultForm, bravo_score: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <Button
                                            variant={submitResultForm.winner_team === 'bravo' ? 'default' : 'outline'}
                                            className={`w-full ${submitResultForm.winner_team === 'bravo' ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'border-orange-500/20 text-orange-500 hover:bg-orange-950/30'}`}
                                            onClick={() => setSubmitResultForm({ ...submitResultForm, winner_team: 'bravo' })}
                                        >
                                            Mark as Winner
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Proof / Screenshot</label>
                                <div className="flex gap-2">
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleScreenshotUpload(file, false);
                                        }}
                                        className="bg-zinc-900 border-white/10 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                                        disabled={uploadingScreenshot}
                                    />
                                    {submitResultForm.screenshot_url && (
                                        <Button variant="outline" size="icon" onClick={() => window.open(submitResultForm.screenshot_url, '_blank')}>
                                            <ImageIcon className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                {uploadingScreenshot && <p className="text-xs text-yellow-500">Uploading...</p>}
                                {submitResultForm.screenshot_url && <p className="text-xs text-green-500">✓ Screenshot uploaded</p>}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="mt-4">
                        <Button variant="ghost" onClick={() => setSubmitResultMatch(null)} className="text-gray-400 hover:text-white">Cancel</Button>
                        <Button onClick={handleSubmitResult} disabled={processing} className="bg-primary hover:bg-primary/90 min-w-[150px]">
                            {processing ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                                </>
                            ) : (
                                <>
                                    <Check className="mr-2 h-4 w-4" /> Finalize Result
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );

    const MatchCard = ({ match, color, icon, onViewLobby, onForceStart, onCancel, onSubmitResult }: any) => {
        const colorClasses: any = {
            yellow: 'border-yellow-500/20 shadow-yellow-900/10 hover:border-yellow-500/50',
            blue: 'border-blue-500/20 shadow-blue-900/10 hover:border-blue-500/50',
            purple: 'border-purple-500/20 shadow-purple-900/10 hover:border-purple-500/50',
            gray: 'border-white/10 hover:border-white/20',
            green: 'border-green-500/20 shadow-green-900/10 hover:border-green-500/50'
        };
        const badgeClasses: any = {
            yellow: 'text-yellow-500 border-yellow-500/50',
            blue: 'text-blue-500 border-blue-500/50',
            purple: 'text-purple-500 border-purple-500/50',
            gray: 'text-gray-400 border-gray-500/50',
            green: 'text-green-500 border-green-500/50'
        };

        const isCompleted = match.status === 'completed';

        return (
            <Card className={`hover:shadow-lg transition-all bg-zinc-950 ${colorClasses[color] || colorClasses.gray}`}>
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <Badge variant={match.status === 'in_progress' ? 'default' : 'secondary'} className={match.status === 'in_progress' ? 'bg-green-600' : match.status === 'completed' ? 'bg-green-600/20 text-green-500' : ''}>
                            {match.status.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">#{match.id.slice(0, 6)}</span>
                    </div>
                    <CardTitle className="text-base mt-2 text-white">
                        {match.host_username || 'Unknown'}'s Lobby
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-gray-400 mb-4">
                        {isCompleted && match.winner_team && (
                            <div className="mb-3 p-3 rounded-lg bg-zinc-900/50 border border-white/5">
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`font-bold ${match.winner_team === 'alpha' ? 'text-cyan-400' : 'text-orange-400'}`}>
                                        {match.winner_team === 'alpha' ? '🏆 Alpha Won' : '🏆 Bravo Won'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-lg font-mono">
                                    <span className="text-cyan-400">{match.alpha_score || 0}</span>
                                    <span className="text-gray-600">-</span>
                                    <span className="text-orange-400">{match.bravo_score || 0}</span>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span>Players:</span>
                            <span>{match.player_count}/10</span>
                        </div>
                        <div className="flex justify-between mt-1">
                            <span>Type:</span>
                            <Badge variant="outline" className={badgeClasses[color] || badgeClasses.gray}>
                                {icon} <span className="ml-1 uppercase">{match.match_type}</span>
                            </Badge>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                            {isCompleted ? `Completed: ${new Date(match.updated_at).toLocaleString()}` : `Created: ${new Date(match.created_at).toLocaleTimeString()}`}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {!isCompleted && (
                            <>
                                <Button size="sm" className="bg-zinc-800 hover:bg-zinc-700 w-full" onClick={() => onViewLobby?.(match.id)}>
                                    View Lobby
                                </Button>
                                <Button size="sm" variant="outline" className="text-blue-500 border-blue-500/20 hover:bg-blue-500/10 w-full" onClick={() => onSubmitResult(match)}>
                                    Result
                                </Button>
                                {match.status === 'waiting' && (
                                    <Button size="sm" variant="outline" className="text-green-500 border-green-500/20 hover:bg-green-500/10 col-span-2" onClick={() => onForceStart(match.id)}>
                                        <Play className="h-4 w-4 mr-1" /> Force Start
                                    </Button>
                                )}
                                <Button size="sm" variant="outline" className="text-red-500 border-red-500/20 hover:bg-red-500/10 col-span-2" onClick={() => onCancel(match.id)}>
                                    <XCircle className="h-4 w-4 mr-1" /> Cancel Match
                                </Button>
                            </>
                        )}
                        {isCompleted && (
                            <>
                                <Button size="sm" className="bg-zinc-800 hover:bg-zinc-700 w-full" onClick={() => onViewLobby?.(match.id)}>
                                    View Details
                                </Button>
                                <Button size="sm" variant="outline" className="text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/10 w-full" onClick={() => onSubmitResult(match)}>
                                    Edit Result
                                </Button>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    };

    const EmptyPlaceholder = ({ text }: { text: string }) => (
        <div className="col-span-full text-center p-8 text-muted-foreground border border-dashed border-white/10 rounded-lg bg-zinc-900/20">
            {text}
        </div>
    );

    const renderHistory = () => (
        <div className="space-y-8 animate-fade-in">
            {/* Completed Matches Section */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-2xl font-bold font-display text-white">Match History</h3>
                        <p className="text-muted-foreground">Recently completed and cancelled matches</p>
                    </div>
                    <Button variant="outline" onClick={() => { fetchRecentMatches(); fetchCancelledMatches(); }}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                    </Button>
                </div>


                <div className="space-y-4">
                    <h4 className="text-lg font-bold text-green-500 uppercase tracking-widest flex items-center gap-2">
                        <Check className="h-5 w-5" /> Recently Completed
                    </h4>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {completedMatches.filter(m => m.status === 'completed').map(match => (
                            <MatchCard
                                key={match.id}
                                match={match}
                                color="green"
                                icon={<Check className="h-4 w-4" />}
                                onViewLobby={onViewLobby}
                                onForceStart={() => { }}
                                onCancel={() => { }}
                                onSubmitResult={() => {
                                    setEditResultMatch(match);
                                    setEditResultForm({
                                        winner_team: (match.winner_team as 'alpha' | 'bravo') || 'alpha',
                                        alpha_score: match.alpha_score || 0,
                                        bravo_score: match.bravo_score || 0
                                    });
                                }}
                            />
                        ))}
                        {completedMatches.filter(m => m.status === 'completed').length === 0 && (
                            <EmptyPlaceholder text="No recently completed matches found." />
                        )}
                    </div>
                </div>
            </div>

            <div className="w-full h-px bg-white/10 my-4" />

            {/* Cancelled Section */}
            <div className="space-y-4">
                <h4 className="text-lg font-bold text-red-500 uppercase tracking-widest flex items-center gap-2">
                    <XCircle className="h-5 w-5" /> Cancelled Matches
                </h4>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {cancelledMatches.map(match => (
                        // Using simple card for cancelled since actions differ
                        <Card key={match.id} className="bg-zinc-950 border-red-900/20 opacity-75 hover:opacity-100 transition-opacity">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <Badge variant="secondary" className="bg-red-500/10 text-red-500">CANCELLED</Badge>
                                    <span className="text-xs text-muted-foreground font-mono">#{match.id.slice(0, 6)}</span>
                                </div>
                                <CardTitle className="text-base mt-2 text-white flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                        <AvatarImage src={`https://cdn.discordapp.com/avatars/${match.host_id}/${match.host_avatar}.png`} />
                                        <AvatarFallback>H</AvatarFallback>
                                    </Avatar>
                                    {match.host_username}'s Lobby
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm text-gray-400">
                                    <p>Type: <span className="text-yellow-500 font-bold uppercase">{match.match_type}</span></p>
                                    <p>Date: {new Date(match.updated_at).toLocaleString()}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {cancelledMatches.length === 0 && (
                        <EmptyPlaceholder text="No cancelled matches found." />
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-background text-foreground container mx-auto max-w-7xl pt-4 lg:pt-0">
            {/* Mobile Menu Button */}
            <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-zinc-900 border border-white/10 text-white hover:bg-primary transition-colors"
            >
                <Menu className="h-6 w-6" />
            </button>

            {/* Mobile Overlay */}
            {mobileMenuOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/80 z-40 backdrop-blur-sm"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={cn(
                "fixed md:static inset-y-0 left-0 z-40 w-64 border-r border-white/10 bg-zinc-950/95 p-6 space-y-6 transition-transform duration-300 transform md:transform-none",
                mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div>
                    <h2 className="text-xl font-bold font-display tracking-tight text-white flex items-center gap-2">
                        <ShieldAlert className="h-6 w-6 text-primary" />
                        MODERATOR
                    </h2>
                    <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">Administration</p>
                </div>
                <nav className="space-y-1">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => {
                                setActiveView(item.id);
                                setMobileMenuOpen(false);
                            }}
                            className={cn(
                                "w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                                activeView === item.id
                                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon className="h-4 w-4" />
                                {item.label}
                            </div>
                            {item.badge !== undefined && item.badge > 0 && (
                                <Badge variant="secondary" className="ml-auto bg-orange-600 text-white border-none h-5 px-1.5 min-w-[20px]">{item.badge}</Badge>
                            )}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto custom-scrollbar h-full">
                <div className="p-4 md:p-8 pt-16 md:pt-8 min-h-full">
                    {activeView === 'dashboard' && renderDashboard()}
                    {activeView === 'reviews' && renderReviews()}
                    {activeView === 'clan-requests' && renderClanRequests()}
                    {activeView === 'vip-requests' && renderVipRequests()}
                    {activeView === 'players' && renderPlayers()}
                    {activeView === 'matches' && renderMatches()}
                    {activeView === 'history' && renderHistory()}
                    {activeView === 'clans' && renderClans()}
                    {activeView === 'matchmaking' && renderMatchmaking()}
                </div>
            </main>

            {/* Review Dialog */}
            <Dialog open={!!selectedMatch} onOpenChange={(open) => !open && setSelectedMatch(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-display">Review Match #{selectedMatch?.id.slice(0, 8)}</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Confirm the winner and apply ELO changes.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedMatch && (
                        <div className="space-y-6">
                            <div className="rounded-lg border border-white/10 bg-black p-4 flex flex-col items-center gap-4">
                                {selectedMatch.result_screenshot_url ? (
                                    <img src={selectedMatch.result_screenshot_url} alt="Proof" className="max-h-[400px] w-auto object-contain rounded-md" />
                                ) : (
                                    <div className="p-12 text-muted-foreground flex flex-col items-center">
                                        <X className="h-8 w-8 mb-2 opacity-50" />
                                        No Screenshot Provided
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <label htmlFor="review-upload" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 h-9 px-4 py-2">
                                        <ImageIcon className="mr-2 h-4 w-4" />
                                        {uploadingScreenshot ? 'Uploading...' : 'Upload/Replace Screenshot'}
                                    </label>
                                    <input
                                        id="review-upload"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleScreenshotUpload(file, true);
                                        }}
                                        disabled={uploadingScreenshot}
                                    />
                                    {selectedMatch.result_screenshot_url && (
                                        <Button variant="ghost" size="sm" onClick={() => window.open(selectedMatch.result_screenshot_url, '_blank')}>
                                            Open Original
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Card className="border-cyan-500/20 bg-cyan-950/10">
                                    <CardHeader className="py-3 bg-cyan-500/10 border-b border-cyan-500/20">
                                        <CardTitle className="text-sm font-bold text-cyan-400 uppercase tracking-wider truncate">{alphaTeamName}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="py-4">
                                        <div className="space-y-2">
                                            {alphaPlayers.map(p => (
                                                <div key={p.player_id} className="flex justify-between text-sm">
                                                    <span className="text-white font-medium">{p.discord_username}</span>
                                                    <span className="text-cyan-400/70 font-mono">{p.elo}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="border-orange-500/20 bg-orange-950/10">
                                    <CardHeader className="py-3 bg-orange-500/10 border-b border-orange-500/20">
                                        <CardTitle className="text-sm font-bold text-orange-400 uppercase tracking-wider truncate">{bravoTeamName}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="py-4">
                                        <div className="space-y-2">
                                            {bravoPlayers.map(p => (
                                                <div key={p.player_id} className="flex justify-between text-sm">
                                                    <span className="text-white font-medium">{p.discord_username}</span>
                                                    <span className="text-orange-400/70 font-mono">{p.elo}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="grid gap-6 py-4 bg-zinc-900/50 p-6 rounded-lg border border-white/5">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-300">Winner Team</label>
                                        <Select value={reviewWinner} onValueChange={(v: 'alpha' | 'bravo') => setReviewWinner(v)}>
                                            <SelectTrigger className="bg-zinc-800 border-white/10 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-zinc-800 border-white/10 text-white">
                                                <SelectItem value="alpha">{alphaTeamName} (Cyan)</SelectItem>
                                                <SelectItem value="bravo">{bravoTeamName} (Orange)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-300">ELO Stake</label>
                                        <Input type="number" className="bg-zinc-800 border-white/10 text-white" value={eloChange} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEloChange(Number(e.target.value))} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Admin Notes</label>
                                    <Textarea className="bg-zinc-800 border-white/10 text-white min-h-[100px]" value={reviewNotes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReviewNotes(e.target.value)} placeholder="Reasoning for decision..." />
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-cyan-400">Alpha Score</label>
                                        <Input type="number" className="bg-zinc-800 border-white/10 text-white" value={alphaScore} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAlphaScore(Number(e.target.value))} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-orange-400">Bravo Score</label>
                                        <Input type="number" className="bg-zinc-800 border-white/10 text-white" value={bravoScore} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBravoScore(Number(e.target.value))} />
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button variant="destructive" onClick={() => handleReviewMatch(false)} disabled={processing} className="w-full sm:w-auto">
                                    <X className="mr-2 h-4 w-4" /> Reject Match
                                </Button>
                                <Button onClick={() => handleReviewMatch(true)} disabled={processing} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
                                    <Check className="mr-2 h-4 w-4" /> Approve & Apply ELO
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Player History Dialog */}
            <Dialog open={!!selectedPlayer} onOpenChange={(open) => !open && setSelectedPlayer(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-zinc-950 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-xl">
                            <Avatar className="h-10 w-10 border border-white/10">
                                <AvatarImage src={`https://cdn.discordapp.com/avatars/${selectedPlayer?.id}/${selectedPlayer?.discord_avatar}.png`} />
                                <AvatarFallback>?</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="font-display">{selectedPlayer?.discord_username}</span>
                                <span className="text-xs font-normal text-muted-foreground font-sans">ID: {selectedPlayer?.id}</span>
                            </div>
                        </DialogTitle>
                        <DialogDescription className="flex items-center gap-4 pt-2 flex-wrap">
                            <Badge variant="outline" className="text-primary border-primary/20">Current ELO: {selectedPlayer?.elo}</Badge>
                            <span className="text-xs text-muted-foreground">{selectedPlayer?.wins}W - {selectedPlayer?.losses}L</span>
                            {selectedPlayer?.is_vip === 1 ? (
                                <Badge className="bg-yellow-500 text-black border-none font-bold">
                                    VIP ACTIVE (Until {selectedPlayer.vip_until ? new Date(selectedPlayer.vip_until).toLocaleDateString() : 'N/A'})
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-gray-500 border-white/10">Standard Player</Badge>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="bg-zinc-900/50 p-4 rounded-lg space-y-4 border border-white/5 mt-4">
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">Manual ELO Adjustment</h4>
                        <div className="flex gap-4">
                            <Input
                                type="number"
                                placeholder="+/-"
                                className="w-24 bg-zinc-800 border-white/10 text-white"
                                value={manualEloChange}
                                onChange={(e) => setManualEloChange(Number(e.target.value))}
                            />
                            <Input
                                placeholder="Reason for adjustment"
                                className="flex-1 bg-zinc-800 border-white/10 text-white"
                                value={manualReason}
                                onChange={(e) => setManualReason(e.target.value)}
                            />
                            <Button onClick={handleManualEloAdjust} disabled={processing || manualEloChange === 0} className="bg-primary text-white hover:bg-primary/90">
                                Apply
                            </Button>
                        </div>
                    </div>

                    {/* VIP Management - Admin Only */}
                    {user?.role === 'admin' && (
                        <div className="bg-gradient-to-r from-yellow-900/20 to-zinc-900/50 p-4 rounded-lg space-y-4 border border-yellow-500/10">
                            <h4 className="text-sm font-bold text-yellow-500 uppercase tracking-wider flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4" /> VIP Management
                            </h4>
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-gray-400">
                                    {selectedPlayer?.is_vip === 1
                                        ? "Granting VIP again will renew the membership for 1 month from now."
                                        : "Granting VIP will allow this player to access League matches for 1 month."}
                                </p>
                                <div className="flex gap-2">
                                    {selectedPlayer?.is_vip === 1 && (
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => handleVipToggle(selectedPlayer.id, false)}
                                            disabled={processing}
                                        >
                                            Revoke VIP
                                        </Button>
                                    )}
                                    <Button
                                        className="bg-yellow-600 hover:bg-yellow-700 text-black font-bold"
                                        size="sm"
                                        onClick={() => handleVipToggle(selectedPlayer!.id, true)}
                                        disabled={processing}
                                    >
                                        {selectedPlayer?.is_vip === 1 ? 'Renew VIP' : 'Grant VIP (1mo)'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-6">
                        <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">ELO History</h4>
                        <Table>
                            <TableHeader className="bg-zinc-900">
                                <TableRow className="border-white/10">
                                    <TableHead className="text-gray-400">Date</TableHead>
                                    <TableHead className="text-gray-400">Change</TableHead>
                                    <TableHead className="text-gray-400">Reason</TableHead>
                                    <TableHead className="text-right text-gray-400">New ELO</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {playerHistory.map((entry) => (
                                    <TableRow key={entry.id} className="border-white/5">
                                        <TableCell className="text-sm text-gray-300">{new Date(entry.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell className={cn("font-bold text-sm", entry.elo_change > 0 ? "text-green-500" : "text-red-500")}>
                                            {entry.elo_change > 0 ? '+' : ''}{entry.elo_change}
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-400 max-w-[200px] truncate" title={entry.reason}>{entry.reason}</TableCell>
                                        <TableCell className="text-right font-mono text-white">{entry.elo_after}</TableCell>
                                    </TableRow>
                                ))}
                                {playerHistory.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No history available</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Error Alert Dialog */}
            <AlertDialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Error</AlertDialogTitle>
                        <AlertDialogDescription>
                            {errorMessage}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setErrorDialogOpen(false)}>OK</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Confirmation Alert Dialog */}
            <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{confirmConfig?.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmConfig?.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setConfirmDialogOpen(false)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => {
                            if (confirmConfig?.action) {
                                confirmConfig.action();
                            }
                            setConfirmDialogOpen(false);
                        }}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Clan Details Dialog */}
            <Dialog open={!!selectedClan} onOpenChange={(open) => !open && setSelectedClan(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-display flex items-center gap-2">
                            <Shield className="h-6 w-6 text-purple-500" />
                            Clan Details
                        </DialogTitle>
                    </DialogHeader>

                    {selectedClan && (
                        <div className="space-y-6">
                            {/* Editor Form */}
                            <Card className="bg-zinc-900 border-white/10">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-gray-400">Settings</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Clan Name</label>
                                        <Input
                                            value={selectedClan.name}
                                            onChange={e => setSelectedClan({ ...selectedClan, name: e.target.value })}
                                            className="bg-black/50 border-white/10 text-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Tag</label>
                                        <Input
                                            value={selectedClan.tag}
                                            onChange={e => setSelectedClan({ ...selectedClan, tag: e.target.value })}
                                            className="bg-black/50 border-white/10 text-white font-mono"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Leader</label>
                                        <Select value={selectedClan.leader_id} onValueChange={v => setSelectedClan({ ...selectedClan, leader_id: v })}>
                                            <SelectTrigger className="bg-black/50 border-white/10 text-white">
                                                <SelectValue>{selectedClan.leader_username || 'Unknown'}</SelectValue>
                                            </SelectTrigger>
                                            <SelectContent className="bg-zinc-800 border-white/10 text-white h-60">
                                                {selectedClan.members?.map((m: any) => (
                                                    <SelectItem key={m.user_id} value={m.user_id}>
                                                        {m.discord_username || m.user_id}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-gray-500">Changing leader does not automatically update roles.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Elo Rating</label>
                                        <Input
                                            type="number"
                                            value={selectedClan.elo}
                                            onChange={e => setSelectedClan({ ...selectedClan, elo: parseInt(e.target.value) })}
                                            className="bg-black/50 border-white/10 text-white font-mono text-yellow-500"
                                        />
                                    </div>
                                </CardContent>
                                <CardFooter className="border-t border-white/5 pt-4">
                                    <Button onClick={handleSaveClan} disabled={processing} className="w-full bg-purple-600 hover:bg-purple-700">
                                        {processing ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </CardFooter>
                            </Card>

                            {/* Members Table */}
                            <div className="space-y-2">
                                <h3 className="text-lg font-bold">Members ({selectedClan.members?.length || 0})</h3>
                                <div className="rounded-md border border-white/10 overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-zinc-900/50">
                                            <TableRow className="border-white/5 hover:bg-transparent">
                                                <TableHead className="text-gray-400">User</TableHead>
                                                <TableHead className="text-gray-400">Nickname</TableHead>
                                                <TableHead className="text-gray-400">Role</TableHead>
                                                <TableHead className="text-gray-400 text-right">ELO</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="bg-zinc-900/20">
                                            {selectedClan.members?.map((m: any) => (
                                                <TableRow key={m.id} className="border-white/5 hover:bg-white/5">
                                                    <TableCell className="font-medium text-white flex items-center gap-2">
                                                        {m.discord_username}
                                                    </TableCell>
                                                    <TableCell className="text-gray-400">{m.standoff_nickname || '-'}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={m.role === 'leader' ? 'default' : 'secondary'} className={m.role === 'leader' ? 'bg-yellow-500/20 text-yellow-500 border-none' : 'bg-gray-800 text-gray-400'}>
                                                            {m.role}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-cyan-500">{m.elo}</TableCell>
                                                </TableRow>
                                            ))}
                                            {(!selectedClan.members || selectedClan.members.length === 0) && (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                                        No members found.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Edit Result Dialog */}
            <Dialog open={!!editResultMatch} onOpenChange={(open) => !open && setEditResultMatch(null)}>
                <DialogContent className="max-w-2xl bg-zinc-950 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-display">Edit Match Result</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Correct the winner and scores for Match #{editResultMatch?.id.slice(0, 8)}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-white block mb-2">Winner Team</label>
                            <Select
                                value={editResultForm.winner_team}
                                onValueChange={(val) => setEditResultForm({ ...editResultForm, winner_team: val as 'alpha' | 'bravo' })}
                            >
                                <SelectTrigger className="bg-zinc-900 border-white/10 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-white/10">
                                    <SelectItem value="alpha">Team Alpha</SelectItem>
                                    <SelectItem value="bravo">Team Bravo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-white block mb-2">Alpha Score</label>
                                <Input
                                    type="number"
                                    value={editResultForm.alpha_score}
                                    onChange={(e) => setEditResultForm({ ...editResultForm, alpha_score: parseInt(e.target.value) || 0 })}
                                    className="bg-zinc-900 border-white/10 text-white"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-white block mb-2">Bravo Score</label>
                                <Input
                                    type="number"
                                    value={editResultForm.bravo_score}
                                    onChange={(e) => setEditResultForm({ ...editResultForm, bravo_score: parseInt(e.target.value) || 0 })}
                                    className="bg-zinc-900 border-white/10 text-white"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditResultMatch(null)} disabled={processing}>
                            Cancel
                        </Button>
                        <Button onClick={handleEditResultSubmit} disabled={processing} className="bg-primary hover:bg-primary/90">
                            {processing ? 'Updating...' : 'Update Result'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
