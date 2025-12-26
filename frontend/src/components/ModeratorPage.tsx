import { useState, useEffect } from 'react';
import { useWebSocket } from './WebSocketContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
    Users, Activity, FileText, Ban, Check, X, Search,
    Gamepad2, RefreshCw, LayoutDashboard, TrendingUp, Menu, ShieldAlert,
    Play, XCircle
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

interface ModeratorPageProps {
    user: { id: string } | null;
    backendUrl: string;
}

export default function ModeratorPage({ user, backendUrl }: ModeratorPageProps) {
    const { } = useWebSocket();
    const [activeView, setActiveView] = useState('dashboard');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
    const [activeMatchesList, setActiveMatchesList] = useState<PendingMatch[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState<ModeratorStats | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [, setTotalUsers] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal States
    const [selectedMatch, setSelectedMatch] = useState<PendingMatch | null>(null);
    const [matchPlayers, setMatchPlayers] = useState<MatchPlayer[]>([]);
    const [reviewWinner, setReviewWinner] = useState<'alpha' | 'bravo'>('alpha');
    const [alphaScore, setAlphaScore] = useState(0);
    const [bravoScore, setBravoScore] = useState(0);
    const [eloChange, setEloChange] = useState(25);
    const [reviewNotes, setReviewNotes] = useState('');
    const [processing, setProcessing] = useState(false);

    const [selectedPlayer, setSelectedPlayer] = useState<User | null>(null);
    const [playerHistory, setPlayerHistory] = useState<EloHistoryEntry[]>([]);
    const [manualEloChange, setManualEloChange] = useState(0);
    const [manualReason, setManualReason] = useState('');

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

    useEffect(() => {
        fetchStats();
        fetchPendingReviews();
        fetchActiveMatches();
    }, [backendUrl, user]);

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
                alert(data.error || 'Failed to review match');
            }
        } catch (err) {
            alert('Network error');
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
                alert(data.error || 'Failed to adjust ELO');
            }
        } catch (err) {
            alert('Network error');
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
            }
        } catch (err) {
            alert('Network error');
        }
    };

    const handleCancelMatch = async (matchId: string) => {
        if (!confirm('Are you sure you want to cancel this match?')) return;
        try {
            const response = await fetch(`${backendUrl}/api/moderator/matches/${matchId}/cancel`, {
                method: 'POST',
                headers: { 'X-User-Id': user?.id || '' }
            });

            if (response.ok) {
                fetchActiveMatches();
            } else {
                alert('Failed to cancel match');
            }
        } catch (error) {
            console.error('Error cancelling match:', error);
        }
    };

    const handleForceStartMatch = async (matchId: string) => {
        if (!confirm('Are you sure you want to force start this match?')) return;
        try {
            const response = await fetch(`${backendUrl}/api/moderator/matches/${matchId}/force-start`, {
                method: 'POST',
                headers: { 'X-User-Id': user?.id || '' }
            });

            if (response.ok) {
                fetchActiveMatches();
            } else {
                alert('Failed to force start match');
            }
        } catch (error) {
            console.error('Error starting match:', error);
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

    // Sidebar navigation items
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'reviews', label: 'Reviews', icon: FileText, badge: stats?.pendingReviews },
        { id: 'players', label: 'Players', icon: Users },
        { id: 'matches', label: 'Active Matches', icon: Gamepad2 },
    ];

    // Render different views
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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {pendingMatches.map(match => (
                    <Card key={match.id} className="cursor-pointer hover:shadow-lg transition-all bg-zinc-950 border-white/10 hover:border-primary/50 group" onClick={() => fetchMatchDetails(match.id)}>
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
                            <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold">Start Review</Button>
                        </CardContent>
                    </Card>
                ))}
                {pendingMatches.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 text-muted-foreground border border-dashed border-white/10 rounded-lg">
                        <Check className="h-12 w-12 mb-4 text-green-500" />
                        <h3 className="text-lg font-medium text-white">All Caught Up</h3>
                        <p>No matches pending review.</p>
                    </div>
                )}
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
                                            <span>{u.discord_username}</span>
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
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {activeMatchesList.map(match => (
                    <Card key={match.id} className="hover:shadow-lg transition-all bg-zinc-950 border-white/10">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <Badge variant={match.status === 'in_progress' ? 'default' : 'secondary'} className={match.status === 'in_progress' ? 'bg-green-500' : ''}>
                                    {match.status.replace('_', ' ')}
                                </Badge>
                                <span className="text-xs text-muted-foreground font-mono">#{match.id.slice(0, 6)}</span>
                            </div>
                            <CardTitle className="text-base mt-2 text-white">
                                {match.host_username}'s Lobby
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-gray-400 mb-4">
                                <div className="flex justify-between">
                                    <span>Players:</span>
                                    <span>{match.player_count}/10</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" className="flex-1 bg-zinc-800 hover:bg-zinc-700 transition-colors" asChild>
                                    <a href={`/lobby/${match.id}`} target="_blank" rel="noreferrer">View Lobby</a>
                                </Button>
                                {match.status === 'waiting' && (
                                    <Button size="sm" variant="outline" className="text-green-500 border-green-500/20 hover:bg-green-500/10" onClick={() => handleForceStartMatch(match.id)}>
                                        <Play className="h-4 w-4" />
                                    </Button>
                                )}
                                <Button size="sm" variant="outline" className="text-red-500 border-red-500/20 hover:bg-red-500/10" onClick={() => handleCancelMatch(match.id)}>
                                    <XCircle className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {activeMatchesList.length === 0 && (
                    <div className="col-span-full text-center p-12 text-muted-foreground border border-dashed border-white/10 rounded-lg">
                        No active matches found.
                    </div>
                )}
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
                    {activeView === 'players' && renderPlayers()}
                    {activeView === 'matches' && renderMatches()}
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
                            <div className="rounded-lg border border-white/10 bg-black p-4 flex justify-center">
                                {selectedMatch.result_screenshot_url ? (
                                    <img src={selectedMatch.result_screenshot_url} alt="Proof" className="max-h-[400px] w-auto object-contain rounded-md" />
                                ) : (
                                    <div className="p-12 text-muted-foreground flex flex-col items-center">
                                        <X className="h-8 w-8 mb-2 opacity-50" />
                                        No Screenshot Provided
                                    </div>
                                )}
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
                        <DialogDescription className="flex items-center gap-4 pt-2">
                            <Badge variant="outline" className="text-primary border-primary/20">Current ELO: {selectedPlayer?.elo}</Badge>
                            <span className="text-xs text-muted-foreground">{selectedPlayer?.wins}W - {selectedPlayer?.losses}L</span>
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
        </div>
    );
}
