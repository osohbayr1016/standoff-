import { useState, useEffect, Suspense, lazy } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LayoutDashboard, Swords, Users, Shield, ClipboardList, RefreshCw, Trophy } from "lucide-react";
import LoadingSpinner from "./LoadingSpinner";
import type { ModeratorStats } from "./moderator/types";

// Lazy Load Tabs
const OverviewTab = lazy(() => import("./moderator/OverviewTab"));
const MatchesTab = lazy(() => import("./moderator/MatchesTab"));
const PlayersTab = lazy(() => import("./moderator/PlayersTab"));
const ClansTab = lazy(() => import("./moderator/ClansTab"));
const AuditLogTab = lazy(() => import("./moderator/AuditLogTab"));
const TournamentsTab = lazy(() => import("./moderator/TournamentsTab"));

interface ModeratorPageProps {
    user: { id: string; role?: string } | null;
    backendUrl: string;
    onViewLobby?: (lobbyId: string) => void;
}

export default function ModeratorPage({ user, backendUrl, onViewLobby }: ModeratorPageProps) {
    const [activeTab, setActiveTab] = useState("overview");
    const [stats, setStats] = useState<ModeratorStats>({
        totalPlayers: 0,
        waitingMatches: 0,
        activeMatches: 0,
        pendingReviews: 0,
        completedMatches: 0,
        bannedPlayers: 0
    });
    const [isLoadingStats, setIsLoadingStats] = useState(false);

    useEffect(() => {
        fetchStats();
        // Poll stats every 30s
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchStats = async () => {
        setIsLoadingStats(true);
        try {
            const res = await fetch(`${backendUrl}/api/moderator/stats`, {
                headers: { 'X-User-Id': user?.id || '' },
                credentials: 'include'
            });
            if (res.ok) setStats(await res.json());
        } catch (error) {
            console.error("Failed to fetch stats", error);
        } finally {
            setIsLoadingStats(false);
        }
    };

    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Card className="text-center p-8 bg-zinc-900/50 border-white/5">
                    <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">Access Denied</h1>
                    <p className="text-zinc-400 mt-2">You do not have permission to view this page.</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                        Moderator Dashboard
                    </h1>
                    <p className="text-zinc-400">Manage matches, users, and disputes</p>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchStats} disabled={isLoadingStats}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingStats ? 'animate-spin' : ''}`} />
                        Refresh Data
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-[#1e1f22] border border-white/5 p-1 h-auto flex-wrap justify-start">
                    <TabsTrigger value="overview" className="gap-2 px-4 py-2">
                        <LayoutDashboard className="h-4 w-4" /> Overview
                    </TabsTrigger>
                    <TabsTrigger value="tournaments" className="gap-2 px-4 py-2">
                        <Trophy className="h-4 w-4" /> Tournaments
                    </TabsTrigger>
                    <TabsTrigger value="matches" className="gap-2 px-4 py-2">
                        <Swords className="h-4 w-4" /> Matches
                        {stats.pendingReviews > 0 && (
                            <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{stats.pendingReviews}</span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="players" className="gap-2 px-4 py-2">
                        <Users className="h-4 w-4" /> Players
                    </TabsTrigger>
                    <TabsTrigger value="clans" className="gap-2 px-4 py-2">
                        <Shield className="h-4 w-4" /> Clans
                    </TabsTrigger>
                    <TabsTrigger value="logs" className="gap-2 px-4 py-2">
                        <ClipboardList className="h-4 w-4" /> Audit Logs
                    </TabsTrigger>
                </TabsList>

                <div className="min-h-[400px]">
                    <Suspense fallback={<div className="flex h-64 items-center justify-center"><LoadingSpinner /></div>}>
                        <TabsContent value="overview">
                            <OverviewTab stats={stats} refreshStats={fetchStats} />
                        </TabsContent>

                        <TabsContent value="tournaments">
                            <TournamentsTab backendUrl={backendUrl} userId={user.id} />
                        </TabsContent>

                        <TabsContent value="matches">
                            <MatchesTab backendUrl={backendUrl} onViewLobby={onViewLobby} userId={user.id} />
                        </TabsContent>

                        <TabsContent value="players">
                            <PlayersTab backendUrl={backendUrl} userId={user.id} />
                        </TabsContent>

                        <TabsContent value="clans">
                            <ClansTab backendUrl={backendUrl} userId={user.id} />
                        </TabsContent>

                        <TabsContent value="logs">
                            <AuditLogTab backendUrl={backendUrl} userId={user.id} />
                        </TabsContent>
                    </Suspense>
                </div>
            </Tabs>
        </div>
    );
}
