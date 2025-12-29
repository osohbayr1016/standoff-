import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Shield, Users, Trophy, TrendingUp, Calendar,
    ArrowLeft, Crown, Swords, MapPin, Clock, Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "../utils/auth";

interface ClanMember {
    id: string;
    discord_username: string;
    discord_avatar: string | null;
    standoff_nickname: string | null;
    elo: number;
    wins: number;
    losses: number;
    role: string;
    joined_at: string;
}

interface Match {
    id: string;
    match_type: string;
    status: string;
    winner_team: string | null;
    alpha_score: number;
    bravo_score: number;
    map_name: string;
    created_at: string;
    updated_at: string;
}

interface ClanProfile {
    id: string;
    name: string;
    tag: string;
    logo_url?: string | null;
    elo: number;
    leader_id: string;
    max_members: number;
    created_at: string;
    leader: {
        id: string;
        username: string;
        avatar: string | null;
    } | null;
    memberCount: number;
    stats: {
        totalMatches: number;
        wins: number;
        losses: number;
        winRate: number;
        avgElo: number;
    };
}

interface ClanProfilePageProps {
    backendUrl: string;
    clanId: string;
    onBack: () => void;
    onManage?: () => void;
}

export default function ClanProfilePage({ backendUrl, clanId, onBack, onManage }: ClanProfilePageProps) {
    const { user } = useAuth();
    const [clan, setClan] = useState<ClanProfile | null>(null);
    const [members, setMembers] = useState<ClanMember[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchClanProfile();
    }, [clanId]);

    const fetchClanProfile = async () => {
        if (!clanId) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${backendUrl}/api/clans/${clanId}/profile`);
            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to fetch clan profile');
            }

            setClan(data.clan);
            setMembers(data.members || []);
            setMatches(data.recentMatches || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getEloColor = (elo: number) => {
        if (elo >= 1600) return 'text-yellow-500';
        if (elo >= 1200) return 'text-gray-400';
        return 'text-orange-700';
    };

    const getEloRank = (elo: number) => {
        if (elo >= 1600) return { label: 'Gold', color: 'bg-gradient-to-r from-yellow-400 to-yellow-600' };
        if (elo >= 1200) return { label: 'Silver', color: 'bg-gradient-to-r from-gray-300 to-gray-500' };
        return { label: 'Bronze', color: 'bg-gradient-to-r from-orange-600 to-orange-800' };
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black flex items-center justify-center">
                <div className="text-white text-xl">Loading clan profile...</div>
            </div>
        );
    }

    if (error || !clan) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black flex items-center justify-center">
                <Card className="bg-zinc-950/50 border-red-500/20 max-w-md">
                    <CardContent className="p-8 text-center">
                        <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-white mb-2">Clan Not Found</h2>
                        <p className="text-gray-400 mb-4">{error || 'This clan does not exist.'}</p>
                        <Button onClick={onBack} variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Clans
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const rank = getEloRank(clan.elo);

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white">
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                {/* Back Button */}
                <div className="flex justify-between items-center mb-6">
                    <Button
                        variant="ghost"
                        onClick={onBack}
                        className="text-gray-400 hover:text-white"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Clans
                    </Button>

                    {user && clan && user.id === clan.leader_id && (
                        <Button variant="outline" className="border-primary text-primary hover:bg-primary/10" onClick={onManage || onBack}>
                            <Settings className="mr-2 h-4 w-4" /> Manage Clan
                        </Button>
                    )}
                </div>

                {/* Clan Header */}
                <div className="relative mb-8 p-8 rounded-xl bg-gradient-to-r from-purple-900/20 via-zinc-900/50 to-zinc-950/50 border border-white/10 overflow-hidden">
                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5"></div>
                    <div className="relative z-10">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="h-24 w-24 rounded-full bg-purple-500/20 border-2 border-purple-500/50 overflow-hidden flex items-center justify-center relative">
                                    {clan.logo_url ? (
                                        <img src={clan.logo_url} alt={clan.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <Shield className="h-12 w-12 text-purple-500" />
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h1 className="text-4xl font-bold font-display">{clan.name}</h1>
                                        <Badge className="text-lg px-3 py-1 bg-purple-500/20 text-purple-400 border-purple-500/50">
                                            [{clan.tag}]
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-4 text-gray-400">
                                        <div className="flex items-center gap-2">
                                            <Crown className="h-4 w-4 text-yellow-500" />
                                            <span>{clan.leader?.username || 'Unknown'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            <span>Since {new Date(clan.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <div className={cn("text-5xl font-bold font-mono", getEloColor(clan.elo))}>
                                    {clan.elo}
                                </div>
                                <Badge className={cn("text-sm px-3 py-1", rank.color, "text-white border-none")}>
                                    {rank.label} Tier
                                </Badge>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <Card className="bg-zinc-950/50 border-white/10 hover:border-purple-500/50 transition-all">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Members
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{clan.memberCount}/{clan.max_members}</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-950/50 border-white/10 hover:border-green-500/50 transition-all">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                                <Trophy className="h-4 w-4" />
                                Win Rate
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-green-500">{clan.stats.winRate}%</div>
                            <p className="text-xs text-gray-500">{clan.stats.wins}W - {clan.stats.losses}L</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-950/50 border-white/10 hover:border-cyan-500/50 transition-all">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Avg Elo
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={cn("text-3xl font-bold font-mono", getEloColor(clan.stats.avgElo))}>
                                {clan.stats.avgElo}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-950/50 border-white/10 hover:border-orange-500/50 transition-all">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                                <Swords className="h-4 w-4" />
                                Matches
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{clan.stats.totalMatches}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Members Roster */}
                <Card className="bg-zinc-950/50 border-white/10 mb-8">
                    <CardHeader>
                        <CardTitle className="text-2xl font-display flex items-center gap-2">
                            <Users className="h-6 w-6 text-purple-500" />
                            Roster
                        </CardTitle>
                        <CardDescription>All clan members and their statistics</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader className="bg-zinc-900/50">
                                <TableRow className="border-white/10 hover:bg-transparent">
                                    <TableHead className="text-gray-400">Player</TableHead>
                                    <TableHead className="text-gray-400">Nickname</TableHead>
                                    <TableHead className="text-gray-400">Role</TableHead>
                                    <TableHead className="text-gray-400 text-right">Elo</TableHead>
                                    <TableHead className="text-gray-400 text-right">W/L</TableHead>
                                    <TableHead className="text-gray-400 text-right">Joined</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {members.map((member) => (
                                    <TableRow key={member.id} className="border-white/5 hover:bg-white/5">
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10">
                                                    <AvatarImage src={`https://cdn.discordapp.com/avatars/${member.id}/${member.discord_avatar}.png`} />
                                                    <AvatarFallback>{member.discord_username[0]?.toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-white">{member.discord_username}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-gray-400">{member.standoff_nickname || '-'}</TableCell>
                                        <TableCell>
                                            {member.role === 'leader' ? (
                                                <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50">
                                                    <Crown className="h-3 w-3 mr-1" /> Leader
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-gray-400">Member</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className={cn("text-right font-mono font-bold", getEloColor(member.elo))}>
                                            {member.elo}
                                        </TableCell>
                                        <TableCell className="text-right text-gray-400">
                                            {member.wins}/{member.losses}
                                        </TableCell>
                                        <TableCell className="text-right text-gray-500 text-sm">
                                            {new Date(member.joined_at).toLocaleDateString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Match History */}
                <Card className="bg-zinc-950/50 border-white/10">
                    <CardHeader>
                        <CardTitle className="text-2xl font-display flex items-center gap-2">
                            <Swords className="h-6 w-6 text-orange-500" />
                            Recent Matches
                        </CardTitle>
                        <CardDescription>Last 10 clan matches</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {matches.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <Swords className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>No matches played yet</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {matches.map((match) => (
                                    <div
                                        key={match.id}
                                        className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 border border-white/5 hover:border-white/10 transition-all"
                                    >
                                        <div className="flex items-center gap-4">
                                            <Badge
                                                className={cn(
                                                    "px-3 py-1",
                                                    match.status === 'completed'
                                                        ? match.winner_team === 'alpha'
                                                            ? 'bg-green-500/20 text-green-500 border-green-500/50'
                                                            : 'bg-red-500/20 text-red-500 border-red-500/50'
                                                        : 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50'
                                                )}
                                            >
                                                {match.status === 'completed' ? (match.winner_team === 'alpha' ? 'Win' : 'Loss') : 'Pending'}
                                            </Badge>
                                            <div>
                                                <div className="font-bold text-white">
                                                    {match.alpha_score} - {match.bravo_score}
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                                    <MapPin className="h-3 w-3" />
                                                    {match.map_name}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <Clock className="h-3 w-3" />
                                            {new Date(match.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
