import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Users, Shield, Zap } from 'lucide-react';



const GuideSection = ({ title, subtitle, children }: { title: string, subtitle: string, children: React.ReactNode }) => (
    <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8 }}
        className="space-y-12"
    >
        <div className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">{title}</h2>
            <p className="text-xl text-gray-400">{subtitle}</p>
        </div>
        {children}
    </motion.div>
);

const StepCard = ({ number, title, description, icon: Icon }: any) => (
    <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500/20 to-purple-500/20 rounded-xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
        <Card className="relative bg-black/50 border-white/10 h-full backdrop-blur-xl">
            <CardHeader>
                <div className="text-6xl font-black text-white/5 mb-4">{number}</div>
                <CardTitle className="text-xl flex items-center gap-3">
                    <Icon className="w-5 h-5 text-yellow-500" />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <CardDescription className="text-base text-gray-400">{description}</CardDescription>
            </CardContent>
        </Card>
    </div>
);

const ListItem = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-3 text-gray-300">
        <div className="w-2 h-2 rounded-full bg-yellow-500" />
        {children}
    </div>
);

const RankRow = ({ rank, elo, color }: any) => (
    <div className="flex items-center justify-between p-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
        <span className={`font-bold ${color}`}>{rank}</span>
        <span className="text-gray-400 font-mono text-sm">{elo}</span>
    </div>
);

const CheckItem = ({ text }: { text: string }) => (
    <div className="flex items-start gap-3">
        <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
            <div className="w-2 h-2 rounded-full bg-green-500" />
        </div>
        <span className="text-gray-300 text-sm">{text}</span>
    </div>
);

const CrossItem = ({ text }: { text: string }) => (
    <div className="flex items-start gap-3 opacity-50">
        <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center mt-0.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
        </div>
        <span className="text-gray-300 text-sm">{text}</span>
    </div>
);



export default function ExplorePage({ onNavigate }: { onNavigate: (page: string) => void }) {
    const [onlineUsers, setOnlineUsers] = useState<number | null>(null);
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8787";

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Fetch live stats for real-time "Pulse"
                const res = await fetch(`${backendUrl}/api/stats/live`);
                const data = await res.json();
                if (data && data.online_users) {
                    setOnlineUsers(data.online_users);
                }
            } catch (e) {
                console.error("Failed to fetch live stats", e);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 30000); // 30s pulse
        return () => clearInterval(interval);
    }, [backendUrl]);

    return (
        <div className="relative min-h-screen bg-[#09090b] text-white overflow-hidden font-sans">
            {/* Video Background */}
            <div className="fixed inset-0 z-0">
                <video
                    autoPlay
                    loop
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                >
                    <source src="/bachground/Minecraft Autumn Mountains _ Cozy 4K Live Wallpaper 🍂🏔️.mp4" type="video/mp4" />
                </video>
                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#09090b]/70 to-[#09090b] pointer-events-none" />
                <div className="absolute inset-0 bg-black/40 pointer-events-none" />
            </div>

            {/* Content Container */}
            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-32">

                {/* Hero Section */}
                <div className="text-center mb-32 space-y-8">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-6">
                            <Badge variant="outline" className="border-yellow-500/50 text-yellow-500 px-4 py-1 text-sm tracking-widest uppercase backdrop-blur-sm">
                                The Next Era
                            </Badge>
                            {onlineUsers !== null && (
                                <Badge variant="secondary" className="bg-green-500/10 text-green-400 border border-green-500/20 px-4 py-1 flex items-center gap-2 backdrop-blur-md animate-pulse">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </span>
                                    {onlineUsers.toLocaleString()} AGENTS ONLINE
                                </Badge>
                            )}
                        </div>
                        <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40 mb-6 drop-shadow-2xl">
                            DOMINATE<br />
                            <span className="text-yellow-500/90">THE SERVER</span>
                        </h1>
                    </motion.div>

                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.8 }}
                        className="text-lg md:text-2xl text-gray-300 max-w-2xl mx-auto leading-relaxed"
                    >
                        Everything you need to know about Ranking up, Clan Wars, and the Economy.
                    </motion.p>


                </div>

                {/* 2. How To Play Section */}
                <GuideSection title="How to Start" subtitle="Your journey begins in 3 steps">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <StepCard number="01" title="Join Discord" description="Join our Discord server and link your account. This is required for matchmaking and clan features." icon={Users} />
                        <StepCard number="02" title="Set Your Nickname" description="Set your in-game Standoff 2 nickname on your profile. This is how other players will identify you." icon={Shield} />
                        <StepCard number="03" title="Enter Queue" description="Choose a match type: Casual (no ELO), League (+/-25), or Competitive (+/-10). Get matched instantly." icon={Zap} />
                    </div>
                </GuideSection>

                {/* 3. ELO System Section */}
                <GuideSection title="The ELO System" subtitle="Climb the Ranks">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <div className="space-y-6">
                            <p className="text-xl text-gray-300 leading-relaxed">
                                Everyone starts at <strong className="text-white">1000 ELO</strong>. Win League matches to earn <strong className="text-green-400">+25</strong>, or Competitive for <strong className="text-green-400">+10</strong>. Lose and you drop the same amount.
                            </p>
                            <ul className="space-y-4">
                                <ListItem>League Match: ±25 ELO</ListItem>
                                <ListItem>Competitive Match: ±10 ELO</ListItem>
                                <ListItem>Casual: No ELO change</ListItem>
                            </ul>
                            <Button className="bg-yellow-500 text-black hover:bg-yellow-400" onClick={() => onNavigate('matchmaking')}>Find a Match</Button>
                        </div>
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-8 backdrop-blur-md">
                            {/* Visual Rank Ladder - ACCURATE FROM BACKEND */}
                            <div className="space-y-4">
                                <RankRow rank="Gold" elo="1600+" color="text-yellow-500" />
                                <RankRow rank="Silver" elo="1200-1599" color="text-gray-400" />
                                <RankRow rank="Bronze" elo="1000-1199" color="text-orange-700" />
                                <RankRow rank="Unranked" elo="<1000" color="text-gray-600" />
                            </div>
                        </div>
                    </div>
                </GuideSection>

                {/* 4. Clan Wars */}
                <GuideSection title="Clan Warfare" subtitle="Build your legacy">
                    <div className="bg-gradient-to-r from-yellow-900/20 to-black border border-yellow-500/20 rounded-3xl p-8 md:p-12 relative overflow-hidden">
                        <div className="relative z-10 flex flex-col md:flex-row gap-12 items-center">
                            <div className="flex-1 space-y-6">
                                <h3 className="text-3xl font-bold text-white">Tournaments</h3>
                                <p className="text-gray-300 text-lg">
                                    Clans compete in Single-Elimination brackets. Prize pools vary by tournament. To register, your clan must have at least <strong className="text-yellow-500">5 VIP members</strong>.
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                                        <div className="text-yellow-500 font-bold text-2xl">5 VIPs</div>
                                        <div className="text-gray-400 text-sm">Minimum to Register</div>
                                    </div>
                                    <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                                        <div className="text-yellow-500 font-bold text-2xl">4-16</div>
                                        <div className="text-gray-400 text-sm">Teams per Bracket</div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 flex justify-center">
                                <Trophy className="w-48 h-48 text-yellow-500/20 rotate-12" />
                            </div>
                        </div>
                    </div>
                </GuideSection>

                {/* 5. VIP Section */}
                <GuideSection title="VIP Status" subtitle="Support the server, get perks">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        <Card className="bg-black/40 border-white/10">
                            <CardHeader>
                                <CardTitle className="text-2xl">Free Agent</CardTitle>
                                <CardDescription>Standard Experience</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <CheckItem text="Access to All Match Types" />
                                <CheckItem text="Basic Profile Stats" />
                                <CheckItem text="Join Clans" />
                                <CrossItem text="No Custom Banner" />
                                <CrossItem text="Cannot Register Clan for Tournaments" />
                            </CardContent>
                        </Card>
                        <Card className="bg-yellow-500/10 border-yellow-500/50 relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-yellow-500 text-black text-xs font-bold px-3 py-1">RECOMMENDED</div>
                            <CardHeader>
                                <CardTitle className="text-2xl text-yellow-500">VIP Operator</CardTitle>
                                <CardDescription className="text-yellow-200/70">10,000₮ / Month</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <CheckItem text="Custom Profile Banner" />
                                <CheckItem text="Exclusive Discord VIP Role" />
                                <CheckItem text="Clan Tournament Registration" />
                                <CheckItem text="Support Server Development" />
                                <CheckItem text="30-Day Duration (Auto-Renew with QPay)" />
                            </CardContent>
                            <div className="mt-8">
                                <Button className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold" onClick={() => onNavigate('home')}>Become VIP</Button>
                            </div>
                        </Card>
                    </div>
                </GuideSection>

                {/* Closing Call to Action */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 1 }}
                    className="text-center pb-20"
                >
                    <h2 className="text-3xl md:text-5xl font-bold mb-8">Ready to dominate?</h2>
                    <Button
                        size="lg"
                        className="bg-white hover:bg-gray-200 text-black font-bold text-lg px-12 py-8 rounded-full shadow-2xl transition-all hover:scale-105"
                        onClick={() => onNavigate('home')}
                    >
                        Create Account
                    </Button>
                    <p className="mt-6 text-gray-500 text-sm">Join 50,000+ players today</p>
                </motion.div>

            </div>
        </div>
    );
}
