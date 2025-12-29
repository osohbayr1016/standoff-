
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, Cast, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../utils/auth';
import LoadingSpinner from './LoadingSpinner';

export default function StreamerDashboard() {
    const { user, token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState({
        platform: 'twitch',
        channelUrl: '',
        streamTitle: '',
        isLive: false
    });
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!token) return;
            try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/streamers/my-profile`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data) {
                        setProfile({
                            platform: data.platform,
                            channelUrl: data.channel_url,
                            streamTitle: data.stream_title || '',
                            isLive: data.is_live
                        });
                    }
                } else {
                    // If unauthorized, user likely doesn't have the role
                    if (res.status === 403) {
                        setError("You do not have the required permissions to access this dashboard.");
                    }
                }
            } catch (err) {
                console.error("Error fetching profile:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [token]);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/streamers/profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    platform: profile.platform,
                    channelUrl: profile.channelUrl,
                    streamTitle: profile.streamTitle
                })
            });

            if (res.ok) {
                setSuccess("Profile settings saved successfully!");
            } else {
                const data = await res.json();
                setError(data.error || "Failed to save profile.");
            }
        } catch (err) {
            setError("Network error. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const toggleLive = async () => {
        const newStatus = !profile.isLive;
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/streamers/live`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    isLive: newStatus,
                    streamTitle: profile.streamTitle
                })
            });

            if (res.ok) {
                setProfile(p => ({ ...p, isLive: newStatus }));
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <div className="h-[50vh] flex items-center justify-center"><LoadingSpinner /></div>;
    if (!user) return <div className="container mx-auto p-8 text-center">Please log in to manage your stream.</div>;

    if (error && error.includes("permissions")) {
        return (
            <div className="container mx-auto p-8 max-w-2xl text-center">
                <Card className="bg-red-500/10 border-red-500/30 p-8">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
                    <p className="text-zinc-400">{error}</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl animate-fade-in space-y-8">
            <div>
                <h1 className="text-3xl font-black font-display text-white mb-2 flex items-center gap-3">
                    <Cast className="h-8 w-8 text-[#ff5500]" />
                    Streamer Dashboard
                </h1>
                <p className="text-zinc-400">Manage your stream settings and live status.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Control Panel */}
                <Card className="bg-zinc-950/50 backdrop-blur-sm border-white/10 order-2 md:order-1">
                    <CardHeader>
                        <CardTitle className="text-xl text-white">Stream Settings</CardTitle>
                        <CardDescription>Configure where you are streaming.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-zinc-300">Platform</Label>
                            <Select
                                value={profile.platform}
                                onValueChange={(v) => setProfile({ ...profile, platform: v })}
                            >
                                <SelectTrigger className="bg-zinc-900 border-white/10 text-white">
                                    <SelectValue placeholder="Select Platform" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                                    <SelectItem value="twitch">Twitch</SelectItem>
                                    <SelectItem value="youtube">YouTube</SelectItem>
                                    <SelectItem value="kick">Kick</SelectItem>
                                    <SelectItem value="tiktok">TikTok</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-zinc-300">Channel URL</Label>
                            <Input
                                value={profile.channelUrl}
                                onChange={(e) => setProfile({ ...profile, channelUrl: e.target.value })}
                                placeholder="https://twitch.tv/username"
                                className="bg-zinc-900 border-white/10 text-white"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-zinc-300">Stream Title</Label>
                            <Input
                                value={profile.streamTitle}
                                onChange={(e) => setProfile({ ...profile, streamTitle: e.target.value })}
                                placeholder="Ranked Matches - Road to Global Elite"
                                className="bg-zinc-900 border-white/10 text-white"
                            />
                        </div>

                        {success && (
                            <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-3 rounded-lg text-sm flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" /> {success}
                            </div>
                        )}

                        {error && !error.includes("permissions") && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg text-sm flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" /> {error}
                            </div>
                        )}

                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full bg-white text-black hover:bg-gray-200"
                        >
                            {saving ? <LoadingSpinner size="sm" /> : <><Save className="h-4 w-4 mr-2" /> Save Settings</>}
                        </Button>
                    </CardContent>
                </Card>

                {/* Live Control */}
                <Card className={`bg-zinc-950/50 backdrop-blur-sm border-white/10 order-1 md:order-2 flex flex-col justify-center items-center p-8 border-2 ${profile.isLive ? 'border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)]' : ''}`}>
                    <div className="text-center space-y-6">
                        <div className={`mx-auto h-24 w-24 rounded-full flex items-center justify-center transition-all duration-500 ${profile.isLive ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-800 text-zinc-500'}`}>
                            <Video className="h-10 w-10" />
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-1">
                                {profile.isLive ? 'YOU ARE LIVE' : 'YOU ARE OFFLINE'}
                            </h2>
                            <p className="text-zinc-400 text-sm">
                                {profile.isLive ? 'Your stream is visible on the Streamers page.' : 'Click below to start broadcasting.'}
                            </p>
                        </div>

                        <Button
                            size="lg"
                            className={`w-full text-lg font-bold py-8 transition-all duration-300 ${profile.isLive
                                ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                                : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20'
                                }`}
                            onClick={toggleLive}
                            disabled={!profile.channelUrl}
                        >
                            {profile.isLive ? 'STOP STREAMING' : 'GO LIVE'}
                        </Button>

                        {!profile.channelUrl && (
                            <p className="text-xs text-red-400">Please save your channel URL first.</p>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}

