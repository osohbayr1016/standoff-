import React, { useState, useEffect } from 'react';
import { useWebSocket } from './WebSocketContext';
import LobbyDetailPage from './LobbyDetailPage';
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Gamepad2, Plus, Users, Map as MapIcon, Loader2, Trophy, AlertTriangle, ExternalLink, Check, ShieldAlert } from "lucide-react";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";

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
}

interface MatchmakingPageProps {
    user: {
        id: string;
        username: string;
        avatar?: string;
        is_vip?: number;
        vip_until?: string;
        role?: string;
    } | null;
    backendUrl: string;
    onViewProfile?: (userId: string) => void;
}

const MatchmakingPage: React.FC<MatchmakingPageProps> = ({ user, backendUrl, onViewProfile }) => {
    const { sendMessage: _sendMessage, lastMessage } = useWebSocket();
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [lobbyUrl, setLobbyUrl] = useState('');
    const [selectedMap, setSelectedMap] = useState<string | null>(null);
    const [matchType, setMatchType] = useState<'casual' | 'league'>('casual');

    const MAPS = [
        { name: 'Hanami', image: '/maps/hanami.png' },
        { name: 'Sandstone', image: '/maps/rust.jpg' },
        { name: 'Dune', image: '/maps/breeze.png' },
        { name: 'Breeze', image: '/maps/dune.jpg' },
        { name: 'Province', image: '/maps/dust.jpg' },
        { name: 'Rust', image: '/maps/sandstone.png' },
        { name: 'Zone 7', image: '/maps/zone7.jpg' }
    ];
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [, setUserMatch] = useState<Match | null>(null);
    const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
    const [activeMatchIdError, setActiveMatchIdError] = useState<string | null>(null);
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
        // Refresh every 5 seconds
        const interval = setInterval(fetchMatches, 5000);
        return () => clearInterval(interval);
    }, [backendUrl]);

    // Fetch user's active match
    const fetchMyActiveMatch = async () => {
        if (!user) return;
        try {
            const response = await fetch(`${backendUrl}/api/matches?status=waiting,in_progress`);
            const data = await response.json();
            if (data.success && data.matches) {
                // Find match where user is a participant
                const userMatch = data.matches.find((m: Match) =>
                    m.host_id === user.id || m.player_count > 0 // This is simplified, ideally check match_players
                );
                setMyActiveMatch(userMatch || null);
            }
        } catch (err) {
            console.error('Error fetching active match:', err);
        }
    };

    useEffect(() => {
        if (user) {
            fetchMyActiveMatch();
        }
    }, [user, backendUrl]);

    // Handle WebSocket messages for real-time updates
    useEffect(() => {
        if (lastMessage) {
            try {
                const msg = JSON.parse(lastMessage);
                if (msg.type === 'LOBBY_CREATED' || msg.type === 'LOBBY_UPDATED' || msg.type === 'PLAYER_JOINED' || msg.type === 'PLAYER_LEFT') {
                    fetchMatches();
                }
            } catch (e) { }
        }
    }, [lastMessage]);

    // Create lobby
    const handleCreateLobby = async () => {
        if (!user || !lobbyUrl.trim()) return;

        setCreating(true);
        setError(null);

        try {
            const response = await fetch(`${backendUrl}/api/matches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                console.log("Joined lobby!");
                setSelectedMatchId(matchId);
            } else {
                alert(data.error || 'Failed to join lobby');
            }
        } catch (err) {
            alert('Network error');
        }
    };

    // Leave lobby
    const handleLeaveLobby = async (matchId: string) => {
        if (!user) return;

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
                console.log("Left lobby");
            } else {
                alert(data.error || 'Failed to leave lobby');
            }
        } catch (err) {
            alert('Network error');
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

    return (
        <div className="space-y-6 container mx-auto max-w-7xl animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-display tracking-tighter text-white flex items-center gap-2">
                        <Gamepad2 className="h-8 w-8 text-primary" /> Active Lobbies
                    </h1>
                    <p className="text-muted-foreground">Find a match or create your own custom lobby.</p>
                </div>
                <Button
                    onClick={() => setShowCreateModal(true)}
                    className="shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all font-bold"
                >
                    <Plus className="mr-2 h-4 w-4" /> Create Lobby
                </Button>
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
            ) : matches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border/50 rounded-xl bg-card/20 text-center">
                    <div className="bg-muted/30 p-6 rounded-full mb-4">
                        <Trophy className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">No Active Lobbies</h3>
                    <p className="text-muted-foreground max-w-md mb-6">There are currently no open lobbies. Be the first to start a match and invite others!</p>
                    <Button onClick={() => setShowCreateModal(true)} variant="outline">
                        Create First Lobby
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {matches.map((match) => (
                        <Card
                            key={match.id}
                            onClick={() => setSelectedMatchId(match.id)}
                            className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all cursor-pointer group overflow-hidden relative hover:shadow-xl hover:shadow-primary/5"
                        >
                            {/* Map Background Image Overlay */}
                            {match.map_name && (
                                <div className="absolute inset-0 z-0 opacity-20 group-hover:opacity-40 transition-opacity">
                                    <img
                                        src={MAPS.find(m => m.name === match.map_name)?.image || `/maps/${match.map_name.toLowerCase()}.jpg`}
                                        className="w-full h-full object-cover grayscale"
                                        onError={(e) => e.currentTarget.style.display = 'none'}
                                    />
                                </div>
                            )}

                            <CardHeader className="flex flex-row items-center justify-between pb-3 z-10 relative">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10 border border-border">
                                        <AvatarImage src={`https://cdn.discordapp.com/avatars/${match.host_id}/${match.host_avatar}.png`} />
                                        <AvatarFallback>{match.host_username?.[0]?.toUpperCase() || 'H'}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium leading-none text-foreground group-hover:text-primary transition-colors">
                                            {match.host_username || 'Unknown Host'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">Host</span>
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
                                <div className="flex items-center justify-between text-sm border-t border-border/50 pt-4">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Users className="h-4 w-4" />
                                        <span>Players</span>
                                    </div>
                                    <div className="font-mono font-bold">
                                        <span className="text-foreground">{match.current_players || match.player_count}</span>
                                        <span className="text-muted-foreground">/</span>
                                        <span className="text-muted-foreground">{match.max_players}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <MapIcon className="h-4 w-4" />
                                        <span>Map</span>
                                    </div>
                                    <span className="font-medium text-foreground">{match.map_name || 'Random'}</span>
                                </div>
                            </CardContent>

                            <CardFooter className="pt-2 z-10 relative">
                                {match.host_id === user.id ? (
                                    <div className="w-full flex gap-2">
                                        <Button
                                            className="w-full flex-1"
                                            variant="default"
                                            onClick={(e) => { e.stopPropagation(); handleStartMatch(match.id); }}
                                            disabled={(match.current_players || match.player_count) < 2}
                                        >
                                            Start
                                        </Button>
                                        <Button
                                            className="w-full flex-1"
                                            variant="destructive"
                                            onClick={(e) => { e.stopPropagation(); handleLeaveLobby(match.id); }}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                                        variant="secondary"
                                        onClick={(e) => { e.stopPropagation(); handleJoinLobby(match.id); }}
                                        disabled={(match.current_players || match.player_count) >= match.max_players}
                                    >
                                        {(match.current_players || match.player_count) >= match.max_players ? 'Full Lobby' : 'Join Match'}
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create Lobby Dialog */}
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogContent className="sm:max-w-md bg-zinc-900 border-white/10 text-white z-[100]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-display uppercase tracking-tight text-white">Create New Lobby</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Configure your match settings. Paste your custom lobby URL to start.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none text-white block">
                                Lobby URL <span className="text-destructive">*</span>
                            </label>
                            <div className="relative">
                                <ExternalLink className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    value={lobbyUrl}
                                    onChange={(e) => setLobbyUrl(e.target.value)}
                                    placeholder="standoff2://lobby/..."
                                    className="pl-9 font-mono text-sm bg-zinc-800/50 border-white/10 text-white focus:border-primary/50"
                                />
                            </div>
                            <p className="text-[10px] text-gray-500">Paste the custom lobby link generated in Standoff 2.</p>
                        </div>

                        {/* Match Type Selector */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none text-white block">
                                Match Type <span className="text-destructive">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setMatchType('casual')}
                                    className={`
                                        relative p-4 rounded-lg border-2 transition-all text-left
                                        ${matchType === 'casual'
                                            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                                            : 'border-white/10 bg-zinc-800/50 hover:border-white/20'
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Gamepad2 className="h-4 w-4 text-primary" />
                                        <span className="font-bold text-white">Casual</span>
                                    </div>
                                    <p className="text-xs text-gray-400">Quick match, no ELO changes</p>
                                    {matchType === 'casual' && (
                                        <div className="absolute top-2 right-2">
                                            <Check className="h-4 w-4 text-primary" />
                                        </div>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const isVip = user?.is_vip === 1;
                                        const isAdmin = user?.role === 'admin';
                                        const vipUntil = user?.vip_until ? new Date(user.vip_until) : null;
                                        const now = new Date();
                                        const isActive = (isVip && vipUntil && vipUntil > now) || isAdmin;

                                        if (isActive) {
                                            setMatchType('league');
                                        } else {
                                            setError('League matches require an active VIP membership. Contact an administrator to upgrade.');
                                        }
                                    }}
                                    className={`
                                        relative p-4 rounded-lg border-2 transition-all text-left group
                                        ${matchType === 'league'
                                            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                                            : ((user?.is_vip === 1 && user.vip_until && new Date(user.vip_until) > new Date()) || user?.role === 'admin')
                                                ? 'border-white/10 bg-zinc-800/50 hover:border-white/20'
                                                : 'border-white/5 bg-zinc-900/30 opacity-60 cursor-not-allowed'
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Trophy className="h-4 w-4 text-primary" />
                                        <span className="font-bold text-white">League</span>
                                        {(!user?.is_vip || !user.vip_until || new Date(user.vip_until) < new Date()) && (
                                            <ShieldAlert className="h-3 w-3 text-yellow-500" />
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-400">Ranked, ELO changes apply</p>
                                    {matchType === 'league' && (
                                        <div className="absolute top-2 right-2">
                                            <Check className="h-4 w-4 text-primary" />
                                        </div>
                                    )}
                                    {(!user?.is_vip || !user.vip_until || new Date(user.vip_until) < new Date()) && (
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-yellow-600 text-[10px] text-black font-bold px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                            VIP Required
                                        </div>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none text-white block mb-2">Select Map <span className="text-destructive">*</span></label>
                            <div className="w-full px-10">
                                <Carousel
                                    className="w-full max-w-full"
                                    opts={{
                                        align: "start",
                                        loop: true,
                                    }}
                                >
                                    <CarouselContent className="-ml-2">
                                        {MAPS.map((map) => (
                                            <CarouselItem key={map.name} className="pl-2 basis-1/2 md:basis-1/3">
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
                                                    <p className={`text-xs text-center mt-2 font-medium ${selectedMap === map.name ? 'text-primary' : 'text-gray-400'}`}>
                                                        {map.name}
                                                    </p>
                                                </div>
                                            </CarouselItem>
                                        ))}
                                    </CarouselContent>
                                    <CarouselPrevious className="bg-zinc-800 border-white/10 text-white hover:bg-zinc-700 hover:text-white" />
                                    <CarouselNext className="bg-zinc-800 border-white/10 text-white hover:bg-zinc-700 hover:text-white" />
                                </Carousel>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20 flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-medium">Error creating lobby</p>
                                    <p className="text-xs opacity-90">{error}</p>
                                    {activeMatchIdError && (
                                        <Button
                                            variant="link"
                                            className="p-0 h-auto text-destructive underline mt-1"
                                            onClick={() => { setSelectedMatchId(activeMatchIdError); setShowCreateModal(false); }}
                                        >
                                            Rejoin active match
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">Cancel</Button>
                        <Button
                            onClick={handleCreateLobby}
                            disabled={creating || !lobbyUrl.trim() || !selectedMap}
                            className="bg-primary text-white hover:bg-primary/90 font-bold"
                        >
                            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Lobby
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default MatchmakingPage;
