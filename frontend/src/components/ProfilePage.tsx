import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { LogOut, Swords, Trophy, Target, Pencil, X, Check, Users, ImageIcon, ArrowLeft } from "lucide-react";
import LevelBadge from "./LevelBadge";
import EloProgressBar from "./EloProgressBar";
import { VerifiedBadge } from "./VerifiedBadge";

interface User {
  id: string;
  username: string;
  avatar: string;
  is_vip?: number | boolean;
  vip_until?: string;
  role?: string;
}

interface MatchHistoryItem {
  match_id: string; // Add match_id for key
  map_name?: string;
  winner_team?: string;
  player_team?: string;
  alpha_score?: number;
  bravo_score?: number;
  created_at: string;
  elo_change?: number; // Added from backend
  result_screenshot_url?: string;
  status?: string;
  match_type?: 'casual' | 'league';
}

interface ProfileData {
  id: string;
  discord_id: string;
  discord_username: string;
  discord_avatar?: string;
  standoff_nickname?: string;
  elo: number;
  wins: number;
  losses: number;
  is_discord_member?: boolean;
  is_vip?: number | boolean;
  vip_until?: string;
  matches?: MatchHistoryItem[];
}

interface MatchPlayer {
  player_id: string;
  discord_username: string;
  discord_avatar?: string;
  standoff_nickname?: string;
  elo: number;
  team: 'alpha' | 'bravo';
  is_discord_member?: boolean;
}

interface MatchDetails {
  id: string;
  map_name?: string;
  winner_team?: string;
  alpha_score?: number;
  bravo_score?: number;
  result_screenshot_url?: string;
  created_at: string;
  players: MatchPlayer[];
}

interface ProfilePageProps {
  user: User | null;
  targetUserId?: string; // Optional: ID of the user to view. If null, use logged-in user.
  onFindMatch: () => void;
  onLogout: () => void;
  onBack?: () => void;
}

const MAP_IMAGES: Record<string, string> = {
  'Hanami': '/maps/hanami.png',
  'Sandstone': '/maps/sandstone.png',
  'Breeze': '/maps/breeze.png',
  'Dune': '/maps/dune.jpg',
  'Dust': '/maps/dust.jpg',
  'Rust': '/maps/rust.jpg',
  'Zone 7': '/maps/zone7.jpg',
  'Sakura': '/maps/hanami.png', // Fallback
  'Provence': '/maps/breeze.png', // Fallback
};

export default function ProfilePage({
  user,
  targetUserId,
  onFindMatch,
  onLogout,
  onBack,
}: ProfilePageProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchDetails | null>(null);
  const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null);
  const [showCasualHistory, setShowCasualHistory] = useState(false);
  const [casualMatches, setCasualMatches] = useState<MatchHistoryItem[]>([]);
  const [loadingCasualHistory, setLoadingCasualHistory] = useState(false);

  // Determine which user ID to fetch (target or logged-in)
  const profileId = targetUserId || user?.id;
  const isOwnProfile = user?.id === profileId;

  useEffect(() => {
    if (profileId) {
      fetchProfile(profileId);
      fetchLeaderboardRank(profileId);
      setAvatarError(false);
    }
  }, [profileId]);

  const fetchLeaderboardRank = async (id: string) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/leaderboard`
      );
      if (res.ok) {
        const leaderboard = await res.json();
        const playerIndex = leaderboard.findIndex((p: any) => p.id === id);
        if (playerIndex !== -1) {
          setLeaderboardRank(leaderboard[playerIndex].rank);
        } else {
          setLeaderboardRank(null);
        }
      }
    } catch (err) {
      console.error("Error fetching leaderboard rank:", err);
    }
  };

  const fetchProfile = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/profile/${id}`
      );

      let profileData: any = {};

      if (res.ok) {
        profileData = await res.json();
      }

      try {
        const matchesRes = await fetch(
          `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/profile/${id}/matches`
        );
        if (matchesRes.ok) {
          const matchesData = await matchesRes.json();
          profileData.matches = matchesData.matches || [];
        }
      } catch (e) {
        console.error("Failed to fetch matches", e);
      }

      if (profileData.id) {
        setProfile(profileData);
        setNewNickname(profileData.standoff_nickname || "");
        setAvatarError(false);
      } else {
        console.error("Failed to fetch profile");
        setError("User not found");
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNickname = async () => {
    if (!user?.id || !isOwnProfile) return;
    setError(null);
    setSuccessMsg(null);
    setSaving(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/profile/nickname`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, nickname: newNickname }),
        }
      );

      const data = await res.json();

      if (res.ok) {
        setProfile((prev) =>
          prev ? { ...prev, standoff_nickname: data.nickname } : null
        );
        setSuccessMsg("Nickname updated successfully!");
        setIsEditing(false);
      } else {
        if (data.details) {
          setError(data.details[0].message);
        } else {
          setError(data.error || "Failed to update nickname");
        }
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const fetchMatchDetails = async (matchId: string) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/matches/${matchId}`
      );
      if (res.ok) {
        const data = await res.json();
        setSelectedMatch({
          id: data.match.id,
          map_name: data.match.map_name,
          winner_team: data.match.winner_team,
          alpha_score: data.match.alpha_score,
          bravo_score: data.match.bravo_score,
          result_screenshot_url: data.match.result_screenshot_url,
          created_at: data.match.created_at,
          players: data.players || []
        });
      }
    } catch (err) {
      console.error("Failed to fetch match details:", err);
    }
  };

  const fetchCasualMatches = async () => {
    if (!profileId) return;
    setLoadingCasualHistory(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/profile/${profileId}/matches?type=casual`
      );
      if (res.ok) {
        const data = await res.json();
        setCasualMatches(data.matches || []);
      }
    } catch (err) {
      console.error("Failed to fetch casual matches:", err);
    } finally {
      setLoadingCasualHistory(false);
    }
  };

  useEffect(() => {
    if (showCasualHistory && profileId) {
      fetchCasualMatches();
    }
  }, [showCasualHistory, profileId]);

  if (!user && !targetUserId) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Please log in to view profiles.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const winRate = profile
    ? profile.wins + profile.losses > 0
      ? ((profile.wins / (profile.wins + profile.losses)) * 100).toFixed(1)
      : "0.0"
    : "0.0";
  const totalMatches = profile ? profile.wins + profile.losses : 0;

  // Rank Progress Calculation (Simple Linear for now)


  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto pb-12">
      {/* Back Button */}
      <div className="flex items-center mb-2">
        <Button
          onClick={onBack || (() => window.history.back())}
          variant="ghost"
          size="icon"
          className="rounded-full hover:bg-muted h-10 w-10"
          title="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* Glass Header Profile Card */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl border border-white/10 group">
        {/* Blurred Avatar Background */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 blur-2xl scale-110 transition-transform duration-700 group-hover:scale-105"
          style={{
            backgroundImage: !avatarError && profile?.discord_avatar
              ? `url('https://cdn.discordapp.com/avatars/${profile?.discord_id}/${profile?.discord_avatar}.png')`
              : undefined
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#121418] via-[#121418]/80 to-transparent" />
        <div className="absolute inset-0 bg-black/40" />

        <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row gap-8 items-center md:items-start">

          {/* Main Avatar with Verified Overlay */}
          <div className="relative shrink-0">
            <div className="relative h-40 w-40 md:h-48 md:w-48 rounded-full overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] border-4 border-white/5 group-hover:border-[#ff5500]/30 transition-colors duration-500">
              <Avatar className="h-full w-full rounded-full">
                <AvatarImage
                  src={!avatarError && profile?.discord_avatar
                    ? `https://cdn.discordapp.com/avatars/${profile?.discord_id}/${profile?.discord_avatar}.png`
                    : undefined}
                  onError={() => setAvatarError(true)}
                  className="object-cover h-full w-full"
                />
                <AvatarFallback className="text-6xl bg-[#1a1c20] text-white/20 font-black rounded-full">
                  {profile?.standoff_nickname?.[0]?.toUpperCase() || profile?.discord_username?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Verified Badge - Now purely an icon overlay */}
            {profile?.is_discord_member && (
              <div className="absolute -bottom-3 -right-3 bg-[#5865F2] text-white p-1.5 rounded-full border-4 border-[#121418] shadow-lg">
                <Check className="w-5 h-5 stroke-[4px]" />
              </div>
            )}

            {/* Online Indicator */}
            <div className="absolute top-4 right-4 h-4 w-4 bg-green-500 rounded-full border-2 border-[#1a1c20] shadow-[0_0_15px_theme(colors.green.500)] animate-pulse"></div>
          </div>

          {/* Profile Info */}
          <div className="flex-1 text-center md:text-left space-y-4 pt-2">
            <div className="space-y-2">
              {/* Identity Chips */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <div className="bg-white/5 hover:bg-white/10 transition-colors border border-white/5 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[#888] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5865F2]" />
                  ID: {profile?.id.substring(0, 8)}
                </div>
              </div>

              {isEditing && isOwnProfile ? (
                <div className="flex items-center gap-2 max-w-sm mx-auto md:mx-0 p-2 bg-black/40 rounded-xl backdrop-blur-md border border-white/10">
                  <Input
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                    className="bg-transparent border-0 text-2xl font-black text-white focus-visible:ring-0 placeholder:text-white/20"
                    placeholder="Enter Standoff 2 Nickname"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-10 w-10 text-green-500 hover:bg-green-500/20 rounded-lg" onClick={handleSaveNickname} disabled={saving}>
                    <Check className="h-6 w-6" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-10 w-10 text-red-500 hover:bg-red-500/20 rounded-lg" onClick={() => setIsEditing(false)}>
                    <X className="h-6 w-6" />
                  </Button>
                </div>
              ) : (
                <div className="group/name relative inline-block">
                  <h1 className="text-5xl md:text-7xl font-black font-display tracking-tighter text-white drop-shadow-2xl flex items-center gap-4 flex-wrap">
                    {profile?.standoff_nickname || profile?.discord_username || "Unknown Player"}

                    {/* VIP Badge After Name */}
                    {!!profile?.is_vip && (
                      <div className="flex flex-col items-start gap-0.5">
                        <div className="bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-600 text-black px-3 py-1 rounded text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(234,179,8,0.4)] flex items-center gap-1.5 animate-pulse transform skew-x-[-10deg]">
                          <Trophy className="w-3 h-3 fill-black" />
                          <span className="skew-x-[10deg]">VIP</span>
                        </div>
                        {profile.vip_until && (
                          <span className="text-[10px] text-yellow-500/80 font-bold uppercase tracking-widest ml-1">
                            Expires: {new Date(profile.vip_until).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </h1>
                  {isOwnProfile && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="absolute -right-8 top-2 opacity-0 group-hover/name:opacity-100 transition-all text-white/20 hover:text-[#ff5500]"
                    >
                      <Pencil className="w-6 h-6" />
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-center md:justify-start gap-4 text-sm font-medium text-[#888]">
                <span className="flex items-center gap-1.5 hover:text-[#5865F2] transition-colors cursor-default">
                  <span className="w-5 h-5 flex items-center justify-center bg-[#5865F2] rounded-full text-white text-[10px] font-black">D</span>
                  @{profile?.discord_username}
                </span>
                {profile?.standoff_nickname && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                    <span className="hover:text-white transition-colors cursor-default">
                      Standoff 2 ID
                    </span>
                  </>
                )}
              </div>

              {error && <p className="text-sm text-red-500 font-bold animate-pulse bg-red-500/10 px-3 py-1 rounded inline-block">{error}</p>}
              {successMsg && <p className="text-sm text-green-500 font-bold bg-green-500/10 px-3 py-1 rounded inline-block">{successMsg}</p>}
            </div>
          </div>

          {/* Actions & Rank */}
          <div className="flex flex-col gap-6 items-center md:items-end">
            {/* Leaderboard Rank Section */}
            {leaderboardRank !== null && (
              <div className="flex-shrink-0 text-center md:text-right">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Leaderboard Rank
                  </div>
                  <div className="text-4xl md:text-5xl font-black font-display tracking-tighter text-primary">
                    #{leaderboardRank}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">
                    Top {Math.round((leaderboardRank / 500) * 100)}%
                  </div>
                  <div className="flex justify-end pt-2">
                    <LevelBadge elo={profile?.elo || 1000} className="scale-75 origin-right" />
                  </div>
                </div>
              </div>
            )}

            {/* Fallback for when no leaderboard rank - show Level Badge */}
            {leaderboardRank === null && (
              <div className="hidden md:block">
                <LevelBadge elo={profile?.elo || 1000} />
              </div>
            )}

            {isOwnProfile && (
              <div className="flex gap-3">
                <Button onClick={onFindMatch} className="h-12 px-6 bg-[#ff5500] hover:bg-[#ff5500]/90 text-white font-black uppercase tracking-wider text-sm shadow-xl shadow-[#ff5500]/20 rounded-xl transition-all hover:scale-105 active:scale-95">
                  <Swords className="mr-2 h-4 w-4" /> Play
                </Button>
                <Button variant="outline" className="h-12 w-12 rounded-xl border-white/10 bg-white/5 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500 p-0" onClick={() => setShowLogoutConfirm(true)}>
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <EloProgressBar elo={profile?.elo || 1000} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card/50 border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-[0.15em]">Recent Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative h-20 w-20 flex items-center justify-center shrink-0">
                {/* Custom SVG Ring Chart */}
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <path className="text-secondary stroke-current" strokeWidth="2.5" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="text-primary stroke-current drop-shadow-[0_0_3px_theme(colors.orange.500)]" strokeDasharray={`${winRate}, 100`} strokeWidth="2.5" strokeLinecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-white">
                  {winRate}%
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-bold text-white tracking-tight">{profile?.wins}W - {profile?.losses}L</div>
                <p className="text-xs text-muted-foreground font-medium">Win / Loss Ratio</p>
                <div className="flex gap-1.5">
                  {/* Tiny visual history boxes if we had simple W/L array, using matches for now */}
                  {profile?.matches?.slice(0, 5).map((m, i) => {
                    const isWin = m.winner_team === m.player_team;
                    return (
                      <div key={i} className={`h-1.5 w-1.5 rounded-full ${isWin ? 'bg-green-500 shadow-[0_0_5px_theme(colors.green.500)]' : 'bg-red-500'}`} />
                    )
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-[0.15em]">Total Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[inset_0_0_15px_theme(colors.orange.500/20)]">
                <Target className="h-7 w-7" />
              </div>
              <div>
                <div className="text-3xl font-bold text-white tracking-tight">{totalMatches}</div>
                <p className="text-xs text-muted-foreground font-medium">Matches Played</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Match History */}
      <Card className="bg-card/30 border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-primary" />
              <div className="flex flex-col">
                <span className="font-display font-bold uppercase tracking-wider text-xl">Recent Matches</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCasualHistory(true)}
              className="h-8 border-white/10 hover:bg-white/5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-white"
            >
              Casual History
            </Button>
          </CardTitle>
          <CardDescription>Last 20 competitive matches played</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="w-[80px]"></TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Map / Date</TableHead>
                <TableHead className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Result</TableHead>
                <TableHead className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Score</TableHead>
                <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-muted-foreground pr-6">ELO Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profile?.matches && profile.matches.length > 0 ? (
                profile.matches.map((match) => {
                  const isWinner = match.winner_team === match.player_team;

                  // Use map image or fallback
                  const mapImage = match.map_name && MAP_IMAGES[match.map_name] ? MAP_IMAGES[match.map_name] : '/maps/sandstone.png'; // Fallback

                  return (
                    <TableRow
                      key={match.match_id || Math.random().toString()}
                      className="border-white/5 hover:bg-white/5 transition-colors group cursor-pointer"
                      onClick={() => fetchMatchDetails(match.match_id)}
                    >
                      {/* Map Image Column */}
                      <TableCell className="p-2">
                        <div className="h-12 w-20 rounded overflow-hidden relative shadow-sm border border-white/10 group-hover:border-primary/30 transition-colors">
                          <img src={mapImage} alt={match.map_name} className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                        </div>
                      </TableCell>

                      {/* Map Name & Date */}
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-sm">{match.map_name || 'Unknown Map'}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(match.created_at).toLocaleDateString()}</span>
                        </div>
                      </TableCell>

                      {/* Result Badge */}
                      <TableCell className="text-center">
                        <Badge variant={isWinner ? "default" : "destructive"} className={`
                            ${isWinner
                            ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20"
                            : "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"} 
                            uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 border
                        `}>
                          {isWinner ? "VICTORY" : "DEFEAT"}
                        </Badge>
                      </TableCell>

                      {/* Score */}
                      <TableCell className="text-center">
                        <div className="font-mono font-bold text-sm text-white/80">
                          {match.alpha_score ?? '-'} : {match.bravo_score ?? '-'}
                        </div>
                      </TableCell>

                      {/* ELO Change */}
                      <TableCell className="text-right pr-6">
                        {match.elo_change !== undefined && match.elo_change !== null ? (
                          <span className={`font-mono font-bold ${match.elo_change > 0 ? 'text-green-500' : match.elo_change < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                            {match.elo_change > 0 ? '+' : ''}{match.elo_change}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic bg-muted/5">
                    No match history available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Logout Confirmation Dialog (Only relevant for own profile) */}
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="bg-card border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to sign out of your account?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowLogoutConfirm(false)} className="hover:bg-white/5">Cancel</Button>
            <Button variant="destructive" onClick={onLogout}>Sign Out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Match Details Dialog */}
      <Dialog open={!!selectedMatch} onOpenChange={(open) => !open && setSelectedMatch(null)}>
        <DialogContent className="bg-[#1c1e22] border-[#ff5500]/20 text-white max-w-2xl overflow-hidden p-0 gap-0">
          {selectedMatch && (
            <>
              {/* Close Button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 z-[100] text-white/80 hover:text-white hover:bg-white/10 rounded-sm h-10 w-10"
                onClick={() => setSelectedMatch(null)}
              >
                <X className="h-5 w-5" />
              </Button>

              {/* Header with Map Background */}
              <div className="relative h-32 md:h-40 w-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#18181b] z-10" />
                <div className="absolute inset-0 bg-black/40 z-0" />
                <img
                  src={selectedMatch.map_name && MAP_IMAGES[selectedMatch.map_name] ? MAP_IMAGES[selectedMatch.map_name] : '/maps/sandstone.png'}
                  alt={selectedMatch.map_name}
                  className="w-full h-full object-cover opacity-60 blur-[2px]"
                />

                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pt-4">
                  <Badge variant="outline" className="bg-black/50 border-white/20 text-white/80 uppercase tracking-widest text-[10px] mb-2 px-3 py-1 backdrop-blur-sm">
                    Competitive Match
                  </Badge>
                  <h2 className="text-3xl md:text-4xl font-black uppercase italic tracking-wider text-white drop-shadow-xl font-display">
                    {selectedMatch.map_name || 'Unknown Map'}
                  </h2>
                  <div className="flex items-center gap-2 text-xs font-semibold text-white/60 mt-1 uppercase tracking-wide">
                    <span>{new Date(selectedMatch.created_at).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>Lobby #{selectedMatch.id?.slice(0, 8)}</span>
                  </div>
                </div>
              </div>

              {/* Score Section */}
              <div className="relative z-20 -mt-10 px-4 md:px-6 pb-6">
                <div className="bg-[#1c1e22] border border-white/5 rounded-xl p-4 shadow-xl flex items-center justify-between max-w-xl mx-auto backdrop-blur-md">
                  {/* Alpha Score */}
                  <div className="flex flex-col items-center flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-[#5b9bd5]" />
                      <span className="text-xs font-bold uppercase tracking-widest text-[#5b9bd5]">Alpha</span>
                    </div>
                    <div className={`text-4xl md:text-5xl font-black font-mono ${selectedMatch.winner_team === 'alpha' ? 'text-white' : 'text-white/30'}`}>
                      {selectedMatch.alpha_score ?? '-'}
                    </div>
                  </div>

                  {/* VS / Score Divider */}
                  <div className="px-4 flex flex-col items-center">
                    {selectedMatch.winner_team ? (
                      <Badge className={`
                        ${selectedMatch.winner_team === 'alpha'
                          ? 'bg-[#5b9bd5] hover:bg-[#4a8ac0] text-white'
                          : 'bg-[#e74c3c] hover:bg-[#c0392b] text-white'}
                        font-bold uppercase tracking-wider text-[10px] px-3 py-1
                      `}>
                        {selectedMatch.winner_team === 'alpha' ? 'Alpha Won' : 'Bravo Won'}
                      </Badge>
                    ) : (
                      <span className="text-white/20 font-black text-xl">VS</span>
                    )}
                  </div>

                  {/* Bravo Score */}
                  <div className="flex flex-col items-center flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-widest text-[#e74c3c]">Bravo</span>
                      <div className="w-2 h-2 rounded-full bg-[#e74c3c]" />
                    </div>
                    <div className={`text-4xl md:text-5xl font-black font-mono ${selectedMatch.winner_team === 'bravo' ? 'text-white' : 'text-white/30'}`}>
                      {selectedMatch.bravo_score ?? '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Roster Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 md:px-6 pb-6">
                {/* Alpha Roster */}
                <div className="border border-white/5 rounded-lg overflow-hidden bg-[#18181b]">
                  <div className="bg-[#5b9bd5]/10 border-b border-[#5b9bd5]/10 p-3 flex items-center justify-between">
                    <h3 className="font-bold text-[#5b9bd5] uppercase tracking-wider text-xs flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" /> Team Alpha
                    </h3>
                    {selectedMatch.winner_team === 'alpha' && <Trophy className="w-3.5 h-3.5" />}
                  </div>
                  <div className="divide-y divide-white/5 p-2">
                    {selectedMatch.players.filter(p => p.team === 'alpha').map((player) => (
                      <div key={player.player_id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-md transition-colors group">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-white/10 ring-2 ring-transparent group-hover:ring-[#5b9bd5]/30 transition-all">
                            <AvatarImage src={player.discord_avatar ? `https://cdn.discordapp.com/avatars/${player.player_id}/${player.discord_avatar}.png` : undefined} />
                            <AvatarFallback className="text-[10px] bg-[#2a2d35] text-white/50">{player.standoff_nickname?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                              {player.standoff_nickname || player.discord_username}
                              <VerifiedBadge isVerified={player.is_discord_member} showText={false} className="w-3 h-3 text-[#5b9bd5]" />
                            </div>
                            {player.elo && <div className="text-[10px] text-white/40 font-mono">Rating: {player.elo}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {selectedMatch.players.filter(p => p.team === 'alpha').length === 0 && (
                      <div className="text-center py-4 text-xs text-white/20 italic">No players</div>
                    )}
                  </div>
                </div>

                {/* Bravo Roster */}
                <div className="border border-white/5 rounded-lg overflow-hidden bg-[#18181b]">
                  <div className="bg-[#e74c3c]/10 border-b border-[#e74c3c]/10 p-3 flex items-center justify-between">
                    <h3 className="font-bold text-[#e74c3c] uppercase tracking-wider text-xs flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" /> Team Bravo
                    </h3>
                    {selectedMatch.winner_team === 'bravo' && <Trophy className="w-3.5 h-3.5" />}
                  </div>
                  <div className="divide-y divide-white/5 p-2">
                    {selectedMatch.players.filter(p => p.team === 'bravo').map((player) => (
                      <div key={player.player_id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-md transition-colors group">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-white/10 ring-2 ring-transparent group-hover:ring-[#e74c3c]/30 transition-all">
                            <AvatarImage src={player.discord_avatar ? `https://cdn.discordapp.com/avatars/${player.player_id}/${player.discord_avatar}.png` : undefined} />
                            <AvatarFallback className="text-[10px] bg-[#2a2d35] text-white/50">{player.standoff_nickname?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                              {player.standoff_nickname || player.discord_username}
                              <VerifiedBadge isVerified={player.is_discord_member} showText={false} className="w-3 h-3 text-[#e74c3c]" />
                            </div>
                            {player.elo && <div className="text-[10px] text-white/40 font-mono">Rating: {player.elo}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {selectedMatch.players.filter(p => p.team === 'bravo').length === 0 && (
                      <div className="text-center py-4 text-xs text-white/20 italic">No players</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              {selectedMatch.result_screenshot_url && (
                <div className="bg-[#1c1e22] border-t border-white/5 px-4 md:px-6 py-4 flex justify-between items-center">
                  <span className="text-xs text-white/40 font-mono uppercase tracking-wide">Proof of Result</span>
                  <a
                    href={selectedMatch.result_screenshot_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="h-8 text-xs font-bold border-[#ff5500]/20 text-[#ff5500] hover:bg-[#ff5500]/10 hover:text-[#ff6a1a]">
                      <ImageIcon className="mr-2 h-3.5 w-3.5" /> View Screenshot
                    </Button>
                  </a>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Casual Match History Dialog */}
      <Dialog open={showCasualHistory} onOpenChange={setShowCasualHistory}>
        <DialogContent className="bg-[#121418] border-white/10 text-white max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-6 pb-2 border-b border-white/5">
            <DialogTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-wider">
              <Swords className="h-5 w-5 text-secondary" />
              Casual Match History
            </DialogTitle>
            <DialogDescription>
              Recent non-ranked casual matches. No ELO updates occur in these games.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 pt-0">
            {loadingCasualHistory ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-[#121418] sticky top-0 z-10">
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="w-[80px] bg-[#121418]"></TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-[#121418]">Map / Date</TableHead>
                    <TableHead className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground bg-[#121418]">Result</TableHead>
                    <TableHead className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground bg-[#121418]">Score</TableHead>
                    <TableHead className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground bg-[#121418]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {casualMatches && casualMatches.length > 0 ? (
                    casualMatches.map((match) => {
                      const isWinner = match.winner_team === match.player_team;
                      const mapImage = match.map_name && MAP_IMAGES[match.map_name] ? MAP_IMAGES[match.map_name] : '/maps/sandstone.png';

                      return (
                        <TableRow
                          key={match.match_id || Math.random().toString()}
                          className="border-white/5 hover:bg-white/5 transition-colors group"
                        >
                          <TableCell className="p-2">
                            <div className="h-10 w-16 rounded overflow-hidden relative shadow-sm border border-white/10">
                              <img src={mapImage} alt={match.map_name} className="h-full w-full object-cover" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-white text-sm">{match.map_name || 'Unknown Map'}</span>
                              <span className="text-[10px] text-muted-foreground">{new Date(match.created_at).toLocaleDateString()}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {match.winner_team ? (
                              <Badge variant={isWinner ? "default" : "secondary"} className={`
                                ${isWinner
                                  ? "bg-green-500/10 text-green-500 border-green-500/20"
                                  : "bg-white/5 text-muted-foreground border-white/10"} 
                                uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 border
                            `}>
                                {isWinner ? "VICTORY" : "Finished"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-white/10 text-muted-foreground text-[10px] uppercase">
                                Completed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="font-mono font-bold text-sm text-white/80">
                              {match.alpha_score ?? '-'} : {match.bravo_score ?? '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-white/10 rounded-full"
                              onClick={() => fetchMatchDetails(match.match_id)}
                            >
                              <ArrowLeft className="h-4 w-4 rotate-180" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic bg-muted/5">
                        No casual match history available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter className="p-4 border-t border-white/5 bg-[#121418]">
            <Button onClick={() => setShowCasualHistory(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
