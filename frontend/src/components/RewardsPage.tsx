import React, { useState, useEffect } from 'react';
import { Gift, Play, CheckCircle2, AlertCircle, Sparkles, Coins, Crown, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import RewardsCard from './RewardsCard';
import GoogleAd from './GoogleAd';

interface RewardsPageProps {
    user: any;
    backendUrl: string;
}

const RewardsPage: React.FC<RewardsPageProps> = ({ user, backendUrl }) => {
    const [status, setStatus] = useState<{ claims_today: number; limit: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [isWatching, setIsWatching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fetchStatus = async () => {
        if (!user?.id) return;
        try {
            const res = await fetch(`${backendUrl}/api/rewards/status?userId=${user.id}`);
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
            }
        } catch (err) {
            console.error('Failed to fetch reward status:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.id) {
            fetchStatus();
        }
    }, [user?.id]);

    // Extend window interface for AdSense H5 API
    useEffect(() => {
        // Prepare Sound/Game pause logic here if needed
    }, []);

    const handleWatchAd = () => {
        if (!status || status.claims_today >= status.limit) return;
        setError(null);
        setSuccess(null);

        // Check if adBreak is available
        if (typeof (window as any).adBreak !== 'function') {
            console.warn('adBreak not found, attempting fallback or waiting...');
            // Optional: fallback to manual timer for dev/testing if adblock is on
            // But for production proper, we want to warn user.
            setError("Ad system is initializing or blocked. Please disable AdBlock and try again.");
            return;
        }

        const adBreak = (window as any).adBreak;

        adBreak({
            type: 'reward',
            name: 'daily_reward_match',
            beforeReward: (showAdFn: () => void) => {
                // Ad is ready
                setIsWatching(true);
                showAdFn();
            },
            adViewed: () => {
                // Ad completed successfully
                claimReward();
            },
            adDismissed: () => {
                // Ad closed early
                setIsWatching(false);
                setError("You must watch the entire ad to claim the reward.");
            },
            adBreakDone: (placementInfo: any) => {
                // Ad finished (success or fail)
                setIsWatching(false);
                console.log("AdBreak done:", placementInfo);
            }
        });
    };

    // Removed manual timer effect

    const claimReward = async () => {
        setIsWatching(false);
        try {
            const res = await fetch(`${backendUrl}/api/rewards/claim`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user?.id || ''
                },
                body: JSON.stringify({ type: 'competitive_match' })
            });

            const data = await res.json();
            if (res.ok) {
                setSuccess(data.message);
                fetchStatus();
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Failed to claim reward. Please try again.');
        }
    };

    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            {/* Maintenance/Warning Banner */}
            <div className="bg-orange-500/10 border border-orange-500/20 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-6 animate-pulse">
                <div className="h-16 w-16 rounded-2xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30 flex-shrink-0">
                    <AlertCircle className="h-10 w-10 text-orange-500" />
                </div>
                <div className="text-center md:text-left">
                    <h3 className="text-xl font-bold text-white uppercase tracking-tight mb-1">Одоогоор ажиллахгүй байна</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
                        Google AdSense систем шалгагдаж байгаа тул одоогоор зар үзэж шагнал авах боломжгүй байна.
                        Бид удахгүй идэвхжүүлэх тул та түр хүлээнэ үү.
                    </p>
                </div>
            </div>

            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-white flex items-center gap-3">
                        <Gift className="h-10 w-10 text-primary" />
                        REWARDS
                    </h1>
                    <p className="text-zinc-400 mt-2">
                        Get bonus matches and track your weekly earnings
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-zinc-900/50 p-2 rounded-xl border border-white/5">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Coins className="h-6 w-6 text-primary" />
                    </div>
                    <div className="pr-4">
                        <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Your Balance</div>
                        <div className="text-lg font-black text-white">{user?.gold || 0} GOLD</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: AD Rewards */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="bg-zinc-950/50 border-white/10 overflow-hidden relative group">
                        {/* Background Decoration */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] -mr-32 -mt-32" />

                        <div className="p-8 relative z-10">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30">
                                    <Zap className="h-8 w-8 text-primary animate-pulse" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white">Daily AD Rewards</h2>
                                    <p className="text-zinc-400">Watch a short ad to get an extra Competitive Match</p>
                                </div>
                            </div>

                            {loading ? (
                                <div className="h-32 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {/* Progress Section */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <div className="text-sm font-bold text-white uppercase tracking-widest">Daily Progress</div>
                                            <div className="text-primary font-black text-xl">{status?.claims_today || 0} / {status?.limit || 2}</div>
                                        </div>
                                        <Progress value={((status?.claims_today || 0) / (status?.limit || 2)) * 100} className="h-3 bg-zinc-900" />
                                        <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                            <span>Start</span>
                                            <span>{status?.claims_today === status?.limit ? 'Limit Reached' : 'Watching Ads adds +1 match'}</span>
                                            <span>Limit</span>
                                        </div>
                                    </div>

                                    {/* Action Area */}
                                    <div className="bg-zinc-900/50 rounded-2xl p-6 border border-white/5 flex flex-col items-center text-center gap-6">
                                        {isWatching ? (
                                            <div className="space-y-4 py-4 w-full max-w-md">
                                                <div className="flex items-center justify-center gap-3 text-primary">
                                                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-primary" />
                                                    <span className="text-xl font-black">Loading Ad...</span>
                                                </div>
                                                <p className="text-zinc-400 text-sm">Please watch the ad to the end.</p>

                                                {/* Google AdSense Unit */}
                                                <div className="w-full bg-zinc-800/20 rounded-xl border border-white/5 relative min-h-[250px] flex items-center justify-center">
                                                    <GoogleAd
                                                        className="w-full"
                                                        adClient="ca-pub-8280658512200421"
                                                        adSlot="8061547099"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="h-20 w-20 rounded-full bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                                                    <Play className="h-10 w-10 text-primary ml-1" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-bold text-white mb-2">Ready to watch?</h3>
                                                    <p className="text-zinc-400 text-sm max-w-sm">
                                                        Support the community and keep playing! Get 1 extra competitive match for every ad watched (max 2/day).
                                                    </p>
                                                </div>
                                                <Button
                                                    size="lg"
                                                    className="h-14 px-10 text-lg font-black bg-primary hover:bg-primary/90 shadow-[0_0_30px_rgba(255,85,0,0.3)]"
                                                    disabled={status?.claims_today === status?.limit}
                                                    onClick={handleWatchAd}
                                                >
                                                    WATCH NOW
                                                </Button>
                                            </>
                                        )}
                                    </div>

                                    {/* Feedback messages */}
                                    {success && (
                                        <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center gap-3 text-green-500">
                                            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                                            <span className="text-sm font-medium">{success}</span>
                                        </div>
                                    )}
                                    {error && (
                                        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-500">
                                            <AlertCircle className="h-5 w-5 flex-shrink-0" />
                                            <span className="text-sm font-medium">{error}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* How it works info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-zinc-900/30 p-4 rounded-xl border border-white/5">
                            <h4 className="text-white font-bold mb-1 flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-yellow-500" />
                                Why watch?
                            </h4>
                            <p className="text-zinc-400 text-xs leading-relaxed">
                                Watching ads helps us keep the servers running and provides free users more ways to participate in competitive matchmaking.
                            </p>
                        </div>
                        <div className="bg-zinc-900/30 p-4 rounded-xl border border-white/5">
                            <h4 className="text-white font-bold mb-1 flex items-center gap-2">
                                <Crown className="h-4 w-4 text-primary" />
                                Go VIP
                            </h4>
                            <p className="text-zinc-400 text-xs leading-relaxed">
                                Want unlimited competitive matches? Upgrade to VIP to remove all limits and support the platform directly.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Column: Weekly Rewards */}
                <div className="space-y-6">
                    <RewardsCard />

                    <Card className="bg-zinc-950/50 border-white/10 p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Past Winners</h3>
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500">
                                            #{i}
                                        </div>
                                        <div className="text-sm font-medium text-white">Top User {i}</div>
                                    </div>
                                    <div className="text-primary font-bold text-xs">{5000 * (4 - i)} MNT</div>
                                </div>
                            ))}
                        </div>
                        <Button variant="ghost" className="w-full mt-4 text-zinc-500 hover:text-white text-xs">
                            View Historical Leaderboard
                        </Button>
                    </Card>
                </div>
            </div>

            {/* Google AdSense Script Placeholder */}
            {/* 
            <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
            */}
        </div>
    );
};

export default RewardsPage;
