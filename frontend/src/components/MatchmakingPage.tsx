import React, { useState, useEffect } from 'react';
import { useWebSocket } from './WebSocketContext';
import LobbyDetailPage from './LobbyDetailPage';
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Gamepad2, Plus, Users, Map as MapIcon, Loader2, Trophy, AlertTriangle, ExternalLink, Check, ShieldAlert, Swords, Lock } from "lucide-react";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";
import LevelBadge from './LevelBadge';

interface Match {
    id: string;
    lobby_url: string;
    host_id: string;
    host_username?: string;
    host_avatar?: string;
    status: string;
    player_count: number;
    max_players: number;
    map_name?: string;
    current_players?: number;
    created_at: string;
    match_type?: 'casual' | 'league' | 'clan_war' | 'competitive' | 'clan_lobby';
    min_rank?: 'Bronze' | 'Silver' | 'Gold';
    host_elo?: number;
    clan_id?: string;
}

interface MatchmakingPageProps {
    user: {
        id: string;
        username: string;
        avatar?: string;
        is_vip?: number | boolean;
        vip_until?: string;
        role?: string;
        elo?: number;
    } | null;
    backendUrl: string;
    onViewProfile?: (userId: string) => void;
    onNavigateToVip?: () => void;
    targetMatchId?: string | null;
}

const MatchmakingPage: React.FC<MatchmakingPageProps> = ({ user, backendUrl, onViewProfile, onNavigateToVip, targetMatchId }) => {
    const { sendMessage: _sendMessage, lastMessage } = useWebSocket();
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [lobbyUrl, setLobbyUrl] = useState('');
    const [selectedMap, setSelectedMap] = useState<string | null>(null);
    const [matchType, setMatchType] = useState<'casual' | 'league' | 'clan_war' | 'competitive'>('casual');

    const MAPS = [
        { name: 'Hanami', image: '/maps/hanami.png' },
        { name: 'Sandstone', image: '/maps/rust.jpg' },
        { name: 'Rust', image: '/maps/sandstone.png' },
        { name: 'Breeze', image: '/maps/dune.jpg' },
        { name: 'Dune', image: '/maps/breeze.png' },
        { name: 'Province', image: '/maps/dust.jpg' },
        { name: 'Zone 7', image: '/maps/zone7.jpg' }
    ];
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [, setUserMatch] = useState<Match | null>(null);
    const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
    const [activeMatchIdError, setActiveMatchIdError] = useState<string | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [errorDialogOpen, setErrorDialogOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [dailySlotsUsed, setDailySlotsUsed] = useState(0);
    const [filterType, setFilterType] = useState<'all' | 'casual' | 'league' | 'competitive' | 'clan'>('all');

    // Sync targetMatchId from parent (e.g. Moderator Page deep link)
    useEffect(() => {
        if (targetMatchId) {
            setSelectedMatchId(targetMatchId);
        }
    }, [targetMatchId]);

    // Expose nothing for Turnstile
    useEffect(() => {
        if (showCreateModal) {
            setError(null);
        }
    }, [showCreateModal]);
    const [myActiveMatch, setMyActiveMatch] = useState<Match | null>(null);

    // Fetch matches
    const fetchMatches = async () => {
        try {
            const response = await fetch(`${backendUrl}/api/matches?status=waiting`);
            const data = await response.json();
            if (data.success) {
                setMatches(data.matches);
            }
        } catch (err) {
            console.error('Error fetching matches:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMatches();
        // Removed 5s polling interval - now purely push-based via WebSockets
    }, [backendUrl]);


    // Fetch user's active match
    const fetchMyActiveMatch = async () => {
        if (!user) return;
        try {
            const response = await fetch(`${backendUrl}/api/matches/user/${user.id}/active`);
            const data = await response.json();
            if (data.success && data.match) {
                setMyActiveMatch(data.match);
            } else {
                setMyActiveMatch(null);
            }
        } catch (err) {
            console.error('Error fetching active match:', err);
        }
    };

    useEffect(() => {
        if (user) {
            fetchMyActiveMatch();
            fetchDailyStats();
        }
    }, [user, backendUrl]);

    const fetchDailyStats = async () => {
        if (!user) return;
        try {
            const response = await fetch(`${backendUrl}/api/profile/${user.id}`);
            const data = await response.json();
            if (data.daily_comp_matches_used !== undefined) {
                setDailySlotsUsed(data.daily_comp_matches_used);
            }
        } catch (err) {
            console.error('Error fetching daily stats:', err);
        }
    };

    // Handle WebSocket messages for real-time updates
    useEffect(() => {
        if (lastMessage) {
            try {
                const msg = lastMessage; // Already parsed
                if (msg.type === 'LOBBY_UPDATED' || msg.type === 'QUEUE_UPDATE' || msg.type === 'NEATQUEUE_LOBBY_CREATED' || msg.type === 'NEATQUEUE_LOBBY_DELETED') {
                    fetchMatches();
                }
            } catch (err) {
                console.error("Error processing websocket message:", err);
            }
        }
    }, [lastMessage]);


    // Create lobby
    const handleCreateLobby = async () => {
        if (!user || !lobbyUrl.trim()) return;

        /*
        if (!turnstileToken) {
            setError("Please wait for the security check to complete.");
            return;
        }
        */

        console.log("Creating lobby...");
        setCreating(true);
        setError(null);

        try {
            const response = await fetch(`${backendUrl}/api/matches`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    lobby_url: lobbyUrl.trim(),
                    host_id: user.id,
                    map_name: selectedMap || undefined,
                    match_type: matchType
                })
            });

            const data = await response.json();

            if (data.success) {
                setShowCreateModal(false);
                setLobbyUrl('');
                setSelectedMap(null);
                setMatchType('casual');
                fetchMatches();
                if (data.matchId) {
                    setSelectedMatchId(data.matchId);
                }
                console.log("Lobby Created Successfully!");
            } else {
                setError(data.error || 'Failed to create lobby');
                if (data.currentMatchId) {
                    setActiveMatchIdError(data.currentMatchId);
                }
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setCreating(false);
        }
    };

    // Join lobby
    const handleJoinLobby = async (matchId: string) => {
        if (!user) return;
        setProcessingId(matchId);

        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_id: user.id
                })
            });

            const data = await response.json();

            if (data.success) {
                fetchMatches();
                setSelectedMatchId(matchId);
                console.log("Joined lobby!");
            } else {
                setErrorMessage(data.error || 'Failed to join lobby');
                setErrorDialogOpen(true);
            }
        } catch (err) {
            setErrorMessage('Network error');
            setErrorDialogOpen(true);
        } finally {
            setProcessingId(null);
        }
    };

    // Leave lobby
    const handleLeaveLobby = async (matchId: string) => {
        if (!user) return;
        setProcessingId(matchId);

        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}/leave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_id: user.id
                })
            });

            const data = await response.json();

            if (data.success) {
                setUserMatch(null);
                fetchMatches();
                setMyActiveMatch(null);
                console.log("Left lobby");
            } else {
                alert(data.error || 'Failed to leave lobby');
            }
        } catch (err) {
            alert('Network error');
        } finally {
            setProcessingId(null);
        }
    };

    // Start match
    const handleStartMatch = async (matchId: string) => {
        if (!user) return;

        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host_id: user.id,
                    status: 'in_progress'
                })
            });

            const data = await response.json();

            if (data.success) {
                fetchMatches();
                console.log("Match started!");
            } else {
                alert(data.error || 'Failed to start match');
            }
        } catch (err) {
            alert('Network error');
        }
    };

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-fade-in">
                <Gamepad2 className="h-16 w-16 text-muted-foreground/50" />
                <h1 className="text-2xl font-bold font-display tracking-tight text-foreground">Matchmaking Access</h1>
                <p className="text-muted-foreground text-center max-w-sm">Please sign in with Discord to access matchmaking, join lobbies, and compete.</p>
                <Button onClick={() => window.location.href = `${import.meta.env.VITE_BACKEND_URL}/auth/discord`}>
                    Login with Discord
                </Button>
            </div>
        );
    }

    // Show lobby detail page if a match is selected
    if (selectedMatchId) {
        // Get the previous profile userId from localStorage if it exists
        const previousProfileUserId = localStorage.getItem("previousProfileUserId");

        return (
            <LobbyDetailPage
                matchId={selectedMatchId}
                user={user}
                backendUrl={backendUrl}
                onBack={() => {
                    setSelectedMatchId(null);
                    fetchMatches();
                }}
                previousProfileUserId={previousProfileUserId}
                onNavigateToProfile={onViewProfile}
            />
        );
    }

    const filteredMatches = matches.filter(m => {
        if (filterType === 'all') return true;
        if (filterType === 'clan') return m.match_type === 'clan_war' || m.match_type === 'clan_lobby';
        return m.match_type === filterType;
    });

    return (
        <div className="space-y-6 container mx-auto max-w-7xl animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-display tracking-tighter text-white flex items-center gap-2">
                        <Gamepad2 className="h-8 w-8 text-primary" /> Active Lobbies
                    </h1>
                    <p className="text-muted-foreground">Find a match or create your own custom lobby.</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* Daily Slots Counter */}
                    <div className="bg-zinc-900/50 border border-white/10 rounded-lg px-4 py-2 flex items-center gap-3">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest leading-tight">Comp. Slots</span>
                            <span className={`text-sm font-mono font-bold ${dailySlotsUsed >= 3 && !user.is_vip ? 'text-red-500' : 'text-green-500'}`}>
                                {user.is_vip ? '∞' : `${Math.max(0, 3 - dailySlotsUsed)}/3`}
                            </span>
                        </div>
                        {dailySlotsUsed >= 3 && !user.is_vip && (
                            <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 px-2 text-[10px] font-bold"
                                onClick={() => window.location.href = '/rewards'}
                            >
                                WATCH AD +1
                            </Button>
                        )}
                    </div>
                    <Button
                        onClick={() => setShowCreateModal(true)}
                        className="shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all font-bold"
                    >
                        <Plus className="mr-2 h-4 w-4" /> Create Lobby
                    </Button>
                </div>
            </div>

            {/* Filtering Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-white/5 pb-4">
                {[
                    { id: 'all', label: 'All Lobbies', icon: Users },
                    { id: 'casual', label: 'Casual', icon: Gamepad2 },
                    { id: 'league', label: 'League', icon: Trophy },
                    { id: 'competitive', label: 'Competitive', icon: Swords },
                    { id: 'clan', label: 'Clan Wars', icon: ShieldAlert },
                ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setFilterType(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === tab.id
                                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                : 'bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                                }`}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* My Active Match Banner */}
            {myActiveMatch && (
                <Card className="border-primary/50 bg-gradient-to-r from-primary/10 to-background overflow-hidden relative group">
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                                <AlertTriangle className="h-6 w-6 text-primary animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    Active Match in Progress
                                    <Badge variant="outline" className="border-primary text-primary animate-pulse ml-2 uppercase text-[10px] tracking-widest">
                                        {myActiveMatch.status.replace('_', ' ')}
                                    </Badge>
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {myActiveMatch.map_name ? `Playing on ${myActiveMatch.map_name}` : 'Map not selected'} • {myActiveMatch.player_count}/10 Players
                                </p>
                            </div>
                        </div>
                        <Button
                            onClick={() => setSelectedMatchId(myActiveMatch.id)}
                            variant="default"
                            className="w-full md:w-auto font-bold shadow-md"
                        >
                            {myActiveMatch.status === 'in_progress' ? 'Submit Result' : 'Return to Lobby'}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="bg-card/40 border-border/40 min-h-[200px] flex items-center justify-center">
                            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                        </Card>
                    ))}
                </div>
            ) : filteredMatches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 md:py-20 border-2 border-dashed border-border/50 rounded-xl bg-card/20 text-center">
                    <div className="bg-muted/30 p-6 rounded-full mb-4">
                        <Gamepad2 className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-xl font-bold text-white uppercase tracking-tight">No Lobbies Found</h3>
                    <p className="text-muted-foreground max-w-xs mx-auto mt-2">
                        {filterType === 'all'
                            ? "There are currently no active lobbies. Why not create one?"
                            : `There are currently no active ${filterType} lobbies.`}
                    </p>
                    <Button onClick={() => setShowCreateModal(true)} variant="outline" className="mt-6">
                        Host a Match
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredMatches.map((match) => (
                        <Card
                            key={match.id}
                            onClick={() => setSelectedMatchId(match.id)}
                            className={`
                                backdrop-blur-sm transition-all cursor-pointer group overflow-hidden relative hover:shadow-xl
                                ${match.match_type === 'league' ? 'bg-card/50 border-yellow-500/20 hover:border-yellow-500/50 hover:shadow-yellow-500/10' :
                                    match.match_type === 'competitive' ? 'bg-zinc-950/80 border-blue-500/20 hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]' :
                                        match.match_type === 'clan_war' ? 'bg-zinc-950/80 border-purple-500/20 hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]' :
                                            'bg-card/50 border-border/50 hover:border-primary/50 hover:shadow-primary/5'}
                            `}
                        >
                            {/* Special Effects based on type */}
                            {match.match_type === 'competitive' && (
                                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-3xl rounded-full -mr-12 -mt-12 pointer-events-none" />
                            )}
                            {match.match_type === 'clan_war' && (
                                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 blur-3xl rounded-full -mr-12 -mt-12 pointer-events-none" />
                            )}

                            {/* Map Background Image Overlay */}
                            {match.map_name && (
                                <div className="absolute inset-0 z-0 opacity-20 group-hover:opacity-40 transition-opacity">
                                    <img
                                        src={MAPS.find(m => m.name === match.map_name)?.image || `/maps/${match.map_name.toLowerCase()}.jpg`}
                                        className={`w-full h-full object-cover grayscale ${match.match_type === 'competitive' || match.match_type === 'clan_war' ? 'mix-blend-overlay' : ''}`}
                                        onError={(e) => e.currentTarget.style.display = 'none'}
                                    />
                                </div>
                            )}

                            <CardHeader className="flex flex-row items-center justify-between pb-3 z-10 relative">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Avatar className={`h-10 w-10 border-2 ${match.match_type === 'league' ? 'border-yellow-500/30' :
                                            match.match_type === 'competitive' ? 'border-blue-500/50' :
                                                match.match_type === 'clan_war' ? 'border-purple-500/50' :
                                                    'border-border'
                                            }`}>
                                            <AvatarImage src={`https://cdn.discordapp.com/avatars/${match.host_id}/${match.host_avatar}.png`} />
                                            <AvatarFallback className={
                                                match.match_type === 'league' ? 'bg-yellow-950 text-yellow-500' :
                                                    match.match_type === 'competitive' ? 'bg-blue-950 text-blue-200' :
                                                        match.match_type === 'clan_war' ? 'bg-purple-950 text-purple-200' :
                                                            ''
                                            }>
                                                {match.host_username?.[0]?.toUpperCase() || 'H'}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-bold leading-none transition-colors ${match.match_type === 'league' ? 'text-foreground group-hover:text-yellow-400' :
                                                match.match_type === 'competitive' ? 'text-white group-hover:text-blue-400' :
                                                    match.match_type === 'clan_war' ? 'text-white group-hover:text-purple-400' :
                                                        'text-foreground group-hover:text-primary'
                                                }`}>
                                                {match.host_username || 'Unknown Host'}
                                            </span>
                                            {match.match_type === 'clan_war' ? (
                                                <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 text-[10px] h-4 px-1.5 border-none">CLAN</Badge>
                                            ) : (
                                                <LevelBadge elo={match.host_elo || 1000} className="scale-75 origin-left" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-muted-foreground">{match.match_type === 'clan_war' ? 'Host (Captain)' : 'Host'}</span>
                                            {match.min_rank && match.match_type === 'league' && (
                                                <div className="flex items-center gap-1 bg-zinc-800/80 px-1.5 py-0.5 rounded-full border border-white/5">
                                                    <img
                                                        src={`/ranks/stats/${match.min_rank.toLowerCase()}_stat.png`}
                                                        alt={match.min_rank}
                                                        className="w-3 h-3 object-contain"
                                                    />
                                                    <span className={`text-[9px] font-bold uppercase ${match.min_rank === 'Gold' ? 'text-yellow-400' :
                                                        match.min_rank === 'Silver' ? 'text-gray-300' :
                                                            'text-[#cd7f32]'
                                                        }`}>
                                                        {match.min_rank}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Badge
                                    variant={match.status === 'in_progress' ? 'secondary' : 'default'}
                                    className={`${match.status === 'waiting' ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' : ''} uppercase text-[10px] tracking-wider font-bold`}
                                >
                                    {match.status.replace('_', ' ')}
                                </Badge>
                            </CardHeader>

                            <CardContent className="space-y-4 pb-4 z-10 relative">
                                <div className="flex items-center justify-between text-sm border-t border-white/5 pt-4">
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <Users className="h-4 w-4" />
                                        <span>Players</span>
                                    </div>
                                    <div className="font-mono font-medium text-white bg-black/20 px-2 py-0.5 rounded border border-white/5 flex items-center gap-1.5">
                                        <span className={match.current_players === match.max_players ? (
                                            match.match_type === 'league' ? "" :
                                                match.match_type === 'competitive' ? "text-blue-400" :
                                                    match.match_type === 'clan_war' ? "text-purple-400" :
                                                        ""
                                        ) : ""}>
                                            {match.current_players || match.player_count}
                                        </span>
                                        <span className="text-zinc-600">/</span>
                                        <span className="text-zinc-500">{match.max_players}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <MapIcon className="h-4 w-4" />
                                        <span>Map</span>
                                    </div>
                                    <span className="font-medium text-white">{match.map_name || 'Random'}</span>
                                </div>
                            </CardContent>

                            <CardFooter className="pt-2 z-10 relative">
                                {match.host_id === user.id ? (
                                    <div className="w-full flex gap-2">
                                        <Button
                                            className={`w-full flex-1 text-white border-none font-bold ${match.match_type === 'league' ? 'bg-yellow-600 hover:bg-yellow-700' :
                                                match.match_type === 'competitive' ? 'bg-blue-600 hover:bg-blue-700' :
                                                    match.match_type === 'clan_war' ? 'bg-purple-600 hover:bg-purple-700' :
                                                        'bg-primary hover:bg-primary/90'
                                                }`}
                                            onClick={(e) => { e.stopPropagation(); handleStartMatch(match.id); }}
                                            disabled={(match.current_players || match.player_count) < 10 || processingId === match.id}
                                        >
                                            {match.match_type === 'clan_war' ? 'Start Clan War' : 'Start Match'}
                                        </Button>
                                        <Button
                                            className="w-full flex-1 transition-all active:scale-95 bg-zinc-800 hover:bg-red-900/50"
                                            variant="ghost"
                                            onClick={(e) => { e.stopPropagation(); handleLeaveLobby(match.id); }}
                                            disabled={processingId === match.id}
                                        >
                                            {processingId === match.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel'}
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        className={`w-full transition-all font-bold active:scale-95 group ${match.match_type === 'league' ? 'bg-white/5 hover:bg-yellow-500 hover:text-black border border-yellow-500/20' :
                                            match.match_type === 'competitive' ? 'bg-blue-500/10 hover:bg-blue-500 hover:text-white border border-blue-500/30' :
                                                match.match_type === 'clan_war' ? 'bg-purple-500/10 hover:bg-purple-500 hover:text-white border border-purple-500/30' :
                                                    'bg-white/5 hover:bg-primary hover:text-white border border-border/50'
                                            }`}
                                        onClick={(e) => { e.stopPropagation(); handleJoinLobby(match.id); }}
                                        disabled={(match.current_players || match.player_count) >= match.max_players || processingId === match.id}
                                    >
                                        {processingId === match.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            (match.current_players || match.player_count) >= match.max_players ? 'Lobby Full' : (
                                                <span className="flex items-center gap-2">
                                                    {match.match_type === 'clan_war' ? 'Join Clan War' :
                                                        match.match_type === 'league' ? 'Join League Match' : 'Join Match'}
                                                    {(match.match_type === 'competitive' || match.match_type === 'clan_war') && (
                                                        <Swords className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                                                    )}
                                                </span>
                                            )
                                        )}
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create Lobby Dialog */}
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogContent className="w-[96vw] max-w-md bg-zinc-900 border-white/10 text-white z-[100] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-xl sm:text-2xl font-display uppercase tracking-tight text-white">Create New Lobby</DialogTitle>
                        <DialogDescription className="text-xs sm:text-sm text-gray-400">
                            Configure your match settings. Paste your custom lobby URL to start.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 sm:space-y-6 py-3 sm:py-4">
                        <div className="space-y-2">
                            <label className="text-xs sm:text-sm font-medium leading-none text-white block">
                                Lobby URL <span className="text-destructive">*</span>
                            </label>
                            <div className="relative">
                                <ExternalLink className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    value={lobbyUrl}
                                    onChange={(e) => setLobbyUrl(e.target.value)}
                                    placeholder="standoff2://lobby/..."
                                    className="pl-9 font-mono text-xs sm:text-sm bg-zinc-800/50 border-white/10 text-white focus:border-primary/50 h-11"
                                />
                            </div>
                            <p className="text-[10px] text-gray-500">Paste the custom lobby link generated in Standoff 2.</p>
                        </div>

                        {/* Match Type Selector */}
                        <div className="space-y-2">
                            <label className="text-xs sm:text-sm font-medium leading-none text-white block">
                                Match Type <span className="text-destructive">*</span>
                            </label>
                            <div className="w-full px-2 sm:px-10">
                                <Carousel
                                    className="w-full max-w-full"
                                    opts={{
                                        align: "start",
                                        loop: false,
                                    }}
                                >
                                    <CarouselContent className="-ml-2">
                                        {[
                                            {
                                                id: 'casual',
                                                label: 'Casual',
                                                icon: Gamepad2,
                                                color: 'text-primary',
                                                borderColor: 'border-primary',
                                                bgGradient: 'from-primary/20 via-primary/5 to-transparent',
                                                description: 'Quick match'
                                            },
                                            {
                                                id: 'competitive',
                                                label: 'Competitive',
                                                icon: Swords,
                                                color: 'text-blue-500',
                                                borderColor: 'border-blue-500',
                                                bgGradient: 'from-blue-500/20 via-blue-500/5 to-transparent',
                                                description: 'Ranked'
                                            },
                                            {
                                                id: 'league',
                                                label: 'League',
                                                icon: Trophy,
                                                color: 'text-yellow-500',
                                                borderColor: 'border-yellow-500',
                                                bgGradient: 'from-yellow-500/20 via-yellow-500/5 to-transparent',
                                                description: 'VIP Ranked'
                                            },
                                            {
                                                id: 'clan_war',
                                                label: 'Clan War',
                                                icon: Swords,
                                                color: 'text-purple-500',
                                                borderColor: 'border-purple-500',
                                                bgGradient: 'from-purple-500/20 via-purple-500/5 to-transparent',
                                                description: '5v5 Clan'
                                            },
                                        ].map((type) => (
                                            <CarouselItem key={type.id} className="pl-2 basis-1/2 sm:basis-1/3">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        // Logic for each type
                                                        if (type.id === 'casual') {
                                                            setMatchType('casual');
                                                        } else if (type.id === 'competitive') {
                                                            const elo = user?.elo || 1000;
                                                            if (elo < 1600) {
                                                                setMatchType('competitive');
                                                            } else {
                                                                setError('Competitive matches are for Bronze/Silver players only (Elo < 1600). Gold players cannot participate.');
                                                            }
                                                        } else if (type.id === 'league') {
                                                            const isVip = !!user?.is_vip;
                                                            const isAdmin = user?.role === 'admin';
                                                            const vipUntil = user?.vip_until ? new Date(user.vip_until) : null;
                                                            const now = new Date();
                                                            const isVipValid = isVip && (!vipUntil || vipUntil > now);
                                                            const isActive = isVipValid || isAdmin;

                                                            if (isActive) {
                                                                setMatchType('league');
                                                            } else {
                                                                setError('League matches require an active VIP membership. Contact an administrator to upgrade.');
                                                            }
                                                        } else if (type.id === 'clan_war') {
                                                            setMatchType('clan_war');
                                                        }
                                                    }}
                                                    className="w-full text-left group flex flex-col items-center"
                                                >
                                                    <div className={`
                                                        overflow-hidden rounded-md w-full aspect-video transition-all bg-zinc-900 border-2 relative flex flex-col items-center justify-center
                                                        ${matchType === type.id
                                                            ? `${type.borderColor} ring-2 ring-opacity-20 scale-105`
                                                            : 'border-white/5 bg-zinc-900/50 opacity-70 hover:opacity-100 hover:scale-105 hover:border-white/20'
                                                        }
                                                    `}>
                                                        {/* Background Gradient */}
                                                        <div className={`absolute inset-0 bg-gradient-to-br ${type.bgGradient} opacity-20`} />

                                                        {/* Icon */}
                                                        <type.icon className={`h-8 w-8 sm:h-10 sm:w-10 ${type.color} mb-1 sm:mb-2 relative z-10`} />

                                                        {/* Description (Small) */}
                                                        <span className="text-[9px] sm:text-[10px] text-gray-400 font-medium uppercase tracking-wider relative z-10">
                                                            {type.description}
                                                        </span>

                                                        {/* Selected Checkmark Overlay */}
                                                        {matchType === type.id && (
                                                            <div className={`absolute inset-0 ${type.color.replace('text-', 'bg-')}/10 flex items-center justify-center z-20`}>
                                                                <div className={`${type.color.replace('text-', 'bg-')} rounded-full p-1 shadow-lg`}>
                                                                    <Check className="h-4 w-4 text-black" />
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Locked/Restricted Overlays */}
                                                        {type.id === 'competitive' && ((user?.elo || 1000) >= 1600) && (
                                                            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-[1px]">
                                                                <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 mb-1" />
                                                                <span className="text-[9px] sm:text-[10px] font-bold text-blue-500 uppercase tracking-wider text-center px-1">
                                                                    Elo &lt; 1600
                                                                </span>
                                                            </div>
                                                        )}

                                                        {type.id === 'league' && (() => {
                                                            const isVip = !!user?.is_vip;
                                                            const isAdmin = user?.role === 'admin';
                                                            const vipUntil = user?.vip_until ? new Date(user.vip_until) : null;
                                                            const now = new Date();
                                                            const isVipValid = isVip && (!vipUntil || vipUntil > now);
                                                            const isActive = isVipValid || isAdmin;

                                                            if (!isActive) {
                                                                return (
                                                                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-[1px]">
                                                                        <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500 mb-2" />
                                                                        <Button
                                                                            size="sm"
                                                                            variant="default"
                                                                            className="h-6 text-[10px] bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-2 rounded-full"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setShowCreateModal(false);
                                                                                if (onNavigateToVip) onNavigateToVip();
                                                                            }}
                                                                        >
                                                                            GET VIP
                                                                        </Button>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>

                                                    {/* Label below card */}
                                                    <p className={`text-[10px] sm:text-xs text-center mt-1 sm:mt-2 font-medium ${matchType === type.id ? type.color : 'text-gray-400'}`}>
                                                        {type.label}
                                                    </p>
                                                </button>
                                            </CarouselItem>
                                        ))}
                                    </CarouselContent>
                                    <CarouselPrevious className="bg-zinc-800 border-white/10 text-white hover:bg-zinc-700 hover:text-white h-8 w-8 sm:h-10 sm:w-10 -left-2" />
                                    <CarouselNext className="bg-zinc-800 border-white/10 text-white hover:bg-zinc-700 hover:text-white h-8 w-8 sm:h-10 sm:w-10 -right-2" />
                                </Carousel>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs sm:text-sm font-medium leading-none text-white block mb-2">Select Map <span className="text-destructive">*</span></label>
                            <div className="w-full px-2 sm:px-10">
                                <Carousel
                                    className="w-full max-w-full"
                                    opts={{
                                        align: "start",
                                        loop: true,
                                    }}
                                >
                                    <CarouselContent className="-ml-2">
                                        {MAPS.map((map) => (
                                            <CarouselItem key={map.name} className="pl-2 basis-1/2 sm:basis-1/3">
                                                <div
                                                    className="relative cursor-pointer group"
                                                    onClick={() => setSelectedMap(map.name)}
                                                >
                                                    <div className={`
                                                        overflow-hidden rounded-md w-full aspect-video transition-all bg-zinc-900 border-2 relative
                                                        ${selectedMap === map.name ? 'border-primary ring-2 ring-primary/20 scale-105' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-105'}
                                                    `}>
                                                        <img
                                                            src={map.image}
                                                            alt={map.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                        {selectedMap === map.name && (
                                                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                                                <div className="bg-primary rounded-full p-1 shadow-lg">
                                                                    <Check className="h-4 w-4 text-white" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className={`text-[10px] sm:text-xs text-center mt-1 sm:mt-2 font-medium ${selectedMap === map.name ? 'text-primary' : 'text-gray-400'}`}>
                                                        {map.name}
                                                    </p>
                                                </div>
                                            </CarouselItem>
                                        ))}
                                    </CarouselContent>
                                    <CarouselPrevious className="bg-zinc-800 border-white/10 text-white hover:bg-zinc-700 hover:text-white h-8 w-8 sm:h-10 sm:w-10" />
                                    <CarouselNext className="bg-zinc-800 border-white/10 text-white hover:bg-zinc-700 hover:text-white h-8 w-8 sm:h-10 sm:w-10" />
                                </Carousel>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-destructive/10 text-destructive text-xs sm:text-sm p-3 rounded-md border border-destructive/20 flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-medium">Error creating lobby</p>
                                    <p className="text-[10px] sm:text-xs opacity-90">{error}</p>
                                    {activeMatchIdError && (
                                        <Button
                                            variant="link"
                                            className="p-0 h-auto text-destructive underline mt-1 text-xs"
                                            onClick={() => { setSelectedMatchId(activeMatchIdError); setShowCreateModal(false); }}
                                        >
                                            Rejoin active match
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Turnstile removed */}
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white w-full sm:w-auto order-2 sm:order-1">Cancel</Button>
                        <Button
                            onClick={handleCreateLobby}
                            disabled={creating || !lobbyUrl.trim()}
                            className="font-bold shadow-lg shadow-primary/20 w-full sm:w-auto order-1 sm:order-2 h-11"
                        >
                            {creating ? (
                                <>
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                    CREATING...
                                </>
                            ) : (
                                <>
                                    <Swords className="mr-2 h-4 w-4" /> CREATE LOBBY
                                </>
                            )}
                        </Button>
                    </DialogFooter>
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
        </div>
    );
};

export default MatchmakingPage;
