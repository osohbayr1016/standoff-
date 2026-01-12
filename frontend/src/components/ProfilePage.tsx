import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
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
import { LogOut, Swords, Trophy, X, Check, Users, ImageIcon, ArrowLeft, Play } from "lucide-react";
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
  match_id: string;
  map_name?: string;
  winner_team?: string;
  player_team?: string;
  alpha_score?: number;
  bravo_score?: number;
  created_at: string;
  elo_change?: number;
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
  targetUserId?: string;
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
  'Sakura': '/maps/hanami.png',
  'Provence': '/maps/breeze.png',
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
  const [showCasualHistory, setShowCasualHistory] = useState(false);
  const [casualMatches, setCasualMatches] = useState<MatchHistoryItem[]>([]);
  const [loadingCasualHistory, setLoadingCasualHistory] = useState(false);
  const [sendingFriendRequest, setSendingFriendRequest] = useState(false);
  const [friendRequestSent, setFriendRequestSent] = useState(false);

  const profileId = targetUserId || user?.id;
  const isOwnProfile = user?.id === profileId;

  useEffect(() => {
    if (profileId) {
      fetchProfile(profileId);
      setAvatarError(false);
    }
  }, [profileId]);

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

  const handleSendFriendRequest = async () => {
    if (!user || !profileId || isOwnProfile) return;

    setSendingFriendRequest(true);
    setFriendRequestSent(false);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/friends/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, targetId: profileId }),
        }
      );

      if (res.ok) {
        setFriendRequestSent(true);
        setSuccessMsg("Friend request sent!");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to send friend request");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setSendingFriendRequest(false);
    }
  };

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
  const isWin = (match: MatchHistoryItem) => match.winner_team === match.player_team;

  return (
    <div className="min-h-screen bg-[#0E0F12] text-white font-sans selection:bg-[#ff5500] selection:text-white pb-20">

      {/* 0. Top Navigation / Back Button */}
      <div className="absolute top-4 left-4 z-50">
        <Button
          onClick={onBack || (() => window.history.back())}
          variant="outline"
          size="icon"
          className="rounded-full bg-black/40 border-white/10 text-white hover:bg-black/60 backdrop-blur-md"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* 1. Header Section: Faceit Style Banner & Avatar */}
      <div className="relative min-h-[19rem] md:h-80 w-full overflow-hidden bg-[#121418]">
        {/* Banner Image / Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#121418] via-[#1E2126] to-[#121418]" />

        {/* Abstract Background Elements (Lines/Grid) */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />

        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#0E0F12] to-transparent z-10" />

        {/* Header Content Container */}
        <div className="relative z-20 max-w-7xl mx-auto px-4 md:px-6 flex flex-col justify-end pb-6 md:pb-8 pt-24 md:pt-0 md:h-full">
          <div className="flex flex-col items-center md:flex-row md:items-end gap-6 md:gap-8">

            {/* Avatar - Hexagon or Square with border */}
            <div className="relative shrink-0 group">
              <div className="h-28 w-28 md:h-40 md:w-40 bg-[#1e2024] rounded border-4 border-[#2d2f33] shadow-2xl relative overflow-hidden group-hover:border-[#ff5500] transition-colors duration-300">
                <Avatar className="h-full w-full rounded-none">
                  <AvatarImage
                    src={!avatarError && profile?.discord_avatar
                      ? `https://cdn.discordapp.com/avatars/${profile?.discord_id}/${profile?.discord_avatar}.png`
                      : undefined}
                    onError={() => setAvatarError(true)}
                    className="object-cover h-full w-full"
                  />
                  <AvatarFallback className="text-3xl md:text-4xl bg-[#1e2024] text-[#ff5500] font-black rounded-none">
                    {profile?.standoff_nickname?.[0]?.toUpperCase() || profile?.discord_username?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Online Dot */}
              <div className="absolute -top-2 -right-2 h-5 w-5 md:h-6 md:w-6 bg-[#0E0F12] rounded-full flex items-center justify-center p-1">
                <div className="h-full w-full bg-green-500 rounded-full shadow-[0_0_10px_#22c55e]" />
              </div>
            </div>

            {/* Profile Text Info */}
            <div className="flex-1 mb-2 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 md:gap-4 mb-2">
                <h1 className="text-3xl md:text-6xl font-black italic tracking-tighter text-white uppercase">
                  {profile?.standoff_nickname || profile?.discord_username || "Unknown"}
                </h1>

                {/* VIP Badge */}
                {!!profile?.is_vip && (
                  <div className="flex flex-col items-center">
                    <div className="bg-[#ffcc00] text-black text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded skew-x-[-10deg]">
                      VIP
                    </div>
                    {profile.vip_until && (
                      <span className="text-[9px] text-[#ffcc00] font-bold mt-1 uppercase tracking-wider">
                        Exp: {new Date(profile.vip_until).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                )}

                {/* Verified Badge */}
                {profile?.is_discord_member && (
                  <div className="bg-[#5865F2] text-white p-1 rounded-full shadow-lg" title="Verified Discord Member">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center md:justify-start gap-4 md:gap-6 text-xs md:text-sm text-[#9ca3af] font-bold uppercase tracking-wider mb-2">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff5500]" />
                  ID: {profile?.id.substring(0, 8)}
                </span>
                {profile?.discord_username && (
                  <span className="flex items-center gap-2">
                    <span className="hidden md:inline opacity-50">DISCORD:</span>
                    <span className="md:hidden opacity-50">DSC:</span> {profile.discord_username}
                  </span>
                )}
              </div>

              {/* Status Messages */}
              {error && <p className="text-red-500 text-xs font-bold uppercase tracking-widest animate-pulse">{error}</p>}
              {successMsg && <p className="text-green-500 text-xs font-bold uppercase tracking-widest">{successMsg}</p>}
            </div>

            {/* Header Actions */}
            <div className="flex flex-wrap justify-center gap-2 md:gap-3 mb-2 w-full md:w-auto">
              {isOwnProfile ? (
                <>
                  <Button
                    onClick={onFindMatch}
                    className="bg-[#ff5500] hover:bg-[#e64d00] text-white font-black uppercase tracking-wider rounded-sm h-10 px-6 shadow-lg shadow-[#ff5500]/20 flex-1 md:flex-none"
                  >
                    <Play className="mr-2 h-4 w-4" /> Play
                  </Button>
                  <Button
                    onClick={() => setIsEditing(true)}
                    variant="outline"
                    size="sm"
                    className="bg-[#2d2f33] border-none text-white hover:bg-[#3d4045] font-bold uppercase tracking-wide rounded-sm h-10 px-4 md:px-6 flex-1 md:flex-none"
                  >
                    Edit
                  </Button>
                  <Button
                    onClick={() => setShowLogoutConfirm(true)}
                    variant="outline"
                    size="sm"
                    className="bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20 hover:text-red-400 font-bold uppercase tracking-wide rounded-sm h-10 px-3"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                user && !isOwnProfile && (
                  <Button
                    onClick={handleSendFriendRequest}
                    disabled={sendingFriendRequest || friendRequestSent}
                    className="bg-[#ff5500] hover:bg-[#e64d00] text-white font-black uppercase tracking-wider rounded-sm h-10 px-6 shadow-lg shadow-[#ff5500]/20 w-full md:w-auto"
                  >
                    {friendRequestSent ? 'Sent' : 'Add Friend'}
                  </Button>
                )
              )}
            </div>

          </div>
        </div>
      </div>

      {/* 2. Main Layout: Left/Right Columns */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8 grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">

        {/* LEFT Column: Stats & Progress (Span 3 on large screens) */}
        <div className="lg:col-span-3 space-y-6 md:space-y-8">

          {/* Elo Progress Bar Component */}
          <EloProgressBar
            elo={profile?.elo || 1000}
            totalMatches={totalMatches}
            className="border border-white/5 bg-[#121418]"
          />

          {/* Tab Navigation (Visual Only for now) */}
          <div className="flex items-center border-b border-white/10 mb-4 md:mb-6 overflow-x-auto">
            <button className="px-4 md:px-6 py-3 md:py-4 text-[#ff5500] font-black uppercase tracking-wider border-b-2 border-[#ff5500] text-xs md:text-base whitespace-nowrap">
              Overview
            </button>
            <button className="px-4 md:px-6 py-3 md:py-4 text-[#555] font-bold uppercase tracking-wider hover:text-white transition-colors text-xs md:text-base whitespace-nowrap" onClick={() => setShowCasualHistory(true)}>
              Casual Matches
            </button>
          </div>

          {/* Stats Overview Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Win Rate Stats */}
            <Card className="bg-[#121418] border-none rounded-none border-l-2 border-[#ff5500] p-4 md:p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-[#9ca3af] font-bold uppercase tracking-widest text-xs mb-1">Win Rate</h3>
                  <p className="text-3xl font-black text-white italic">{winRate}%</p>
                </div>
                <div className="h-10 w-10 text-[#ff5500]">
                  <Trophy className="h-full w-full opacity-20" />
                </div>
              </div>
              <div className="w-full bg-[#1e2024] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#ff5500] h-full" style={{ width: `${winRate}%` }} />
              </div>
              <p className="text-[10px] text-[#555] mt-2 font-bold uppercase">Based on last {totalMatches} matches</p>
            </Card>

            <Card className="bg-[#121418] border-none rounded-none border-l-2 border-[#5b9bd5] p-4 md:p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-[#9ca3af] font-bold uppercase tracking-widest text-xs mb-1">Matches</h3>
                  <p className="text-3xl font-black text-white italic">{totalMatches}</p>
                </div>
                <div className="h-10 w-10 text-[#5b9bd5]">
                  <Swords className="h-full w-full opacity-20" />
                </div>
              </div>
              <div className="flex gap-2 text-sm font-bold">
                <span className="text-green-500">{profile?.wins} Wins</span>
                <span className="text-white/20">|</span>
                <span className="text-red-500">{profile?.losses} Losses</span>
              </div>
            </Card>
          </div>

          {/* Match History Table */}
          <div className="space-y-4 pt-2 md:pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black uppercase italic text-xl">Recent Matches</h3>
            </div>

            <div className="bg-[#121418] overflow-hidden rounded-sm border border-white/5">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[#181a1e] border-b border-white/5">
                    <TableRow className="border-none hover:bg-transparent">
                      <TableHead className="w-[80px] md:w-[100px] text-[#555] font-bold uppercase text-[10px] tracking-widest pl-4">Result</TableHead>
                      <TableHead className="text-[#555] font-bold uppercase text-[10px] tracking-widest">Score</TableHead>
                      <TableHead className="text-[#555] font-bold uppercase text-[10px] tracking-widest">Map</TableHead>
                      <TableHead className="text-[#555] font-bold uppercase text-[10px] tracking-widest text-right pr-6">Elo</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profile?.matches && profile.matches.length > 0 ? (
                      profile.matches.map((match) => {
                        const won = isWin(match);
                        return (
                          <TableRow
                            key={match.match_id}
                            className="border-b border-white/5 bg-[#121418] hover:bg-[#1e2024] transition-colors cursor-pointer group"
                            onClick={() => fetchMatchDetails(match.match_id)}
                          >
                            <TableCell className="pl-4 py-3">
                              <div className={`
                                          inline-flex items-center justify-center w-8 h-8 rounded-sm font-black text-xs uppercase
                                          ${won ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}
                                       `}>
                                {won ? 'W' : 'L'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono font-bold text-white text-base md:text-lg tracking-tight whitespace-nowrap">
                                {match.alpha_score} : {match.bravo_score}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-12 rounded-sm bg-[#1e2024] overflow-hidden relative shrink-0">
                                  <img
                                    src={MAP_IMAGES[match.map_name || 'Sandstone'] || '/maps/sandstone.png'}
                                    className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity"
                                  />
                                </div>
                                <span className="font-bold text-sm text-[#ccc] group-hover:text-white uppercase tracking-wide whitespace-nowrap">
                                  {match.map_name || 'Map'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <span className={`font-black text-sm ${match.elo_change && match.elo_change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {match.elo_change ? (match.elo_change > 0 ? '+' : '') + match.elo_change : '-'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity">
                                <ArrowLeft className="h-4 w-4 rotate-180" />
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-[#555] text-sm uppercase font-bold tracking-widest border-none">
                          No Matches Played
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT Column: Friends / Sidebar (Span 1) - Can be added later. For now just placeholder or empty to center the rest */}
        <div className="hidden lg:block space-y-6">
          {/* Could add 'Friends' list or 'Similar Players' here later */}
          <div className="bg-[#121418] p-6 border border-white/5 min-h-[200px] flex items-center justify-center text-center">
            <div className="space-y-2">
              <div className="text-[#333] font-black uppercase text-4xl italic">AD</div>
              <p className="text-[#555] text-xs font-bold uppercase tracking-widest">Advertisement Space</p>
            </div>
          </div>
        </div>

      </div>

      {/* Legacy Dialogs (Edit, MatchDetails) */}

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="bg-[#1e2024] border-[#2d2f33] text-white">
          <DialogHeader>
            <DialogTitle>Edit Nickname</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              className="bg-[#121418] border-[#2d2f33] text-white"
              placeholder="Enter nickname"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleSaveNickname} disabled={saving} className="bg-[#ff5500] hover:bg-[#e64d00]">
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Match Details Dialog Reused from before but styled */}
      <Dialog open={!!selectedMatch} onOpenChange={(open) => !open && setSelectedMatch(null)}>
        <DialogContent className="bg-[#1c1e22] border-[#ff5500]/20 text-white max-w-2xl overflow-hidden p-0 gap-0">
          {selectedMatch && (
            <>
              <Button variant="ghost" size="icon" className="absolute right-3 top-3 z-[100] text-white hover:bg-white/10" onClick={() => setSelectedMatch(null)}>
                <X className="h-5 w-5" />
              </Button>
              <div className="relative h-40 w-full overflow-hidden">
                <div className="absolute inset-0 bg-black/60 z-10" />
                <img src={selectedMatch.map_name ? MAP_IMAGES[selectedMatch.map_name] : '/maps/sandstone.png'} className="w-full h-full object-cover opacity-60" />
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
                  <h2 className="text-4xl font-black uppercase italic text-white">{selectedMatch.map_name}</h2>
                  <p className="text-[#9ca3af] font-bold uppercase tracking-widest text-xs mt-2">{new Date(selectedMatch.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="p-8">
                <div className="flex items-center justify-center gap-10">
                  <div className="text-center">
                    <span className="text-[#5b9bd5] font-black text-6xl block">{selectedMatch.alpha_score}</span>
                    <span className="text-[#5b9bd5] font-bold uppercase tracking-widest text-xs">Alpha</span>
                  </div>
                  <span className="text-2xl text-[#333] font-black">:</span>
                  <div className="text-center">
                    <span className="text-[#e74c3c] font-black text-6xl block">{selectedMatch.bravo_score}</span>
                    <span className="text-[#e74c3c] font-bold uppercase tracking-widest text-xs">Bravo</span>
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
                  </div>
                </div>
              </div>

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

      {/* Logout Confirm */}
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="bg-[#1e2024] border-[#2d2f33]">
          <DialogHeader>
            <DialogTitle className="text-white">Log Out?</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" className="text-[#9ca3af]" onClick={() => setShowLogoutConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={onLogout}>Log Out</Button>
          </DialogFooter>
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
                      return (
                        <TableRow key={match.match_id} className="border-white/5 hover:bg-white/5 transition-colors">
                          <TableCell className="p-2">
                            <div className="h-12 w-20 rounded overflow-hidden relative shadow-sm border border-white/10">
                              <img src={MAP_IMAGES[match.map_name || 'Sandstone'] || '/maps/sandstone.png'} className="h-full w-full object-cover opacity-80" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-white text-sm">{match.map_name || 'Unknown'}</span>
                              <span className="text-[10px] text-muted-foreground">{new Date(match.created_at).toLocaleDateString()}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={isWinner ? "default" : "destructive"} className="uppercase text-[10px] font-bold tracking-wider px-2 py-0.5">
                              {isWinner ? "Win" : "Loss"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-mono font-bold text-sm text-white/80">
                              {match.alpha_score ?? '-'} : {match.bravo_score ?? '-'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-xs text-muted-foreground italic">Casual</span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                        No casual matches found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter className="p-6 pt-2 border-t border-white/5">
            <Button onClick={() => setShowCasualHistory(false)} variant="ghost">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
