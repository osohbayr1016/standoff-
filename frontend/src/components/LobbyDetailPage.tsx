import React, { useState, useEffect } from 'react';
import { useWebSocket } from './WebSocketContext';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
    UserPlus,
    ArrowLeft,
    Gamepad2,
    Pencil,
    ShieldAlert
} from "lucide-react";
import LevelBadge from './LevelBadge';
import Chat from './Chat';
import InviteFriendModal from './InviteFriendModal';


interface MatchPlayer {
    player_id: string;
    team: string;
    discord_username?: string;
    discord_avatar?: string;
    elo?: number;
    is_vip?: number | boolean;
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
    match_type?: 'casual' | 'league' | 'competitive' | 'clan_lobby' | 'clan_war';
    created_at: string;
    alpha_avg_elo?: number;
    bravo_avg_elo?: number;
}

interface LobbyDetailPageProps {
    matchId: string;
    user: {
        id: string;
        username: string;
        avatar?: string;
        role?: string;
    } | null;
    backendUrl: string;
    onBack: () => void;
    previousProfileUserId?: string | null;
    onNavigateToProfile?: (userId: string) => void;
}

const LobbyDetailPage: React.FC<LobbyDetailPageProps> = ({ matchId, user, backendUrl, onBack, previousProfileUserId }) => {
    const { lastMessage } = useWebSocket();
    const [match, setMatch] = useState<Match | null>(null);
    const [players, setPlayers] = useState<MatchPlayer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submittingResult, setSubmittingResult] = useState(false);
    const [winnerTeam, setWinnerTeam] = useState<'alpha' | 'bravo'>('alpha');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [lockedTeamNames, setLockedTeamNames] = useState<{ alpha: string | null; bravo: string | null }>({ alpha: null, bravo: null });
    const [isEditingLink, setIsEditingLink] = useState(false);
    const [newLobbyUrl, setNewLobbyUrl] = useState('');
    const [updatingLink, setUpdatingLink] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorDialogOpen, setErrorDialogOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    // Fetch match details
    const fetchMatchDetails = async () => {
        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}`);
            const data = await response.json();
            if (data.success) {
                setMatch(data.match);
                setPlayers(data.players || []);
                setNewLobbyUrl(data.match.lobby_url || '');
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

    // Lock team names when game starts
    useEffect(() => {
        if (match?.status === 'in_progress') {
            // Only lock if not already locked
            if (!lockedTeamNames.alpha && !lockedTeamNames.bravo) {
                const alphaPlayers = players.filter(p => p.team === 'alpha');
                const bravoPlayers = players.filter(p => p.team === 'bravo');

                const alphaLeader = alphaPlayers[0];
                const bravoLeader = bravoPlayers[0];

                const alphaName = alphaLeader
                    ? (alphaLeader.standoff_nickname || alphaLeader.discord_username || 'Team Alpha')
                    : 'Team Alpha';
                const bravoName = bravoLeader
                    ? (bravoLeader.standoff_nickname || bravoLeader.discord_username || 'Team Bravo')
                    : 'Team Bravo';

                setLockedTeamNames({ alpha: alphaName, bravo: bravoName });
            }
        } else {
            // Reset locked names when match is not in progress
            if (lockedTeamNames.alpha || lockedTeamNames.bravo) {
                setLockedTeamNames({ alpha: null, bravo: null });
            }
        }
    }, [match?.status, players]);

    // Handle WebSocket updates
    useEffect(() => {
        if (lastMessage) {
            try {
                const msg = lastMessage; // Already parsed
                if (msg.type === 'LOBBY_UPDATED' && msg.matchId === matchId) {
                    fetchMatchDetails();
                }
            } catch (e) { }
        }
    }, [lastMessage]);

    // Join lobby
    const handleJoinLobby = async () => {
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
                fetchMatchDetails();
            } else {
                setErrorMessage(data.error || 'Failed to join lobby');
                setErrorDialogOpen(true);
            }
        } catch (err) {
            setErrorMessage('Network error');
            setErrorDialogOpen(true);
        } finally {
            setIsProcessing(false);
        }
    };

    // Leave lobby
    const handleLeaveLobby = async () => {
        if (!user) return;
        setIsProcessing(true);
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
                setErrorMessage(data.error || 'Failed to leave lobby');
                setErrorDialogOpen(true);
            }
        } catch (err) {
            setErrorMessage('Network error');
            setErrorDialogOpen(true);
        } finally {
            setIsProcessing(false);
        }
    };

    // Switch team
    const handleSwitchTeam = async () => {
        if (!user) return;
        setIsProcessing(true);
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
                setErrorMessage(data.error || 'Failed to switch team');
                setErrorDialogOpen(true);
            }
        } catch (err) {
            setErrorMessage('Network error');
            setErrorDialogOpen(true);
        } finally {
            setIsProcessing(false);
        }
    };

    // Start match (host only)
    const handleStartMatch = async () => {
        if (!user || !match) return;
        setIsProcessing(true);

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
                setErrorMessage(data.error || 'Failed to start match');
                setErrorDialogOpen(true);
            }
        } catch (err) {
            setErrorMessage('Network error');
            setErrorDialogOpen(true);
        } finally {
            setIsProcessing(false);
        }
    };

    // Balance teams (host only)
    const handleBalanceTeams = async () => {
        if (!user || !match || !isHost) return;
        setIsProcessing(true);
        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}/balance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ host_id: user.id })
            });

            const data = await response.json();
            if (data.success) {
                fetchMatchDetails();
            } else {
                setErrorMessage(data.error || 'Failed to balance teams');
                setErrorDialogOpen(true);
            }
        } catch (err) {
            setErrorMessage('Network error');
            setErrorDialogOpen(true);
        } finally {
            setIsProcessing(false);
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

        setIsProcessing(true);
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
                setErrorMessage('Match cancelled successfully');
                setErrorDialogOpen(true);
                onBack();
            } else {
                setErrorMessage(data.error || 'Failed to cancel match');
                setErrorDialogOpen(true);
            }
        } catch (err) {
            setErrorMessage('Network error');
            setErrorDialogOpen(true);
        } finally {
            setIsProcessing(false);
        }
    };

    // Kick player from lobby (host only)
    const handleKickPlayer = async (playerId: string) => {
        if (!user || !match || !isHost) return;

        if (!confirm(`Are you sure you want to kick this player from the lobby?`)) {
            return;
        }

        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}/kick`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    player_id: playerId,
                    host_id: user.id
                })
            });

            const data = await response.json();

            if (data.success) {
                // Refresh match details to update UI
                fetchMatchDetails();
            } else {
                setErrorMessage(data.error || 'Failed to kick player');
                setErrorDialogOpen(true);
            }
        } catch (err) {
            setErrorMessage('Network error');
            setErrorDialogOpen(true);
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
                setErrorMessage(`Invitation sent to ${friend.username || friend.nickname}!`);
                setErrorDialogOpen(true);
                setShowInviteModal(false);
            } else {
                setErrorMessage(data.error || 'Failed to send invitation');
                setErrorDialogOpen(true);
            }
        } catch (err) {
            setErrorMessage('Network error');
            setErrorDialogOpen(true);
        }
    };

    // Finish match directly (for casual)
    const handleFinishMatch = async () => {
        if (!user || !match) return;

        if (!window.confirm('Are you sure you want to end this casual match?')) return;

        setIsProcessing(true);
        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host_id: user.id,
                    status: 'completed'
                })
            });

            const data = await response.json();
            if (data.success) {
                setErrorMessage('Match ended successfully!');
                setErrorDialogOpen(true);
                fetchMatchDetails();
            } else {
                setErrorMessage(data.error || 'Failed to end match');
                setErrorDialogOpen(true);
            }
        } catch (err) {
            setErrorMessage('Network error');
            setErrorDialogOpen(true);
        } finally {
            setIsProcessing(false);
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
                    setErrorMessage('Failed to upload screenshot: ' + uploadData.error);
                    setErrorDialogOpen(true);
                    setSubmittingResult(false);
                    return;
                }
                screenshotUrl = uploadData.url;
            } else if (!screenshotUrl) {
                setErrorMessage('Please upload a screenshot or provide a URL');
                setErrorDialogOpen(true);
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
                setErrorMessage('Result submitted! Waiting for moderator review.');
                setErrorDialogOpen(true);
                fetchMatchDetails();
            } else {
                setErrorMessage(data.error || 'Failed to submit result');
                setErrorDialogOpen(true);
            }
        } catch (err) {
            setErrorMessage('Network error');
            setErrorDialogOpen(true);
        } finally {
            setSubmittingResult(false);
        }
    };

    // Update match link (host only)
    const handleUpdateLink = async () => {
        if (!user || !match || !newLobbyUrl.trim()) return;
        setUpdatingLink(true);

        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}/link`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host_id: user.id,
                    lobby_url: newLobbyUrl.trim()
                })
            });

            const data = await response.json();
            if (data.success) {
                setIsEditingLink(false);
                fetchMatchDetails();
            } else {
                setErrorMessage(data.error || 'Failed to update link');
                setErrorDialogOpen(true);
            }
        } catch (err) {
            setErrorMessage('Network error');
            setErrorDialogOpen(true);
        } finally {
            setUpdatingLink(false);
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
    const isStaff = isHost || user?.role === 'moderator' || user?.role === 'admin';
    const isInMatch = players.some(p => p.player_id === user?.id);
    const alphaPlayers = players.filter(p => p.team === 'alpha');
    const bravoPlayers = players.filter(p => p.team === 'bravo');

    // Get team leader (first player) or use locked name if game started
    const alphaLeader = alphaPlayers[0];
    const bravoLeader = bravoPlayers[0];

    const getAlphaTeamName = () => {
        if (match?.status === 'in_progress' && lockedTeamNames.alpha) {
            return lockedTeamNames.alpha;
        }
        return alphaLeader
            ? (alphaLeader.standoff_nickname || alphaLeader.discord_username || 'Team Alpha')
            : 'Team Alpha';
    };

    const getBravoTeamName = () => {
        if (match?.status === 'in_progress' && lockedTeamNames.bravo) {
            return lockedTeamNames.bravo;
        }
        return bravoLeader
            ? (bravoLeader.standoff_nickname || bravoLeader.discord_username || 'Team Bravo')
            : 'Team Bravo';
    };

    const alphaTeamName = getAlphaTeamName();
    const bravoTeamName = getBravoTeamName();

    return (
        <div className="space-y-6 container mx-auto max-w-7xl animate-fade-in pb-12">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/50 pb-6">
                <div className="flex items-center gap-4">
                    <Button
                        onClick={onBack}
                        variant="ghost"
                        size="icon"
                        className="rounded-full hover:bg-muted"
                        title={previousProfileUserId ? "Back to profile" : "Back"}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-lg md:text-2xl font-bold font-display uppercase tracking-wider flex items-center gap-2 md:gap-3">
                            Lobby #{match.id?.slice(0, 8) || 'Unknown'}
                            <Badge
                                variant={match.status === 'in_progress' ? 'secondary' : 'outline'}
                                className={`${match.status === 'in_progress' ? 'animate-pulse' : ''} uppercase tracking-widest text-[9px] md:text-[10px]`}
                            >
                                {match.status?.replace('_', ' ') || 'WAITING'}
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
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                        {isEditingLink ? (
                            <div className="flex items-center gap-2 bg-zinc-800 p-1 rounded-lg border border-white/10 w-full sm:w-80">
                                <Input
                                    value={newLobbyUrl}
                                    onChange={(e) => setNewLobbyUrl(e.target.value)}
                                    placeholder="standoff2://lobby/..."
                                    className="h-9 text-xs bg-transparent border-0 focus-visible:ring-0 text-white font-mono"
                                    autoFocus
                                />
                                <div className="flex items-center gap-1 pr-1">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-green-500 hover:bg-green-500/10"
                                        onClick={handleUpdateLink}
                                        disabled={updatingLink}
                                    >
                                        {updatingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                                        onClick={() => {
                                            setIsEditingLink(false);
                                            setNewLobbyUrl(match.lobby_url || '');
                                        }}
                                        disabled={updatingLink}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 w-full">
                                <Button
                                    onClick={() => window.open(match.lobby_url, '_blank')}
                                    className="flex-1 sm:w-auto font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    <ExternalLink className="mr-2 h-4 w-4" /> Open Standoff 2
                                </Button>
                                {isStaff && match.status === 'waiting' && (
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-10 w-10 border-white/10 bg-white/5 hover:bg-white/10 text-white flex-shrink-0"
                                        onClick={() => setIsEditingLink(true)}
                                        title="Edit Match Link"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Teams Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-9 gap-6 items-start lg:max-w-7xl lg:mx-auto">
                {/* Alpha Team */}
                <div className="lg:col-span-4 space-y-3">
                    <div className="flex items-center justify-between px-4 lg:px-5 py-3 lg:py-4 bg-[#23252a] rounded-lg border-l-4 border-[#5b9bd5]">
                        <div className="flex items-center gap-2 lg:gap-3">
                            <div className="w-2 h-2 lg:w-3 lg:h-3 rounded-full bg-[#5b9bd5] animate-pulse"></div>
                            <div className="flex flex-col">
                                <h2 className="text-sm lg:text-base font-bold uppercase tracking-wider text-[#5b9bd5] truncate max-w-[200px]">
                                    {alphaTeamName}
                                </h2>
                                <span className="text-[10px] text-white/40 uppercase font-bold tracking-tighter">Avg Elo: {match.alpha_avg_elo || 1000}</span>
                            </div>
                        </div>
                        <Badge variant="secondary" className="bg-[#5b9bd5]/20 text-[#5b9bd5] font-mono text-xs lg:text-sm">
                            {alphaPlayers.length}/5
                        </Badge>
                    </div>

                    <div className="space-y-2 lg:space-y-3">
                        {alphaPlayers.map(player => (
                            <div key={player.player_id} className="bg-[#1c1e22] hover:bg-[#23252a] transition-all duration-200 rounded-lg border border-[#5b9bd5]/20 p-3 lg:p-4 group relative">
                                {isHost && player.player_id !== user?.id && (
                                    <button
                                        onClick={() => handleKickPlayer(player.player_id)}
                                        className="absolute top-2 right-2 p-1.5 rounded-md bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 transition-colors z-10"
                                        title="Kick player"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                                <div className="flex items-center gap-3 lg:gap-4">
                                    <Avatar className="h-11 w-11 lg:h-14 lg:w-14 border-2 border-[#5b9bd5]/30 group-hover:border-[#5b9bd5]/60 transition-colors">
                                        <AvatarImage src={`https://cdn.discordapp.com/avatars/${player.player_id}/${player.discord_avatar}.png`} />
                                        <AvatarFallback className="bg-[#5b9bd5]/20 text-[#5b9bd5]"><User className="h-5 w-5 lg:h-6 lg:w-6" /></AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <span className="font-semibold text-white truncate text-sm lg:text-base">
                                                    {player.standoff_nickname || player.discord_username || 'Player'}
                                                </span>
                                                {player.role === 'admin' && <Badge className="text-[9px] lg:text-[10px] px-1.5 py-0 bg-[#ff5500] text-white border-0 font-bold">ADMIN</Badge>}
                                                {player.role === 'moderator' && <Badge className="text-[9px] lg:text-[10px] px-1.5 py-0 bg-[#5b9bd5] text-white border-0 font-bold">MOD</Badge>}
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <LevelBadge elo={player.elo || 1000} showElo={true} className="gap-1" />
                                            </div>
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
                        <div className="flex items-center gap-2 lg:gap-3 lg:flex-row-reverse text-right">
                            <div className="w-2 h-2 lg:w-3 lg:h-3 rounded-full bg-[#e74c3c] animate-pulse"></div>
                            <div className="flex flex-col items-end">
                                <h2 className="text-sm lg:text-base font-bold uppercase tracking-wider text-[#e74c3c] truncate max-w-[200px]">
                                    {bravoTeamName}
                                </h2>
                                <span className="text-[10px] text-white/40 uppercase font-bold tracking-tighter">Avg Elo: {match.bravo_avg_elo || 1000}</span>
                            </div>
                        </div>
                        <Badge variant="secondary" className="bg-[#e74c3c]/20 text-[#e74c3c] font-mono text-xs lg:text-sm">
                            {bravoPlayers.length}/5
                        </Badge>
                    </div>

                    <div className="space-y-2 lg:space-y-3">
                        {bravoPlayers.map(player => (
                            <div key={player.player_id} className="bg-[#1c1e22] hover:bg-[#23252a] transition-all duration-200 rounded-lg border border-[#e74c3c]/20 p-3 lg:p-4 group relative">
                                {isHost && player.player_id !== user?.id && (
                                    <button
                                        onClick={() => handleKickPlayer(player.player_id)}
                                        className="absolute top-2 right-2 p-1.5 rounded-md bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 transition-colors z-10"
                                        title="Kick player"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                                <div className="flex items-center gap-3 lg:gap-4">
                                    <Avatar className="h-11 w-11 lg:h-14 lg:w-14 border-2 border-[#e74c3c]/30 group-hover:border-[#e74c3c]/60 transition-colors">
                                        <AvatarImage src={`https://cdn.discordapp.com/avatars/${player.player_id}/${player.discord_avatar}.png`} />
                                        <AvatarFallback className="bg-[#e74c3c]/20 text-[#e74c3c]"><User className="h-5 w-5 lg:h-6 lg:w-6" /></AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <span className="font-semibold text-white truncate text-sm lg:text-base">
                                                    {player.standoff_nickname || player.discord_username || 'Player'}
                                                </span>
                                                {player.role === 'admin' && <Badge className="text-[9px] lg:text-[10px] px-1.5 py-0 bg-[#ff5500] text-white border-0 font-bold">ADMIN</Badge>}
                                                {player.role === 'moderator' && <Badge className="text-[9px] lg:text-[10px] px-1.5 py-0 bg-[#e74c3c] text-white border-0 font-bold">MOD</Badge>}
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <LevelBadge elo={player.elo || 1000} showElo={true} className="gap-1" />
                                            </div>
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
                <div className="mt-6 -mx-4 md:-mx-8 lg:col-span-9 lg:mx-0">
                    <Card className="border border-border bg-card shadow-lg w-full">
                        <div className="p-4 lg:p-6 w-full">
                            {match.status === 'waiting' && (
                                <div className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
                                    {/* Left Side: Primary Actions */}
                                    <div className="flex flex-col sm:flex-row gap-2 md:gap-4 flex-1 min-w-0">
                                        {isHost && players.length > 2 && (
                                            <Button
                                                variant="outline"
                                                onClick={handleBalanceTeams}
                                                disabled={isProcessing}
                                                className="flex-shrink-0 h-12 md:h-11 border-white/10 hover:bg-white/5 text-xs font-bold uppercase"
                                            >
                                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                                                Balance Teams
                                            </Button>
                                        )}
                                        {/* Start Match Button - Host Only */}
                                        {isHost && (
                                            <Button
                                                onClick={handleStartMatch}
                                                disabled={players.length < 2 || isProcessing}
                                                className="flex-shrink-0 h-12 md:h-11 px-4 md:px-6 lg:px-8 bg-[#ff5500] hover:bg-[#e64d00] text-white font-bold shadow-lg uppercase tracking-wide transition-all text-sm whitespace-nowrap active:scale-95"
                                            >
                                                {isProcessing ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Play className="mr-2 h-4 w-4 fill-current" />
                                                )}
                                                Start Match ({players.length}/10)
                                            </Button>
                                        )}

                                        {/* Invite Friends Button */}
                                        {isInMatch && (
                                            <Button
                                                onClick={() => setShowInviteModal(true)}
                                                className="flex-shrink-0 h-12 md:h-11 px-4 md:px-6 lg:px-8 bg-[#5b9bd5] hover:bg-[#4a8ac0] text-white font-bold shadow-md uppercase tracking-wide text-sm whitespace-nowrap"
                                            >
                                                <UserPlus className="mr-2 h-4 w-4" /> Invite Friends
                                            </Button>
                                        )}
                                    </div>

                                    {/* Right Side: Secondary Actions */}
                                    <div className="flex flex-col sm:flex-row gap-3 md:gap-4 flex-shrink-0">
                                        {/* Join Match Button for Non-Participants */}
                                        {!isInMatch && match.status === 'waiting' && (
                                            <Button
                                                onClick={handleJoinLobby}
                                                disabled={players.length >= match.max_players || isProcessing}
                                                className="flex-shrink-0 h-12 md:h-11 px-4 md:px-6 bg-green-600 hover:bg-green-700 text-white font-bold shadow-md uppercase tracking-wide text-sm whitespace-nowrap active:scale-95"
                                            >
                                                {isProcessing ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <UserPlus className="mr-2 h-4 w-4" />
                                                )}
                                                {players.length >= match.max_players ? 'Full Lobby' : 'Join Match'}
                                            </Button>
                                        )}

                                        {/* Switch Team & Leave Buttons */}
                                        {isInMatch && (
                                            <>
                                                <Button
                                                    onClick={handleSwitchTeam}
                                                    disabled={isProcessing}
                                                    className="flex-shrink-0 h-12 md:h-11 px-4 md:px-6 bg-[#18181b] hover:bg-[#27272a] text-white border border-white/5 font-semibold text-sm whitespace-nowrap active:scale-95"
                                                >
                                                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                                                    Switch Team
                                                </Button>

                                                <Button
                                                    onClick={handleLeaveLobby}
                                                    variant="outline"
                                                    disabled={isProcessing}
                                                    className="flex-shrink-0 h-12 md:h-11 px-4 md:px-6 border-white/10 text-muted-foreground hover:text-white hover:bg-white/5 font-semibold text-sm bg-transparent whitespace-nowrap active:scale-95"
                                                >
                                                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                                                    Leave
                                                </Button>
                                            </>
                                        )}

                                        {/* Cancel Button - Staff Only */}
                                        {isStaff && (
                                            <>
                                                {/* Mobile Cancel Button */}
                                                <Button
                                                    onClick={handleCancelMatch}
                                                    disabled={isProcessing}
                                                    variant="ghost"
                                                    className="sm:hidden h-12 text-sm text-red-500 bg-red-500/20 hover:text-red-400 hover:bg-red-500/30"
                                                >
                                                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />} Cancel Match
                                                </Button>
                                                {/* Desktop Cancel Button */}
                                                <Button
                                                    onClick={handleCancelMatch}
                                                    disabled={isProcessing}
                                                    className="hidden sm:flex h-12 md:h-11 px-4 md:px-6 bg-[#ff002b] hover:bg-[#d60024] text-white border-none shadow-lg rounded-md whitespace-nowrap active:scale-95"
                                                    title="Cancel Match"
                                                >
                                                    {isProcessing ? (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <ShieldAlert className="h-4 w-4 mr-2" />
                                                    )}
                                                    Cancel Match
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {match.status === 'in_progress' && isStaff && (
                                <div className="w-full flex flex-col md:flex-row items-center gap-4">
                                    <div className="flex-1 w-full p-4 bg-muted/30 rounded-lg border border-border/50">
                                        {match.match_type === 'league' ? (
                                            <>
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
                                                            <span className="font-bold">{alphaTeamName}</span>
                                                        </Button>
                                                        <Button
                                                            onClick={() => setWinnerTeam('bravo')}
                                                            variant={winnerTeam === 'bravo' ? 'default' : 'outline'}
                                                            className={`h-24 flex flex-col items-center justify-center gap-2 border-2 ${winnerTeam === 'bravo' ? 'border-blue-500 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20' : 'hover:bg-muted'}`}
                                                        >
                                                            <span className="text-2xl">🦈</span>
                                                            <span className="font-bold">{bravoTeamName}</span>
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
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-6 gap-4">
                                                <div className="bg-primary/10 p-4 rounded-full">
                                                    <Gamepad2 className="h-8 w-8 text-primary" />
                                                </div>
                                                <div className="text-center">
                                                    <h3 className="text-lg font-bold">Casual Match in Progress</h3>
                                                    <p className="text-muted-foreground text-sm max-w-xs">Casual matches do not requiring result submission or moderator review.</p>
                                                </div>
                                                <div className="flex gap-3">
                                                    <Button
                                                        variant="outline"
                                                        onClick={handleCancelMatch}
                                                        disabled={isProcessing}
                                                        className="border-destructive/50 text-destructive hover:bg-destructive hover:text-white active:scale-95"
                                                    >
                                                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />} Cancel
                                                    </Button>
                                                    <Button onClick={handleFinishMatch} disabled={isProcessing} className="bg-green-600 hover:bg-green-700 font-bold px-8 active:scale-95">
                                                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} FINISH MATCH
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {match.status === 'in_progress' && isHost && (
                                <div className="w-full flex flex-col md:flex-row items-center gap-4">
                                    <div className="flex-1 w-full p-4 bg-muted/30 rounded-lg border border-border/50">
                                        {match.match_type === 'league' ? (
                                            <>
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
                                                            <span className="font-bold">{alphaTeamName}</span>
                                                        </Button>
                                                        <Button
                                                            onClick={() => setWinnerTeam('bravo')}
                                                            variant={winnerTeam === 'bravo' ? 'default' : 'outline'}
                                                            className={`h-24 flex flex-col items-center justify-center gap-2 border-2 ${winnerTeam === 'bravo' ? 'border-blue-500 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20' : 'hover:bg-muted'}`}
                                                        >
                                                            <span className="text-2xl">🦈</span>
                                                            <span className="font-bold">{bravoTeamName}</span>
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
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-6 gap-4">
                                                <div className="bg-primary/10 p-4 rounded-full">
                                                    <Gamepad2 className="h-8 w-8 text-primary" />
                                                </div>
                                                <div className="text-center">
                                                    <h3 className="text-lg font-bold">Casual Match in Progress</h3>
                                                    <p className="text-muted-foreground text-sm max-w-xs">Casual matches do not requiring result submission or moderator review.</p>
                                                </div>
                                                <div className="flex gap-3">
                                                    <Button
                                                        variant="outline"
                                                        onClick={handleCancelMatch}
                                                        disabled={isProcessing}
                                                        className="border-destructive/50 text-destructive hover:bg-destructive hover:text-white active:scale-95"
                                                    >
                                                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />} Cancel
                                                    </Button>
                                                    <Button onClick={handleFinishMatch} disabled={isProcessing} className="bg-green-600 hover:bg-green-700 font-bold px-8 active:scale-95">
                                                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} FINISH MATCH
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
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

                    {/* Lobby Chat */}
                    <div className="mt-6">
                        <Chat lobbyId={matchId} variant="inline" title="Лобби Чаат" />
                    </div>
                </div>
            </div>
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

export default LobbyDetailPage;
