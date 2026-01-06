import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ShieldAlert, Swords, Trophy, Activity, AlertTriangle, CheckCircle2, UserX } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import type { ModeratorStats } from "./types";

interface OverviewTabProps {
    stats: ModeratorStats;
    refreshStats: () => void;
}

export default function OverviewTab({ stats, refreshStats }: OverviewTabProps) {
    const chartData = [
        { name: 'Mon', matches: 120 },
        { name: 'Tue', matches: 155 },
        { name: 'Wed', matches: 140 },
        { name: 'Thu', matches: 180 },
        { name: 'Fri', matches: 210 },
        { name: 'Sat', matches: 250 },
        { name: 'Sun', matches: 230 },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-[#1e1f22] border-white/5 hover:border-white/10 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Active Matches</CardTitle>
                        <Swords className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{stats.activeMatches}</div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Activity className="h-3 w-3 text-green-500" />
                            +24% from last hour
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-[#1e1f22] border-white/5 hover:border-white/10 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Pending Reviews</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{stats.pendingReviews}</div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            {stats.pendingReviews > 5 ? (
                                <span className="text-orange-500 font-bold">Action Required</span>
                            ) : (
                                <span className="text-green-500">Low Backlog</span>
                            )}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-[#1e1f22] border-white/5 hover:border-white/10 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Players</CardTitle>
                        <Users className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{stats.totalPlayers}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            <span className="text-green-500">+12%</span> new this week
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-[#1e1f22] border-white/5 hover:border-white/10 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Completed Today</CardTitle>
                        <Trophy className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{stats.completedMatches}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Matches finished
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
                <Card className="lg:col-span-4 bg-[#1e1f22] border-white/5">
                    <CardHeader>
                        <CardTitle>Activity Overview</CardTitle>
                        <CardDescription>Matchmaking traffic for the last 7 days</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorMatches" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: '#18191c', border: '1px solid #333', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="matches"
                                    stroke="#f43f5e"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorMatches)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <div className="lg:col-span-3 space-y-4">
                    <Card className="bg-[#1e1f22] border-white/5 bg-gradient-to-br from-[#1e1f22] to-red-900/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldAlert className="h-5 w-5 text-red-500" />
                                Review Queue
                            </CardTitle>
                            <CardDescription>Matches reported by users</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-zinc-400">Wait Time</span>
                                <span className="font-bold text-white text-sm">~15 min</span>
                            </div>
                            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-red-500 w-[65%]" />
                            </div>
                            <Button className="w-full mt-4 bg-red-600 hover:bg-red-700" onClick={() => {
                                const tabs = document.querySelector('[data-value="matches"]') as HTMLElement;
                                if (tabs) tabs.click();
                            }}>
                                Review Pending Matches
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="bg-[#1e1f22] border-white/5">
                        <CardHeader>
                            <CardTitle>Quick Access</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-2">
                            <Button variant="outline" className="border-dashed border-zinc-700 hover:bg-zinc-800 hover:border-zinc-500 h-20 flex flex-col gap-1" onClick={() => {
                                const tabs = document.querySelector('[data-value="players"]') as HTMLElement;
                                if (tabs) tabs.click();
                            }}>
                                <UserX className="h-5 w-5 text-zinc-400" />
                                <span>Ban User</span>
                            </Button>
                            <Button variant="outline" className="border-dashed border-zinc-700 hover:bg-zinc-800 hover:border-zinc-500 h-20 flex flex-col gap-1" onClick={refreshStats}>
                                <CheckCircle2 className="h-5 w-5 text-green-400" />
                                <span>Refresh Stats</span>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
