import { useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Twitch, Youtube, Video, Zap, Maximize2 } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface Streamer {
    id: number;
    platform: 'twitch' | 'youtube' | 'kick' | 'tiktok';
    channelUrl: string;
    streamTitle: string;
    username: string;
    nickname: string;
    avatar: string;
    discordId: string;
    isLive: boolean;
}

const getEmbedUrl = (streamer: Streamer): string | null => {
    try {
        const url = new URL(streamer.channelUrl);
        const pathSegments = url.pathname.split('/').filter(Boolean);
        const hostname = window.location.hostname; // Dynamic parent for Twitch

        if (streamer.platform === 'twitch') {
            // https://twitch.tv/username
            const channel = pathSegments[0];
            if (channel) return `https://player.twitch.tv/?channel=${channel}&parent=${hostname}&parent=localhost&muted=false`;
        }

        if (streamer.platform === 'kick') {
            // https://kick.com/username -> https://player.kick.com/username
            const channel = pathSegments[0];
            if (channel) return `https://player.kick.com/${channel}`;
        }

        if (streamer.platform === 'youtube') {
            // https://youtube.com/watch?v=VIDEO_ID
            const v = url.searchParams.get('v');
            if (v) return `https://www.youtube.com/embed/${v}?autoplay=1`;

            // https://youtu.be/VIDEO_ID
            if (url.hostname === 'youtu.be' && pathSegments[0]) {
                return `https://www.youtube.com/embed/${pathSegments[0]}?autoplay=1`;
            }

            // https://www.youtube.com/embed/VIDEO_ID
            if (pathSegments[0] === 'embed' && pathSegments[1]) {
                return `https://www.youtube.com/embed/${pathSegments[1]}?autoplay=1`;
            }
        }

        return null;
    } catch (e) {
        return null;
    }
};

const StreamerCard = ({ streamer, onWatch }: { streamer: Streamer, onWatch: (s: Streamer) => void }) => {
    const getIcon = () => {
        switch (streamer.platform) {
            case 'twitch': return <Twitch className="h-4 w-4 text-purple-400" />;
            case 'youtube': return <Youtube className="h-4 w-4 text-red-500" />;
            default: return <Video className="h-4 w-4 text-white" />;
        }
    };

    return (
        <Card className="group relative overflow-hidden border-border bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_30px_-5px_hsl(var(--primary)/0.3)]">
            {/* Background Glow on Hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/0 group-hover:via-primary/5 group-hover:to-primary/10 transition-all duration-500" />

            {/* Thumbnail Area - Clickable to watch */}
            <div
                className="h-32 bg-zinc-900/50 relative p-4 flex flex-col justify-between border-b border-border/50 group-hover:border-primary/20 transition-colors cursor-pointer"
                onClick={() => onWatch(streamer)}
            >
                {/* Decorative Pattern */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

                <div className="relative flex justify-between items-start z-10">
                    <Badge className="bg-red-500/10 text-red-500 border-red-500/20 animate-pulse font-bold tracking-wider flex items-center gap-1.5 px-2.5">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                        LIVE
                    </Badge>
                    <div className="bg-black/40 backdrop-blur-md p-2 rounded-xl border border-white/5 shadow-lg group-hover:scale-110 transition-transform">
                        {getIcon()}
                    </div>
                </div>

                {/* Play Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <div className="bg-primary/90 rounded-full p-3 shadow-xl transform scale-75 group-hover:scale-100 transition-transform duration-300">
                        <Maximize2 className="h-6 w-6 text-white" />
                    </div>
                </div>
            </div>

            <CardContent className="p-5 relative">
                {/* Float Avatar Over Border */}
                <div className="absolute -top-10 left-5">
                    <div className="relative">
                        <Avatar className="h-20 w-20 border-4 border-[#121212] shadow-2xl ring-2 ring-transparent group-hover:ring-primary/50 transition-all">
                            <AvatarImage src={`https://cdn.discordapp.com/avatars/${streamer.discordId}/${streamer.avatar}.png`} />
                            <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xl font-bold">{streamer.username[0]}</AvatarFallback>
                        </Avatar>
                        <div className="absolute bottom-1 right-1 bg-green-500 h-4 w-4 rounded-full border-4 border-[#121212]" />
                    </div>
                </div>

                <div className="mt-10 space-y-1">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-display font-black text-white truncate group-hover:text-primary transition-colors tracking-tight">
                            {streamer.nickname || streamer.username}
                        </h3>
                    </div>

                    <p className="text-sm font-medium text-zinc-400 truncate min-h-[1.25rem]">
                        {streamer.streamTitle || "Playing Standoff 2"}
                    </p>

                    <div className="pt-4">
                        <Button
                            variant="default" // Uses primary color by default
                            className="w-full font-bold uppercase tracking-wider shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all"
                            onClick={() => onWatch(streamer)}
                        >
                            Watch Stream <ExternalLink className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function StreamersPage() {
    const [streamers, setStreamers] = useState<Streamer[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStream, setSelectedStream] = useState<Streamer | null>(null);

    useEffect(() => {
        const fetchStreamers = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/streamers`);
                if (res.ok) {
                    const data = await res.json();
                    setStreamers(data);
                }
            } catch (err) {
                console.error("Error fetching streamers:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchStreamers();
        const interval = setInterval(fetchStreamers, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleWatch = (streamer: Streamer) => {
        const embedUrl = getEmbedUrl(streamer);
        if (embedUrl) {
            // Open Modal
            setSelectedStream(streamer);
        } else {
            // Fallback to new tab
            window.open(streamer.channelUrl, '_blank');
        }
    };

    if (loading) return (
        <div className="h-[60vh] flex flex-col items-center justify-center space-y-4 animate-fade-in">
            <LoadingSpinner size="lg" />
            <p className="text-muted-foreground animate-pulse">Searching for live signals...</p>
        </div>
    );

    return (
        <div className="container mx-auto px-4 py-12 animate-fade-in space-y-12 relative">
            {/* Background Ambience */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full translate-x-1/3 -translate-y-1/3" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full -translate-x-1/3 translate-y-1/3" />
            </div>

            {/* Header Section */}
            <div className="text-center space-y-4 max-w-2xl mx-auto">
                <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1.5 text-xs font-black uppercase tracking-widest animate-fade-in">
                    Live Broadcasts
                </Badge>
                <h1 className="text-5xl md:text-6xl font-display font-black tracking-tighter uppercase italic">
                    <span className="text-white">Active</span> <span className="text-primary">Streamers</span>
                </h1>
                <p className="text-lg text-muted-foreground font-light leading-relaxed">
                    Watch the best Standoff 2 players competing live. Learn strategies, watch tournaments, and support the community.
                </p>
            </div>

            {/* Stream Grid */}
            {streamers.length === 0 ? (
                <Card className="max-w-md mx-auto border-border bg-card/30 backdrop-blur text-center p-12 space-y-6">
                    <div className="bg-zinc-900/50 p-6 rounded-full w-24 h-24 mx-auto flex items-center justify-center border border-white/5">
                        <Zap className="h-10 w-10 text-zinc-600" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-white">No Active Streams</h2>
                        <p className="text-muted-foreground">
                            None of our verifying streamers are live right now.
                            <br />Check back later or join our Discord.
                        </p>
                    </div>
                    <Button variant="outline" className="border-white/10 hover:bg-white/5">
                        Join Discord
                    </Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {streamers.map(streamer => (
                        <StreamerCard key={streamer.id} streamer={streamer} onWatch={handleWatch} />
                    ))}
                </div>
            )}

            {/* Watch Modal */}
            <Dialog open={!!selectedStream} onOpenChange={(open) => !open && setSelectedStream(null)}>
                <DialogContent className="max-w-5xl w-full bg-zinc-950/95 border-white/10 p-0 overflow-hidden">
                    <DialogHeader className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded-lg backdrop-blur text-white flex flex-row items-center gap-2">
                        <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                        <DialogTitle className="text-sm font-bold tracking-wide uppercase">
                            Warning: Now Watching {selectedStream?.nickname}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="aspect-video w-full bg-black">
                        {selectedStream && getEmbedUrl(selectedStream) && (
                            <iframe
                                src={getEmbedUrl(selectedStream)!}
                                title={`${selectedStream.username}'s Stream`}
                                className="w-full h-full"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
