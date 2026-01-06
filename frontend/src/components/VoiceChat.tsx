import { useEffect, useState, useMemo, memo } from "react";
import AgoraRTC, {
    AgoraRTCProvider,
    useJoin,
    useLocalMicrophoneTrack,
    usePublish,
    useRemoteUsers,
    useRemoteAudioTracks,
    useRTCClient,
    type UID
} from "agora-rtc-react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Users, LogOut, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { MatchPlayer } from "./LobbyDetailPage";

interface VoiceChatProps {
    channelName: string;
    uid: string | number;
    appId: string;
    players: MatchPlayer[];
    currentUser?: { id: string; avatar?: string; username?: string } | null;
}

export default function VoiceChat({ channelName, uid, appId, players, currentUser }: VoiceChatProps) {
    const client = useMemo(() => AgoraRTC.createClient({ codec: "vp8", mode: "rtc" }), []);

    return (
        <AgoraRTCProvider client={client}>
            <VoiceRoom channelName={channelName} uid={uid} appId={appId} players={players} currentUser={currentUser} />
        </AgoraRTCProvider>
    );
}

function VoiceRoom({ channelName, uid, appId, players, currentUser }: VoiceChatProps) {
    const client = useRTCClient();
    const [isJoined, setIsJoined] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [volumeMap, setVolumeMap] = useState<Map<UID, number>>(new Map());

    // Fetch Token
    useEffect(() => {
        const fetchToken = async () => {
            if (!channelName || !uid) return;
            try {
                const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://backend.anandoctane4.workers.dev";
                const res = await fetch(`${backendUrl}/api/agora/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channelName, uid })
                });

                if (res.ok) {
                    const data = await res.json();
                    setToken(data.token);
                }
            } catch (err) {
                console.error("Error fetching token:", err);
            }
        };
        fetchToken();
    }, [channelName, uid]);

    // Join hook
    const { isConnected, error: joinError } = useJoin(
        { appid: appId, channel: channelName, token: token, uid: uid },
        isJoined && !!token
    );

    // Log join errors
    useEffect(() => {
        if (joinError) console.error("Agora Join Error:", joinError);
    }, [joinError]);

    // Mic Track
    const { localMicrophoneTrack } = useLocalMicrophoneTrack(isJoined);

    // Mute Logic
    useEffect(() => {
        if (localMicrophoneTrack) {
            localMicrophoneTrack.setMuted(isMuted);
        }
    }, [isMuted, localMicrophoneTrack]);

    // Publish logic
    usePublish([localMicrophoneTrack]);

    // Remote Users
    const remoteUsers = useRemoteUsers();
    const { audioTracks } = useRemoteAudioTracks(remoteUsers);

    // Audio Playback
    useEffect(() => {
        if (!audioTracks) return;
        audioTracks.map((track) => track.play());
    }, [audioTracks]);

    // Volume Indicator
    useEffect(() => {
        if (!client) return;

        client.enableAudioVolumeIndicator();

        const handleVolumeIndicator = (volumes: Array<{ uid: UID; level: number }>) => {
            setVolumeMap(prev => {
                const newMap = new Map(prev);
                volumes.forEach(vol => {
                    const userId = vol.uid === 0 ? uid : vol.uid;
                    newMap.set(userId, vol.level);
                });
                return newMap;
            });
        };

        client.on("volume-indicator", handleVolumeIndicator);
        return () => {
            client.off("volume-indicator", handleVolumeIndicator);
        };
    }, [client, uid]);

    // Helper to find player
    const getPlayerByUid = (uid: string | number) => {
        return players.find(p => String(p.player_id) === String(uid));
    };

    const handleJoinLeave = () => {
        if (isJoined) {
            setIsJoined(false);
            setVolumeMap(new Map());
        } else {
            setIsJoined(true);
            setIsMuted(false);
        }
    };

    return (
        <div className="bg-[#111214] border border-[#1f2128] rounded-xl p-3 flex items-center justify-between gap-4 shadow-xl shadow-black/20">
            <div className="flex items-center gap-3">
                {/* Local User Section */}
                {isJoined ? (
                    <LocalUserStatus
                        isConnected={isConnected}
                        isMuted={isMuted}
                        currentUser={currentUser}
                        volume={volumeMap.get(uid) || 0}
                    />
                ) : (
                    <div className="flex items-center gap-3 px-2">
                        <div className="h-10 w-10 rounded-full bg-[#1e1f22] border border-[#2b2d31] flex items-center justify-center">
                            <Phone className="h-5 w-5 text-zinc-500" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-zinc-300">Voice Chat</span>
                            <span className="text-xs text-zinc-500 flex items-center gap-1">
                                <Users className="h-3 w-3" /> {remoteUsers.length} in channel
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3">
                {/* Remote Users List */}
                <div className="flex -space-x-3 mr-2 px-2">
                    <TooltipProvider delayDuration={0}>
                        {remoteUsers.map(user => (
                            <RemoteUser
                                key={user.uid}
                                user={user}
                                player={getPlayerByUid(user.uid as string)}
                                volume={volumeMap.get(user.uid) || 0}
                            />
                        ))}
                    </TooltipProvider>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 bg-[#1e1f22] p-1 rounded-lg border border-[#2b2d31]">
                    {isJoined && (
                        <Button
                            size="icon"
                            variant="ghost"
                            className={`h-9 w-9 rounded-md transition-all ${isMuted ? 'text-red-500 hover:text-red-400 hover:bg-red-500/10' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}
                            onClick={() => setIsMuted(!isMuted)}
                            title={isMuted ? "Unmute" : "Mute"}
                        >
                            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                        </Button>
                    )}

                    <Button
                        size="sm"
                        className={`h-9 px-4 font-bold transition-all shadow-lg ${isJoined ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-900/20' : 'bg-green-600 hover:bg-green-700 text-white shadow-green-900/20'}`}
                        onClick={handleJoinLeave}
                    >
                        {isJoined ? (
                            <span className="flex items-center gap-2">
                                <LogOut className="h-4 w-4" /> Leave
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <Mic className="h-4 w-4" /> Join Voice
                            </span>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// Memoized Local User Component
const LocalUserStatus = memo(({ isConnected, isMuted, currentUser, volume }: { isConnected: boolean, isMuted: boolean, currentUser: any, volume: number }) => {
    return (
        <div className="flex items-center gap-3 bg-[#1e1f22] p-2 pr-4 rounded-full border border-[#2b2d31]">
            <div className="relative">
                <Avatar className={`h-10 w-10 border-2 transition-all duration-300 ${isMuted ? 'border-red-500/50 grayscale' : 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]'}`}>
                    <AvatarImage src={`https://cdn.discordapp.com/avatars/${currentUser?.id}/${currentUser?.avatar}.png`} />
                    <AvatarFallback className="bg-zinc-800"><Users className="h-4 w-4 text-zinc-400" /></AvatarFallback>
                </Avatar>
                {isMuted && (
                    <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-1 border-2 border-[#1e1f22]">
                        <MicOff className="h-3 w-3 text-white" />
                    </div>
                )}
            </div>

            <div className="flex flex-col">
                <span className="text-sm font-bold text-white leading-none mb-1">You</span>
                <div className="flex items-center gap-2 h-3">
                    {isConnected && <Badge variant="outline" className="text-[9px] h-3.5 px-1 bg-green-500/10 text-green-500 border-green-500/20 leading-none">LIVE</Badge>}
                    {!isMuted && <AudioVisualizer level={volume} />}
                </div>
            </div>
        </div>
    );
});

// Memoized Remote User Component
const RemoteUser = memo(({ user, player, volume }: { user: any, player: MatchPlayer | undefined, volume: number }) => {
    const name = player?.standoff_nickname || player?.discord_username || `User ${user.uid}`;
    const isSpeaking = volume > 20;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="relative group">
                    <Avatar className={`
                        h-9 w-9 border-2 transition-all duration-200 
                        ${isSpeaking ? 'border-green-500 z-20 scale-110 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'border-[#1e1f22] bg-[#1e1f22] z-0 hover:z-10 hover:scale-105'}
                    `}>
                        <AvatarImage src={`https://cdn.discordapp.com/avatars/${player?.player_id}/${player?.discord_avatar}.png`} />
                        <AvatarFallback className="bg-[#1e1f22] text-xs font-bold text-zinc-500">
                            {name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>

                    {/* Mini Visualizer for Remote User */}
                    {isSpeaking && (
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-30">
                            <AudioVisualizer level={volume} small />
                        </div>
                    )}
                </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-[#1e1f22] border-[#2b2d31] text-xs font-bold text-zinc-200 animate-in fade-in zoom-in-95 duration-200">
                {name}
            </TooltipContent>
        </Tooltip>
    );
});


// Shadcn-style Bar Visualizer (Memoized)
const AudioVisualizer = memo(({ level, small = false }: { level: number, small?: boolean }) => {
    // Clamp level 0-100
    const vol = Math.min(100, Math.max(0, level));
    const isSilent = vol < 5;

    return (
        <div className={`flex items-end gap-[2px] ${small ? 'h-3' : 'h-4'}`}>
            <div
                className={`w-1 rounded-full bg-green-500 transition-all duration-75 ease-out`}
                style={{ height: isSilent ? '20%' : `${Math.max(20, vol * 0.8)}%` }}
            />
            <div
                className={`w-1 rounded-full bg-green-500 transition-all duration-75 ease-out delay-[10ms]`}
                style={{ height: isSilent ? '20%' : `${Math.max(20, vol)}%` }}
            />
            <div
                className={`w-1 rounded-full bg-green-500 transition-all duration-75 ease-out delay-[20ms]`}
                style={{ height: isSilent ? '20%' : `${Math.max(20, vol * 0.6)}%` }}
            />
        </div>
    );
});
