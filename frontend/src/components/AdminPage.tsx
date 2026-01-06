import { useState, useEffect } from 'react';
import { useWebSocket } from './WebSocketContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Users,
    Layers,
    Gamepad2,
    Activity,
    AlertTriangle,
    RefreshCcw,
    Download,
    CheckCircle2,
    ShieldAlert,
    Search,
    Calendar,
    RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

interface AdminStats {
    totalUsers: number;
    queueCount: number;
    activeMatches: number;
    onlineUsers: number;
}

interface User {
    id: string;
    discord_username: string;
    discord_avatar: string | null;
    role: string;
    elo: number;
    wins: number;
    losses: number;
    banned: number;
    standoff_nickname?: string;
    is_vip?: number;
    vip_until?: string;
}

interface AdminPageProps {
    user: { id: string; role?: string } | null;
    backendUrl: string;
}

const AdminPage = ({ user, backendUrl }: AdminPageProps) => {
    const { sendMessage, lastMessage } = useWebSocket();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [isResetting, setIsResetting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);

    // User management state
    const [activeTab, setActiveTab] = useState<'overview' | 'users'>('overview');
    const [users, setUsers] = useState<User[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [processing, setProcessing] = useState(false);

    // Fetch initial stats via WebSocket
    useEffect(() => {
        if (user?.role === 'admin') {
            sendMessage({ type: 'GET_SYSTEM_STATS' });
        }
    }, [user, sendMessage]);

    // Handle incoming WebSocket messages
    useEffect(() => {
        if (lastMessage?.type === 'SYSTEM_STATS_DATA') {
            setStats(lastMessage.stats);
        }
    }, [lastMessage]);

    useEffect(() => {
        if (activeTab === 'users') {
            fetchPlayers(currentPage, searchQuery);
        }
    }, [activeTab, currentPage]);

    const fetchPlayers = async (page: number, search?: string) => {
        try {
            let url = `${backendUrl}/api/moderator/players?page=${page}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;

            const response = await fetch(url, {
                headers: { 'X-User-Id': user?.id || '' }
            });
            const data = await response.json();
            if (data.success) {
                setUsers(data.players);
            }
        } catch (err) {
            console.error('Error fetching players:', err);
        }
    };

    const handleVipToggle = async (playerId: string, grant: boolean) => {
        if (!user) return;
        setProcessing(true);

        try {
            const endpoint = grant ? 'grant' : 'revoke';
            const response = await fetch(`${backendUrl}/api/moderator/players/${playerId}/vip/${endpoint}`, {
                method: 'POST',
                headers: { 'X-User-Id': user.id }
            });

            const data = await response.json();
            if (data.success) {
                fetchPlayers(currentPage, searchQuery);
                toast.success(`VIP ${grant ? 'granted' : 'revoked'}`, {
                    description: `Successfully updated VIP status`
                });
            } else {
                toast.error(`Failed to ${grant ? 'grant' : 'revoke'} VIP`, {
                    description: data.error || 'Please try again'
                });
            }
        } catch (err) {
            toast.error('Connection failed', {
                description: 'Please check your internet connection and try again'
            });
        } finally {
            setProcessing(false);
        }
    };

    const getTimeRemaining = (until: string) => {
        const diff = new Date(until).getTime() - new Date().getTime();
        if (diff <= 0) return 'Expired';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days > 0) return `${days}d ${hours}h left`;
        return `${hours}h left`;
    };

    const handleSystemReset = () => {
        if (!window.confirm("ARE YOU SURE? This will clear ALL active lobbies and the queue for EVERYONE. This action cannot be undone.")) return;

        setIsResetting(true);
        sendMessage({ type: 'RESET_MATCH' });

        setTimeout(() => {
            setIsResetting(false);
            sendMessage({ type: 'GET_SYSTEM_STATS' });
        }, 2000);
    };

    const handleCleanupVips = async () => {
        if (!window.confirm("Run VIP cleanup? This will remove VIP status and Discord roles from all users whose membership has expired.")) return;

        setProcessing(true);
        try {
            const response = await fetch(`${backendUrl}/api/admin/cleanup-vips?secret=admin-secret-123`, {
                method: 'POST'
            });
            const data = await response.json();
            if (data.success) {
                toast.success('Cleanup complete', {
                    description: data.message
                });
                if (activeTab === 'users') fetchPlayers(1, searchQuery);
            } else {
                toast.error('Cleanup failed', {
                    description: data.error || 'Unable to complete VIP cleanup'
                });
            }
        } catch (err) {
            toast.error('Connection failed', {
                description: 'Please check your internet connection and try again'
            });
        } finally {
            setProcessing(false);
        }
    };

    const handleImportUsers = async () => {
        if (!window.confirm("Import all members from the Discord server? This may take a moment.")) return;

        setIsImporting(true);
        setImportResult(null);

        try {
            const response = await fetch(`${backendUrl}/api/admin/import-users`, {
                method: 'POST',
                headers: {
                    'x-admin-secret': 'admin-secret-123' // Fallback for dev, should be env-driven
                }
            });
            const data = await response.json();
            if (data.success) {
                setImportResult({ success: true, message: data.message });
                sendMessage({ type: 'GET_SYSTEM_STATS' });
            } else {
                setImportResult({ success: false, message: data.error || 'Import failed' });
            }
        } catch (err) {
            setImportResult({ success: false, message: 'Network error' });
        } finally {
            setIsImporting(false);
        }
    };

    if (user?.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                <ShieldAlert className="w-16 h-16 text-destructive animate-pulse" />
                <h1 className="text-3xl font-black tracking-tighter uppercase">Access Denied</h1>
                <p className="text-muted-foreground max-w-md">
                    This area is restricted to system administrators only. Your attempt has been logged.
                </p>
                <Button onClick={() => window.location.href = '/'} variant="outline">
                    Return to Safety
                </Button>
            </div>
        );
    }

    const renderOverview = () => (
        <div className="space-y-8">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Registered"
                    value={stats?.totalUsers || 0}
                    icon={<Users className="w-5 h-5" />}
                    description="Total players in database"
                />
                <StatCard
                    title="Online Now"
                    value={stats?.onlineUsers || 0}
                    icon={<Activity className="w-5 h-5 text-green-500" />}
                    description="Currently connected via WebSocket"
                    trend="Live"
                />
                <StatCard
                    title="Active Queue"
                    value={stats?.queueCount || 0}
                    icon={<Layers className="w-5 h-5 text-yellow-500" />}
                    description="Players searching for matches"
                />
                <StatCard
                    title="Live Matches"
                    value={stats?.activeMatches || 0}
                    icon={<Gamepad2 className="w-5 h-5 text-primary" />}
                    description="Ongoing matches in all lobbies"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* System Controls */}
                <Card className="bg-black/40 border-primary/10 backdrop-blur-sm overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-primary" />
                            System Controls
                        </CardTitle>
                        <CardDescription>Execute global system operations.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                            <h3 className="text-lg font-bold text-destructive flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-5 h-5" />
                                Danger Zone
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                The Master Reset will wipe all current lobbies and reset the matchmaking state. This should only be used in case of critical deadlocks or system maintenance.
                            </p>
                            <Button
                                variant="destructive"
                                className="w-full font-bold uppercase tracking-wider"
                                onClick={handleSystemReset}
                                disabled={isResetting}
                            >
                                {isResetting ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : "Master System Reset"}
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full mt-4 border-yellow-500/30 hover:bg-yellow-500/10 text-yellow-500"
                                onClick={handleCleanupVips}
                                disabled={processing}
                            >
                                {processing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                Cleanup Expired VIPs
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* User Synchronization */}
                <Card className="bg-black/40 border-primary/10 backdrop-blur-sm overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Download className="w-5 h-5 text-blue-500" />
                            User Synchronization
                        </CardTitle>
                        <CardDescription>Import players from external providers.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                            <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2 mb-2">
                                Discord Import
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Synchronize the database with all members of the Discord server. This will add new users and update existing profile metadata.
                            </p>
                            <Button
                                variant="outline"
                                className="w-full font-bold border-blue-500/30 hover:bg-blue-500/10"
                                onClick={handleImportUsers}
                                disabled={isImporting}
                            >
                                {isImporting ? <RefreshCcw className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                                Sync Discord Members
                            </Button>

                            {importResult && (
                                <div className={cn(
                                    "mt-4 p-3 rounded text-sm flex items-start gap-2",
                                    importResult.success ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"
                                )}>
                                    {importResult.success ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <ShieldAlert className="w-4 h-4 mt-0.5" />}
                                    {importResult.message}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );

    const renderUserManagement = () => (
        <div className="space-y-6 animate-in fade-in duration-500">
            <Card className="bg-black/40 border-white/10 backdrop-blur-sm overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-primary" />
                            User Directory
                        </CardTitle>
                        <CardDescription>Manage player permissions and VIP status.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search Discord name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchPlayers(1, searchQuery)}
                                className="w-64 pl-9 bg-zinc-900/50 border-white/10"
                            />
                        </div>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => fetchPlayers(1, searchQuery)}
                        >
                            Search
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-white/5 hover:bg-transparent">
                                <TableHead className="w-[300px]">Player</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>ELO</TableHead>
                                <TableHead>W/L</TableHead>
                                <TableHead>VIP Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((u) => (
                                <TableRow key={u.id} className="border-white/5 hover:bg-white/5 transition-colors group">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9 border border-white/10">
                                                <AvatarImage src={`https://cdn.discordapp.com/avatars/${u.id}/${u.discord_avatar}.png`} />
                                                <AvatarFallback className="bg-zinc-800 text-xs">
                                                    {u.discord_username[0].toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm tracking-tight">{u.discord_username}</span>
                                                {u.standoff_nickname && (
                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none mt-0.5">{u.standoff_nickname}</span>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={u.role === 'admin' ? 'destructive' : u.role === 'moderator' ? 'default' : 'secondary'}
                                            className="uppercase text-[9px] font-black tracking-widest px-1.5 py-0"
                                        >
                                            {u.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-primary font-bold">
                                        {u.elo}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        <span className="text-green-500">{u.wins}</span> / <span className="text-red-500">{u.losses}</span>
                                    </TableCell>
                                    <TableCell>
                                        {u.is_vip === 1 ? (
                                            <div className="flex flex-col">
                                                <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-[9px] font-black text-black px-2 py-0 w-fit mb-1 border-none">
                                                    ACTIVE VIP
                                                </Badge>
                                                {u.vip_until && (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-[10px] text-primary font-bold flex items-center gap-1">
                                                            <Activity className="w-3 h-3" />
                                                            {getTimeRemaining(u.vip_until)}
                                                        </span>
                                                        <span className="text-[9px] text-muted-foreground flex items-center gap-1 opacity-70">
                                                            <Calendar className="w-3 h-3" />
                                                            {new Date(u.vip_until).toLocaleDateString('en-US', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">No VIP</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant={u.is_vip === 1 ? "outline" : "default"}
                                            size="sm"
                                            className={cn(
                                                "text-[10px] h-7 font-bold uppercase",
                                                u.is_vip === 1 ? "border-red-500/20 text-red-400 hover:bg-red-500/10" : "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500/20"
                                            )}
                                            onClick={() => handleVipToggle(u.id, u.is_vip !== 1)}
                                            disabled={processing}
                                        >
                                            {processing ? <RefreshCw className="w-3 h-3 animate-spin" /> : (
                                                u.is_vip === 1 ? "Revoke VIP" : "Grant VIP"
                                            )}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {users.length === 0 && (
                        <div className="p-12 text-center text-muted-foreground italic">
                            No players found matching your search.
                        </div>
                    )}

                    <div className="flex items-center justify-between p-4 bg-black/20 border-t border-white/5">
                        <div className="text-xs text-muted-foreground">
                            Displaying 50 players per page
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="h-8 w-8 p-0"
                            >
                                &lt;
                            </Button>
                            <span className="text-xs font-bold px-2">Page {currentPage}</span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => p + 1)}
                                disabled={users.length < 50}
                                className="h-8 w-8 p-0"
                            >
                                &gt;
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 uppercase font-bold tracking-widest px-3 py-0.5">
                            System Administration
                        </Badge>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase">Admin <span className="text-primary italic">Terminal</span></h1>
                    <p className="text-muted-foreground mt-2">Manage global system state and user permissions.</p>
                </div>

                <div className="flex items-center gap-3 bg-zinc-900/50 p-1 rounded-lg border border-white/5">
                    <Button
                        onClick={() => setActiveTab('overview')}
                        variant={activeTab === 'overview' ? 'default' : 'ghost'}
                        size="sm"
                        className="gap-2 h-9"
                    >
                        <ShieldAlert className="w-4 h-4" />
                        OVERVIEW
                    </Button>
                    <Button
                        onClick={() => setActiveTab('users')}
                        variant={activeTab === 'users' ? 'default' : 'ghost'}
                        size="sm"
                        className="gap-2 h-9"
                    >
                        <Users className="w-4 h-4" />
                        USER MGMT
                    </Button>
                </div>
            </div>

            {activeTab === 'overview' ? renderOverview() : renderUserManagement()}
        </div>
    );
};

export default AdminPage;

function StatCard({ title, value, icon, description, trend }: { title: string; value: number | string; icon: React.ReactNode; description: string; trend?: string }) {
    return (
        <Card className="bg-black/40 border-primary/10 hover:border-primary/30 transition-all group">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <div className="p-2 rounded-lg bg-primary/5 group-hover:bg-primary/10 transition-colors">
                    {icon}
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-baseline gap-2">
                    <div className="text-3xl font-black tracking-tight">{value}</div>
                    {trend && (
                        <Badge variant="outline" className="text-[10px] bg-green-500/5 text-green-400 border-green-500/20 py-0 font-bold uppercase">
                            {trend}
                        </Badge>
                    )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </CardContent>
        </Card>
    );
}
