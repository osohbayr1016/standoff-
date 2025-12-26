import React, { useState, useEffect } from 'react';
import { useWebSocket } from './WebSocketContext';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
    Trophy,
    Map as MapIcon,
    User,
    LogOut,
    Play,
    AlertTriangle,
    Upload,
    Check,
    X,
    RotateCcw,
    Crown,
    ExternalLink,
    Loader2,
    UserPlus
} from "lucide-react";
import InviteFriendModal from './InviteFriendModal';

interface MatchPlayer {
    player_id: string;
    team: string;
    discord_username?: string;
    discord_avatar?: string;
    elo?: number;
    standoff_nickname?: string;
    role?: string;
}

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
    created_at: string;
}

interface LobbyDetailPageProps {
    matchId: string;
    user: {
        id: string;
        username: string;
        avatar?: string;
    } | null;
    backendUrl: string;
    onBack: () => void;
}

const LobbyDetailPage: React.FC<LobbyDetailPageProps> = ({ matchId, user, backendUrl, onBack }) => {
    const { lastMessage } = useWebSocket();
    const [match, setMatch] = useState<Match | null>(null);
    const [players, setPlayers] = useState<MatchPlayer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submittingResult, setSubmittingResult] = useState(false);
    const [winnerTeam, setWinnerTeam] = useState<'alpha' | 'bravo'>('alpha');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [showInviteModal, setShowInviteModal] = useState(false);

    // Fetch match details
    const fetchMatchDetails = async () => {
        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}`);
            const data = await response.json();
            if (data.success) {
                setMatch(data.match);
                setPlayers(data.players || []);
            } else {
                setError(data.error || 'Failed to load match');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMatchDetails();
        const interval = setInterval(fetchMatchDetails, 5000);
        return () => clearInterval(interval);
    }, [matchId, backendUrl]);

    // Handle WebSocket updates
    useEffect(() => {
        if (lastMessage) {
            try {
                const msg = JSON.parse(lastMessage);
                if (msg.type === 'LOBBY_UPDATED' && msg.matchId === matchId) {
                    fetchMatchDetails();
                }
            } catch (e) { }
        }
    }, [lastMessage]);

    // Leave lobby
    const handleLeaveLobby = async () => {
        if (!user) return;

        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}/leave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: user.id })
            });

            const data = await response.json();
            if (data.success) {
                onBack();
            } else {
                alert(data.error || 'Failed to leave');
            }
        } catch (err) {
            alert('Network error');
        }
    };

    // Switch team
    const handleSwitchTeam = async () => {
        if (!user) return;

        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}/switch-team`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: user.id })
            });

            const data = await response.json();
            if (data.success) {
                fetchMatchDetails();
            } else {
                alert(data.error || 'Failed to switch team');
            }
        } catch (err) {
            alert('Network error');
        }
    };

    // Start match (host only)
    const handleStartMatch = async () => {
        if (!user || !match) return;

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
                fetchMatchDetails();
            } else {
                alert(data.error || 'Failed to start match');
            }
        } catch (err) {
            alert('Network error');
        }
    };

    // Cancel match (host only) - for trolled/bad matches
    const handleCancelMatch = async () => {
        if (!user || !match) return;

        let confirmMessage = 'Cancel this match? This should only be used if the match cannot be completed.';

        if (match.status === 'in_progress') {
            confirmMessage = '⚠️ WARNING: Are you sure you want to cancel this match for TROLLING?\n\n🛑 If you report false information or abuse this feature to avoid a loss, you WILL lose -50 ELO.\n\nDo you really want to proceed?';
        }

        const confirmCancel = window.confirm(confirmMessage);

        if (!confirmCancel) return;

        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host_id: user.id,
                    status: 'cancelled'
                })
            });

            const data = await response.json();
            if (data.success) {
                alert('Match cancelled successfully');
                onBack();
            } else {
                alert(data.error || 'Failed to cancel match');
            }
        } catch (err) {
            alert('Network error');
        }
    };

    // Invite friend to lobby
    const handleInviteFriend = async (friend: any) => {
        if (!user || !match) return;

        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}/invite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user.id
                },
                body: JSON.stringify({
                    friend_id: friend.id
                })
            });

            const data = await response.json();
            if (data.success) {
                alert(`Invitation sent to ${friend.username || friend.nickname}!`);
                setShowInviteModal(false);
            } else {
                alert(data.error || 'Failed to send invitation');
            }
        } catch (err) {
            alert('Network error');
        }
    };

    // Submit result
    const handleSubmitResult = async () => {
        if (!user || !match) return;
        setSubmittingResult(true);

        try {
            let screenshotUrl = '';

            // Upload file if selected
            if (selectedFile) {
                const formData = new FormData();
                formData.append('file', selectedFile);

                const uploadRes = await fetch(`${backendUrl}/api/upload`, {
                    method: 'POST',
                    headers: { 'X-User-Id': user.id },
                    body: formData
                });

                const uploadData = await uploadRes.json();
                if (!uploadData.success) {
                    alert('Failed to upload screenshot: ' + uploadData.error);
                    setSubmittingResult(false);
                    return;
                }
                screenshotUrl = uploadData.url;
            } else if (!screenshotUrl) {
                alert('Please upload a screenshot or provide a URL');
                setSubmittingResult(false);
                return;
            }

            const response = await fetch(`${backendUrl}/api/matches/${matchId}/result`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host_id: user.id,
                    winner_team: winnerTeam,
                    screenshot_url: screenshotUrl
                })
            });

            const data = await response.json();
            if (data.success) {
                alert('Result submitted! Waiting for moderator review.');
                fetchMatchDetails();
            } else {
                alert(data.error || 'Failed to submit result');
            }
        } catch (err) {
            alert('Network error');
        } finally {
            setSubmittingResult(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Loading lobby details...</p>
            </div>
        );
    }

    if (error || !match) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <AlertTriangle className="h-12 w-12 text-destructive" />
                <h2 className="text-xl font-bold">Error Loading Lobby</h2>
                <p className="text-muted-foreground">{error || 'Match not found'}</p>
                <Button onClick={onBack} variant="outline" className="mt-4">
                    Return to Lobby Browser
                </Button>
            </div>
        );
    }

    const isHost = user?.id === match.host_id;
    const isInMatch = players.some(p => p.player_id === user?.id);
    const alphaPlayers = players.filter(p => p.team === 'alpha');
    const bravoPlayers = players.filter(p => p.team === 'bravo');

    return (
        <div className="space-y-6 container mx-auto max-w-7xl animate-fade-in pb-12">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/50 pb-6">
                <div className="flex items-center gap-4">
                    <Button onClick={onBack} variant="ghost" size="icon" className="rounded-full hover:bg-muted">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-lg md:text-2xl font-bold font-display uppercase tracking-wider flex items-center gap-2 md:gap-3">
                            Lobby #{match.id.slice(0, 8)}
                            <Badge
                                variant={match.status === 'in_progress' ? 'secondary' : 'outline'}
                                className={`${match.status === 'in_progress' ? 'animate-pulse' : ''} uppercase tracking-widest text-[9px] md:text-[10px]`}
                            >
                                {match.status.replace('_', ' ')}
                            </Badge>
                        </h1>
                        <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground mt-1">
                            {match.map_name && (
                                <span className="flex items-center gap-1">
                                    <MapIcon className="h-3 w-3" /> {match.map_name}
                                </span>
                            )}
                            <span className="flex items-center gap-1">
                                <Crown className="h-3 w-3 text-yellow-500" /> Host: {match.host_username || 'Unknown'}
                            </span>
                        </div>
                    </div>
                </div>

                {isInMatch && (
                    <Button
                        onClick={() => window.open(match.lobby_url, '_blank')}
                        className="w-full md:w-auto font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                    >
                        <ExternalLink className="mr-2 h-4 w-4" /> Open Standoff 2
                    </Button>
                )}
            </div>

            {/* Teams Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-9 gap-6 items-start">
                {/* Alpha Team */}
                <div className="lg:col-span-4 space-y-3">
                    <div className="flex items-center justify-between px-4 lg:px-5 py-3 lg:py-4 bg-[#23252a] rounded-lg border-l-4 border-[#5b9bd5]">
                        <div className="flex items-center gap-2 lg:gap-3">
                            <div className="w-2 h-2 lg:w-3 lg:h-3 rounded-full bg-[#5b9bd5] animate-pulse"></div>
                            <h2 className="text-sm lg:text-base font-bold uppercase tracking-wider text-[#5b9bd5]">Team Alpha</h2>
                        </div>
                        <Badge variant="secondary" className="bg-[#5b9bd5]/20 text-[#5b9bd5] font-mono text-xs lg:text-sm">
                            {alphaPlayers.length}/5
                        </Badge>
                    </div>

                    <div className="space-y-2 lg:space-y-3">
                        {alphaPlayers.map(player => (
                            <div key={player.player_id} className="bg-[#1c1e22] hover:bg-[#23252a] transition-all duration-200 rounded-lg border border-[#5b9bd5]/20 p-3 lg:p-4 group">
                                <div className="flex items-center gap-3 lg:gap-4">
                                    <Avatar className="h-11 w-11 lg:h-14 lg:w-14 border-2 border-[#5b9bd5]/30 group-hover:border-[#5b9bd5]/60 transition-colors">
                                        <AvatarImage src={`https://cdn.discordapp.com/avatars/${player.player_id}/${player.discord_avatar}.png`} />
                                        <AvatarFallback className="bg-[#5b9bd5]/20 text-[#5b9bd5]"><User className="h-5 w-5 lg:h-6 lg:w-6" /></AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-white truncate text-sm lg:text-base">
                                                {player.standoff_nickname || player.discord_username || 'Player'}
                                            </span>
                                            {player.role === 'admin' && <Badge className="text-[9px] lg:text-[10px] px-1.5 py-0 bg-[#ff5500] text-white border-0 font-bold">ADMIN</Badge>}
                                            {player.role === 'moderator' && <Badge className="text-[9px] lg:text-[10px] px-1.5 py-0 bg-[#5b9bd5] text-white border-0 font-bold">MOD</Badge>}
                                        </div>
                                        <div className="text-[11px] lg:text-xs text-white/40 font-mono">
                                            ELO: <span className="text-white/60 font-semibold">{player.elo || 1000}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {Array(5 - alphaPlayers.length).fill(0).map((_, i) => (
                            <div key={`empty-alpha-${i}`} className="h-[68px] rounded-lg border-2 border-dashed border-[#5b9bd5]/10 bg-[#1c1e22]/30 flex items-center justify-center text-white/20 text-xs font-medium uppercase tracking-widest">
                                Waiting for player...
                            </div>
                        ))}
                    </div>
                </div>

                {/* VS Divider */}
                <div className="lg:col-span-1 flex flex-col items-center justify-center py-2 lg:py-20 text-muted-foreground/20 font-display font-black text-3xl lg:text-6xl italic select-none">
                    VS
                </div>

                {/* Bravo Team */}
                <div className="lg:col-span-4 space-y-3">
                    <div className="flex items-center justify-between px-4 lg:px-5 py-3 lg:py-4 bg-[#23252a] rounded-lg border-r-4 border-[#e74c3c] lg:flex-row-reverse">
                        <div className="flex items-center gap-2 lg:gap-3 lg:flex-row-reverse">
                            <div className="w-2 h-2 lg:w-3 lg:h-3 rounded-full bg-[#e74c3c] animate-pulse"></div>
                            <h2 className="text-sm lg:text-base font-bold uppercase tracking-wider text-[#e74c3c]">Team Bravo</h2>
                        </div>
                        <Badge variant="secondary" className="bg-[#e74c3c]/20 text-[#e74c3c] font-mono text-xs lg:text-sm">
                            {bravoPlayers.length}/5
                        </Badge>
                    </div>

                    <div className="space-y-2 lg:space-y-3">
                        {bravoPlayers.map(player => (
                            <div key={player.player_id} className="bg-[#1c1e22] hover:bg-[#23252a] transition-all duration-200 rounded-lg border border-[#e74c3c]/20 p-3 lg:p-4 group">
                                <div className="flex items-center gap-3 lg:gap-4">
                                    <Avatar className="h-11 w-11 lg:h-14 lg:w-14 border-2 border-[#e74c3c]/30 group-hover:border-[#e74c3c]/60 transition-colors">
                                        <AvatarImage src={`https://cdn.discordapp.com/avatars/${player.player_id}/${player.discord_avatar}.png`} />
                                        <AvatarFallback className="bg-[#e74c3c]/20 text-[#e74c3c]"><User className="h-5 w-5 lg:h-6 lg:w-6" /></AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-white truncate text-sm lg:text-base">
                                                {player.standoff_nickname || player.discord_username || 'Player'}
                                            </span>
                                            {player.role === 'admin' && <Badge className="text-[9px] lg:text-[10px] px-1.5 py-0 bg-[#ff5500] text-white border-0 font-bold">ADMIN</Badge>}
                                            {player.role === 'moderator' && <Badge className="text-[9px] lg:text-[10px] px-1.5 py-0 bg-[#e74c3c] text-white border-0 font-bold">MOD</Badge>}
                                        </div>
                                        <div className="text-[11px] lg:text-xs text-white/40 font-mono">
                                            ELO: <span className="text-white/60 font-semibold">{player.elo || 1000}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {Array(5 - bravoPlayers.length).fill(0).map((_, i) => (
                            <div key={`empty-bravo-${i}`} className="h-[68px] rounded-lg border-2 border-dashed border-[#e74c3c]/10 bg-[#1c1e22]/30 flex items-center justify-center text-white/20 text-xs font-medium uppercase tracking-widest">
                                Waiting for player...
                            </div>
                        ))}
                    </div>
                </div>

                {/* Action Bar - Positioned after teams */}
                <div className="mt-6">
                    <Card className="border border-border bg-card shadow-lg">
                        <div className="p-4 lg:p-6 flex flex-col md:flex-row items-center justify-between gap-4 lg:gap-6">
                            {match.status === 'waiting' && (
                                <div className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    {/* Mobile-First Grid Layout */}
                                    <div className="grid grid-cols-2 lg:flex lg:items-center gap-3 lg:gap-4 w-full">

                                        {/* Row 1: Primary Action (Start Match) - Host Only */}
                                        {isHost && (
                                            <div className="col-span-2 lg:w-auto flex flex-col gap-2">
                                                <Button
                                                    onClick={handleStartMatch}
                                                    disabled={players.length < 2}
                                                    className="w-full lg:w-auto h-12 lg:h-11 lg:px-8 bg-[#ff5500] hover:bg-[#e64d00] text-white font-bold shadow-lg uppercase tracking-wide transition-all text-sm"
                                                >
                                                    <Play className="mr-2 h-4 w-4 fill-current" />
                                                    Start Match ({players.length}/10)
                                                </Button>
                                                <Button
                                                    onClick={handleCancelMatch}
                                                    variant="ghost"
                                                    className="h-8 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 lg:hidden"
                                                >
                                                    <X className="mr-1 h-3 w-3" /> Cancel Lobby
                                                </Button>
                                            </div>
                                        )}

                                        {/* Row 2: Secondary Primary (Invite) */}
                                        {isInMatch && (
                                            <Button
                                                onClick={() => setShowInviteModal(true)}
                                                className={`col-span-2 lg:w-auto h-12 lg:h-11 lg:px-8 bg-[#5b9bd5] hover:bg-[#4a8ac0] text-white font-bold shadow-md uppercase tracking-wide text-sm ${isHost ? 'mt-2 lg:mt-0 lg:ml-auto' : 'lg:ml-auto'}`}
                                            >
                                                <UserPlus className="mr-2 h-4 w-4" /> Invite Friends
                                            </Button>
                                        )}

                                        {/* Row 3: Management Actions (Switch / Leave) */}
                                        {isInMatch && (
                                            <>
                                                <Button
                                                    onClick={handleSwitchTeam}
                                                    className="col-span-1 lg:w-auto h-12 lg:h-11 lg:px-6 bg-[#18181b] hover:bg-[#27272a] text-white border border-white/5 font-semibold text-sm"
                                                >
                                                    <RotateCcw className="mr-2 h-4 w-4" /> Switch
                                                </Button>

                                                <Button
                                                    onClick={handleLeaveLobby}
                                                    variant="outline"
                                                    className="col-span-1 lg:w-auto h-12 lg:h-11 lg:px-6 border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 font-semibold text-sm bg-transparent"
                                                >
                                                    <LogOut className="mr-2 h-4 w-4" /> Leave
                                                </Button>
                                            </>
                                        )}

                                        {/* Desktop Only: Host Cancel Button */}
                                        {isHost && (
                                            <Button
                                                onClick={handleCancelMatch}
                                                className="hidden lg:flex h-12 lg:h-11 w-12 lg:w-11 bg-[#ff002b] hover:bg-[#d60024] text-white border-none shadow-lg p-0 rounded-md ml-2"
                                                title="Cancel Match"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {match.status === 'in_progress' && isHost && (
                                <div className="w-full flex flex-col md:flex-row items-center gap-4">
                                    <div className="flex-1 w-full p-4 bg-muted/30 rounded-lg border border-border/50">
                                        <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2 text-primary">
                                            <Trophy className="h-4 w-4" /> Submit Match Result
                                        </h3>

                                        <div className="grid gap-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <Button
                                                    onClick={() => setWinnerTeam('alpha')}
                                                    variant={winnerTeam === 'alpha' ? 'default' : 'outline'}
                                                    className={`h-24 flex flex-col items-center justify-center gap-2 border-2 ${winnerTeam === 'alpha' ? 'border-orange-500 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20' : 'hover:bg-muted'}`}
                                                >
                                                    <span className="text-2xl">🦁</span>
                                                    <span className="font-bold">Team Alpha</span>
                                                </Button>
                                                <Button
                                                    onClick={() => setWinnerTeam('bravo')}
                                                    variant={winnerTeam === 'bravo' ? 'default' : 'outline'}
                                                    className={`h-24 flex flex-col items-center justify-center gap-2 border-2 ${winnerTeam === 'bravo' ? 'border-blue-500 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20' : 'hover:bg-muted'}`}
                                                >
                                                    <span className="text-2xl">🦈</span>
                                                    <span className="font-bold">Team Bravo</span>
                                                </Button>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Proof of Victory (Screenshot)</label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                                                        className="hidden"
                                                        id="screenshot-upload"
                                                    />
                                                    <label
                                                        htmlFor="screenshot-upload"
                                                        className="flex-1 flex items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-md p-4 cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-all"
                                                    >
                                                        {selectedFile ? (
                                                            <span className="text-green-500 flex items-center gap-2 font-medium"><Check className="h-5 w-5" /> {selectedFile.name}</span>
                                                        ) : (
                                                            <span className="text-muted-foreground flex items-center gap-2"><Upload className="h-5 w-5" /> Click to upload screenshot</span>
                                                        )}
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="flex justify-end gap-2 pt-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-muted-foreground hover:text-destructive text-xs"
                                                    onClick={handleCancelMatch}
                                                >
                                                    Cancel Match (Trolled)
                                                </Button>
                                                <Button onClick={handleSubmitResult} disabled={submittingResult} className="font-bold">
                                                    {submittingResult && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                    Submit Result
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Invite Friend Modal */}
                    {showInviteModal && (
                        <InviteFriendModal
                            currentPartyIds={players.map(p => p.player_id)}
                            onInvite={handleInviteFriend}
                            onClose={() => setShowInviteModal(false)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

// Simple ArrowLeft icon component if not available in lucide-react imports due to version
const ArrowLeft = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="m12 19-7-7 7-7" />
        <path d="M19 12H5" />
    </svg>
);

export default LobbyDetailPage;
