import React, { useState, useEffect, memo, useMemo, useRef, useCallback, useTransition, Suspense, lazy } from 'react';
import { useWebSocket } from './WebSocketContext';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
    ShieldAlert,
    Bot
} from "lucide-react";
import LevelBadge from './LevelBadge';
import Chat from './Chat';
const InviteFriendModal = lazy(() => import('./InviteFriendModal'));
const VoiceChat = lazy(() => import('./VoiceChat'));
import VirtualPlayerList from './VirtualPlayerList';
import LobbyWorker from '../workers/lobby.worker?worker';
import { DraftPhase } from './DraftPhase';
import { CompetitiveLobbyWaiting } from './CompetitiveLobbyWaiting';


export interface MatchPlayer {
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
    draftState?: any;
    captain_alpha_id?: string;
    captain_bravo_id?: string;
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

// Custom equality check for PlayerCard to prevent re-renders on new object references
const arePlayerPropsEqual = (prevProps: any, nextProps: any) => {
    return (
        prevProps.player.player_id === nextProps.player.player_id &&
        prevProps.player.team === nextProps.player.team &&
        prevProps.player.elo === nextProps.player.elo &&
        prevProps.player.role === nextProps.player.role &&
        prevProps.player.is_vip === nextProps.player.is_vip &&
        prevProps.player.standoff_nickname === nextProps.player.standoff_nickname &&
        prevProps.player.discord_username === nextProps.player.discord_username &&
        prevProps.player.discord_avatar === nextProps.player.discord_avatar &&
        prevProps.teamColor === nextProps.teamColor &&
        prevProps.isHost === nextProps.isHost &&
        prevProps.currentUserId === nextProps.currentUserId &&
        prevProps.onKick === nextProps.onKick
    );
};

const PlayerCard = memo(({
    player,
    teamColor,
    isHost,
    currentUserId,
    onKick
}: {
    player: MatchPlayer;
    teamColor: string;
    isHost: boolean;
    currentUserId?: string;
    onKick: (playerId: string) => void;
}) => {
    return (
        <div className={`bg-[#1c1e22] hover:bg-[#23252a] transition-all duration-200 rounded-lg border border-[${teamColor}]/20 p-3 lg:p-4 group relative`}>
            {isHost && player.player_id !== currentUserId && (
                <button
                    onClick={() => onKick(player.player_id)}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-red-500/20 hover:bg-red-500/40 text-red-400 hover:text-red-300 transition-colors z-10"
                    title="Kick player"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
            <div className="flex items-center gap-3 lg:gap-4">
                <Avatar className={`h-11 w-11 lg:h-14 lg:w-14 border-2 border-[${teamColor}]/30 group-hover:border-[${teamColor}]/60 transition-colors`}>
                    <AvatarImage src={`https://cdn.discordapp.com/avatars/${player.player_id}/${player.discord_avatar}.png`} />
                    <AvatarFallback className={`bg-[${teamColor}]/20 text-[${teamColor}]`}><User className="h-5 w-5 lg:h-6 lg:w-6" /></AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="font-semibold text-white truncate text-sm lg:text-base">
                                {player.standoff_nickname || player.discord_username || 'Player'}
                            </span>
                            {player.role === 'admin' && <Badge className="text-[9px] lg:text-[10px] px-1.5 py-0 bg-[#ff5500] text-white border-0 font-bold">ADMIN</Badge>}
                            {player.role === 'moderator' && <Badge className={`text-[9px] lg:text-[10px] px-1.5 py-0 bg-[${teamColor}] text-white border-0 font-bold`}>MOD</Badge>}
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
    );
}, arePlayerPropsEqual);

// Helper to map MatchPlayer to DraftPhase QueuePlayer (Moved outside for stability)
const mapToQueuePlayer = (p: MatchPlayer | undefined) => {
    if (!p) return { id: 'waiting', username: 'Waiting...', avatar: null };
    const avatarUrl = p.discord_avatar
        ? `https://cdn.discordapp.com/avatars/${p.player_id}/${p.discord_avatar}.png`
        : null;

    return {
        ...p,
        id: p.player_id,
        username: p.standoff_nickname || p.discord_username || 'Unknown', // Fallback
        avatar: avatarUrl,
        discord_avatar: p.discord_avatar
    };
};

const LobbyDetailPage: React.FC<LobbyDetailPageProps> = ({ matchId, user, backendUrl, onBack, previousProfileUserId }) => {
    // Atomic selectors to prevent unnecessary re-renders
    const sendMessage = useWebSocket(state => state.sendMessage);
    // const lastMessage = useWebSocket(state => state.lastMessage); // <-- REMOVED to prevent re-renders

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

    const [, startTransition] = useTransition();

    // State for sorted players (processed by Web Worker)
    const [alphaPlayers, setAlphaPlayers] = useState<MatchPlayer[]>([]);
    const [bravoPlayers, setBravoPlayers] = useState<MatchPlayer[]>([]);
    const workerRef = useRef<Worker | null>(null);

    // Initialize Worker
    useEffect(() => {
        workerRef.current = new LobbyWorker();

        workerRef.current.onmessage = (e) => {
            const { alpha, bravo } = e.data;
            startTransition(() => {
                setAlphaPlayers(alpha);
                setBravoPlayers(bravo);
            });
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    // Send updates to Worker (SKIP during drafting - teams managed by draft state)
    useEffect(() => {
        // During drafting, teams are managed by DRAFT_START/DRAFT_UPDATE, not DB data
        if (match?.status === 'drafting') {
            return; // Don't override draft teams
        }

        if (workerRef.current && players.length > 0) {
            workerRef.current.postMessage({ players });
        } else if (players.length === 0) {
            startTransition(() => { // Also wrap clear
                setAlphaPlayers([]);
                setBravoPlayers([]);
            });
        }
    }, [players, match?.status]);

    // Memoize derived state (simple boolean checks remain on main thread for speed)
    const isHost = useMemo(() => user?.id === match?.host_id, [user?.id, match?.host_id]);
    const isStaff = useMemo(() => isHost || user?.role === 'moderator' || user?.role === 'admin', [isHost, user?.role]);
    const isCaptain = useMemo(() => {
        if (!user || !match) return false;
        return user.id === match.captain_alpha_id || user.id === match.captain_bravo_id;
    }, [user?.id, match?.captain_alpha_id, match?.captain_bravo_id]);
    const isInMatch = useMemo(() => players.some(p => p.player_id === user?.id), [players, user?.id]);

    // Get team leader (first player) or use locked name if game started
    const alphaLeader = alphaPlayers[0];
    const bravoLeader = bravoPlayers[0];

    // Memoize helper functions if they are used in render/effects
    const getAlphaTeamName = useCallback(() => {
        if (match?.status === 'in_progress' && lockedTeamNames.alpha) {
            return lockedTeamNames.alpha;
        }
        return alphaLeader
            ? (alphaLeader.standoff_nickname || alphaLeader.discord_username || 'Team Alpha')
            : 'Team Alpha';
    }, [match?.status, lockedTeamNames.alpha, alphaLeader]);

    const getBravoTeamName = useCallback(() => {
        if (match?.status === 'in_progress' && lockedTeamNames.bravo) {
            return lockedTeamNames.bravo;
        }
        return bravoLeader
            ? (bravoLeader.standoff_nickname || bravoLeader.discord_username || 'Team Bravo')
            : 'Team Bravo';
    }, [match?.status, lockedTeamNames.bravo, bravoLeader]);

    const alphaTeamName = getAlphaTeamName();
    const bravoTeamName = getBravoTeamName();

    // Fetch match details - MEMOIZED
    const fetchMatchDetails = useCallback(async () => {
        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}`);
            const data = await response.json();
            if (data.success) {
                const newMatch = data.match;

                setMatch((prev: Match | null) => {
                    // Preserve draftState if present in prev but missing in new, AND status is drafting
                    if (prev?.draftState && !newMatch.draftState && newMatch.status === 'drafting') {
                        return { ...newMatch, draftState: prev.draftState };
                    }
                    return newMatch;
                });

                // FALLBACK: If status is drafting but no draftState, request from DO
                if (newMatch.status === 'drafting' && !newMatch.draftState) {
                    console.log('[LobbyDetailPage] Status is drafting but no draftState, requesting from DO...');
                    sendMessage({ type: 'REQUEST_MATCH_STATE', lobbyId: matchId });
                }

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
    }, [backendUrl, matchId, sendMessage]); // Added sendMessage dependency

    useEffect(() => {
        fetchMatchDetails();
        // Removed 5s polling interval - now purely push-based via WebSockets
    }, [fetchMatchDetails]);

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
    }, [match?.status, players, lockedTeamNames.alpha, lockedTeamNames.bravo]); // Added dependencies

    // Debounced fetch ref for fallback scenarios
    const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastUpdateRef = useRef<number>(0);

    // Handle WebSocket updates - TRANSIENT SUBSCRIPTION
    useEffect(() => {
        // Track previous message to detect changes
        let prevLastMessage = useWebSocket.getState().lastMessage;

        const unsub = useWebSocket.subscribe((state) => {
            const currentLastMessage = state.lastMessage;

            if (currentLastMessage !== prevLastMessage) {
                prevLastMessage = currentLastMessage;
                const msg = currentLastMessage;

                if (msg) {
                    // HANDLE DRAFT START
                    if (msg.type === 'DRAFT_START' && msg.lobbyId === matchId) {
                        setMatch(prev => prev ? ({
                            ...prev,
                            status: 'drafting',
                            draftState: msg.draftState,
                            captain_alpha_id: msg.captainAlphaId,
                            captain_bravo_id: msg.captainBravoId
                        }) : null);
                        if (msg.captainA) setAlphaPlayers([msg.captainA]);
                        if (msg.captainB) setBravoPlayers([msg.captainB]);
                        // Immediate Draft Start (No Reveal)
                        return;
                    }


                    // HANDLE DRAFT UPDATE (Picks)
                    if (msg.type === 'DRAFT_UPDATE' && msg.matchId === matchId) {
                        setMatch(prev => prev ? ({
                            ...prev,
                            draftState: msg.draftState
                        }) : null);
                        // Update teams if included
                        if (msg.teamA) setAlphaPlayers(msg.teamA);
                        if (msg.teamB) setBravoPlayers(msg.teamB);
                        return;
                    }

                    // HANDLE GENERIC LOBBY UPDATE
                    if (msg.type === 'LOBBY_UPDATED' && msg.matchId === matchId) {
                        const now = Date.now();

                        // Immediate Status Update if present
                        if (msg.status) {
                            setMatch(prev => prev ? ({ ...prev, status: msg.status }) : null);
                        }

                        // Immediate Draft State Update if present
                        if (msg.draftState) {
                            setMatch(prev => prev ? ({ ...prev, draftState: msg.draftState }) : null);
                        }

                        // If we have players data in the message, update state directly (faster)
                        if (msg.players && Array.isArray(msg.players)) {
                            // Must wrap in setPlayers to ensure React batching, but it's triggered by event
                            setPlayers(msg.players);
                            lastUpdateRef.current = now;
                            return;
                        }

                        // Debounce HTTP fallback
                        if (fetchTimeoutRef.current) {
                            clearTimeout(fetchTimeoutRef.current);
                        }

                        // Only fetch if more than 200ms since last update
                        const timeSinceLastUpdate = now - lastUpdateRef.current;
                        const delay = timeSinceLastUpdate < 200 ? 300 : 0;

                        fetchTimeoutRef.current = setTimeout(() => {
                            fetchMatchDetails();
                            lastUpdateRef.current = Date.now();
                        }, delay);
                    }

                    // HANDLE LOBBY_UPDATE (Response from REQUEST_MATCH_STATE or after picks)
                    if (msg.type === 'LOBBY_UPDATE' && msg.lobby?.id === matchId) {
                        console.log('[LobbyDetailPage] Received LOBBY_UPDATE with lobby state');
                        if (msg.lobby.draftState) {
                            setMatch(prev => prev ? ({
                                ...prev,
                                draftState: msg.lobby.draftState,
                                status: msg.lobby.status || prev.status
                            }) : null);
                        }
                        // Update team arrays from lobby (for draft picks)
                        if (msg.lobby.teamA && msg.lobby.teamA.length > 0) {
                            setAlphaPlayers(msg.lobby.teamA);
                        }
                        if (msg.lobby.teamB && msg.lobby.teamB.length > 0) {
                            setBravoPlayers(msg.lobby.teamB);
                        }
                    }
                }
            }
        });

        return () => {
            unsub();
            if (fetchTimeoutRef.current) {
                clearTimeout(fetchTimeoutRef.current);
            }
        };
    }, [matchId, fetchMatchDetails]);

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

    // Fill with bots (host/admin only - for testing)
    const handleFillBots = async () => {
        if (!user || !match) return;
        if (!window.confirm('Fill remaining slots with test bots? This will also auto-start the match for competitive/league.')) return;

        setIsProcessing(true);
        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}/fill-bots`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ host_id: user.id })
            });

            const data = await response.json();
            if (data.success) {
                fetchMatchDetails();
            } else {
                setErrorMessage(data.error || 'Failed to fill bots');
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

    // Keep ref to players for stable rollback in optimistic updates
    const playersRef = useRef<MatchPlayer[]>(players);
    useEffect(() => {
        playersRef.current = players;
    }, [players]);

    const handleKickPlayer = useCallback(async (playerId: string) => {
        if (!isHost && user?.role !== 'moderator' && user?.role !== 'admin') return;

        // Snapshot for rollback
        const previousPlayers = playersRef.current;

        // Optimistic Update: Remove player immediately
        startTransition(() => {
            setPlayers(prev => prev.filter(p => p.player_id !== playerId));
        });
        toast.info("Kicking player...", { duration: 1000 });

        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}/kick`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user?.id, kickedId: playerId })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                toast.success('Player kicked successfully');
                // No need to create another log, backend/websocket handles generic update
            } else {
                throw new Error(data.error || 'Failed to kick player');
            }
        } catch (err) {
            // Rollback on error
            startTransition(() => {
                setPlayers(previousPlayers);
            });
            toast.error(err instanceof Error ? err.message : 'Network error');
        }
    }, [isHost, user, matchId, backendUrl]);

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

    // Draft Pick Handler - MEMOIZED
    const handleDraftPick = useCallback((playerId: string) => {
        console.log('[LobbyDetailPage] Picking player:', playerId);
        if (!sendMessage || !matchId) {
            console.error('[LobbyDetailPage] Cannot pick: No socket or matchId');
            return;
        }
        sendMessage({
            type: 'DRAFT_PICK',
            lobbyId: matchId,
            pickedPlayerId: playerId
        });
    }, [sendMessage, matchId]);

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

    // Memoize Draft Props to guarantee reference stability (Moved to top level)
    const captainA = useMemo(() => {
        if (!match?.draftState) return mapToQueuePlayer(alphaPlayers[0]);
        if (match.captain_alpha_id) {
            return match.draftState.pool.find((p: any) => p.id === match.captain_alpha_id) || mapToQueuePlayer(alphaPlayers[0]);
        }
        return mapToQueuePlayer(alphaPlayers[0]);
    }, [match?.draftState?.pool, match?.captain_alpha_id, alphaPlayers]);

    const captainB = useMemo(() => {
        if (!match?.draftState) return mapToQueuePlayer(bravoPlayers[0]);
        if (match.captain_bravo_id) {
            return match.draftState.pool.find((p: any) => p.id === match.captain_bravo_id) || mapToQueuePlayer(bravoPlayers[0]);
        }
        return mapToQueuePlayer(bravoPlayers[0]);
    }, [match?.draftState?.pool, match?.captain_bravo_id, bravoPlayers]);

    const draftTeamA = useMemo(() => alphaPlayers.map(mapToQueuePlayer), [alphaPlayers]);
    const draftTeamB = useMemo(() => bravoPlayers.map(mapToQueuePlayer), [bravoPlayers]);



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
                                {isStaff && ['waiting', 'drafting', 'in_progress'].includes(match.status || '') && (
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

            {/* Draft Phase - Primary View if State Exists */}
            {(match.draftState && match.status === 'drafting') ? (
                <DraftPhase
                    pool={match.draftState.pool}
                    captainA={captainA}
                    captainB={captainB}
                    teamA={draftTeamA}
                    teamB={draftTeamB}
                    currentTurn={match.draftState.currentTurn}
                    currentUserId={user?.id || ''}
                    timeLeft={Math.max(0, Math.floor((match.draftState.draftTimeout - Date.now()) / 1000))}
                    onPick={(player) => handleDraftPick(player.id || player.player_id || '')}
                    onTimeout={() => {
                        // Force PING backend if timer hits 0 locally
                        console.log("⏰ Local timer 0s. Pinging backend...");
                        sendMessage({
                            type: 'REQUEST_MATCH_STATE',
                            lobbyId: matchId
                        });
                    }}
                />
            ) : (match.status === 'drafting' && !match.draftState) ? (
                <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                    <h3 className="text-xl font-bold animate-pulse">Recovering Draft State...</h3>
                    <p className="text-muted-foreground">Syncing with server, please wait...</p>
                </div>
            ) : match.status === 'waiting' && (match.match_type === 'competitive' || match.match_type === 'league') ? (
                /* Competitive/League Waiting - Different UI */
                <CompetitiveLobbyWaiting
                    players={players}
                    maxPlayers={match.max_players || 10}
                    mapName={match.map_name}
                    matchType={match.match_type as 'competitive' | 'league'}
                />
            ) : (
                /* Teams Grid - Casual/Clan War UI */
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

                        <VirtualPlayerList
                            players={alphaPlayers}
                            teamColor="#5b9bd5"
                            isHost={isHost || isStaff}
                            currentUserId={user?.id}
                            onKick={handleKickPlayer}
                            PlayerCardComponent={PlayerCard}
                            minHeight={Math.min(500, alphaPlayers.length * 100 + 100)}
                            emptyMessage="Waiting for player..."
                        />
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

                        <VirtualPlayerList
                            players={bravoPlayers}
                            teamColor="#e74c3c"
                            isHost={isHost || isStaff}
                            currentUserId={user?.id}
                            onKick={handleKickPlayer}
                            PlayerCardComponent={PlayerCard}
                            minHeight={Math.min(500, bravoPlayers.length * 100 + 100)}
                            emptyMessage="Waiting for player..."
                        />
                    </div>
                </div> /* End Teams Grid */
            )}

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
                                    {(isStaff || isHost) && (match.status === 'waiting' || match.status === 'drafting') && (
                                        <>
                                            <Button
                                                onClick={handleFillBots}
                                                disabled={isProcessing}
                                                variant="outline"
                                                className="hidden md:flex h-11 px-4 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400 font-semibold"
                                                title="Fill with Bots (Testing)"
                                            >
                                                <Bot className="mr-2 h-4 w-4" /> Fill Bots
                                            </Button>

                                            <Button
                                                onClick={handleCancelMatch}
                                                disabled={isProcessing}
                                                variant="destructive"
                                                className="h-12 md:h-11 px-4 md:px-6 shadow-md"
                                                title="Cancel Match"
                                            >
                                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
                                                <span className="hidden md:inline">Cancel Match</span>
                                                <span className="md:hidden">Cancel</span>
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}



                        {match.status === 'in_progress' && (match.match_type === 'league' || match.match_type === 'competitive') && players && players.length < 10 && (
                            <div className="w-full p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center justify-center gap-3 animate-pulse">
                                <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
                                <span className="text-yellow-500 font-mono text-sm">Syncing match players... ({players.length}/10)</span>
                            </div>
                        )}

                        {match.status === 'in_progress' && (isStaff || isHost || isCaptain) && (
                            <div className="w-full flex flex-col md:flex-row items-center gap-4">
                                <div className="flex-1 w-full p-4 bg-muted/30 rounded-lg border border-border/50">
                                    {match.match_type === 'league' || match.match_type === 'competitive' ? (
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
                <Suspense fallback={null}>
                    {showInviteModal && (
                        <InviteFriendModal
                            isOpen={showInviteModal}
                            currentPartyIds={players.map(p => p.player_id)}
                            onInvite={handleInviteFriend}
                            onClose={() => setShowInviteModal(false)}
                        />
                    )}
                </Suspense>

                {/* Voice Chat Setup */}
                <div className="mt-6">
                    {isInMatch && (
                        <Suspense fallback={<div className="h-12 w-full bg-white/5 rounded-lg animate-pulse" />}>
                            <VoiceChat
                                channelName={`lobby-${matchId}`}
                                uid={user?.id || ""}
                                appId={import.meta.env.VITE_AGORA_APP_ID || ''}
                                players={players}
                                currentUser={user}
                            />
                        </Suspense>
                    )}
                </div>

                {/* Lobby Chat */}
                <div className="mt-6">
                    <Chat lobbyId={matchId} variant="inline" title="Лобби Чаат" />
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
        </div>
    );
};

export default LobbyDetailPage;
