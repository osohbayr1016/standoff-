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
import { LogOut, Swords, Trophy, Target, Pencil, X, Check, Users, ImageIcon } from "lucide-react";
import LevelBadge from "./LevelBadge";
import EloProgressBar from "./EloProgressBar";
import { VerifiedBadge } from "./VerifiedBadge";

interface User {
  id: string;
  username: string;
  avatar: string;
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

  // Determine which user ID to fetch (target or logged-in)
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
      {/* Header Profile Card */}
      <Card className="border-primary/20 bg-card/50 backdrop-blur-sm relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-primary/5 z-0" />

        <CardContent className="p-6 md:p-8 relative z-10">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">

            {/* Avatar Section */}
            <div className="relative group">
              <Avatar className="h-32 w-32 border-4 border-background ring-2 ring-primary shadow-xl">
                <AvatarImage
                  src={!avatarError && profile?.discord_avatar
                    ? `https://cdn.discordapp.com/avatars/${profile?.discord_id}/${profile?.discord_avatar}.png`
                    : undefined}
                  onError={() => setAvatarError(true)}
                />
                <AvatarFallback className="text-4xl bg-secondary text-primary font-bold">
                  {profile?.standoff_nickname?.[0]?.toUpperCase() || profile?.discord_username?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute bottom-2 right-2 h-5 w-5 bg-green-500 rounded-full border-2 border-background ring-1 ring-green-500/50 shadow-[0_0_10px_theme(colors.green.500)]"></div>
            </div>

            {/* Info Section */}
            <div className="flex-1 text-center md:text-left space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <h2 className="text-sm font-bold font-display uppercase tracking-widest text-primary/80">Player Profile</h2>
                </div>

                {isEditing && isOwnProfile ? (
                  <div className="flex items-center gap-2 max-w-xs mx-auto md:mx-0">
                    <Input
                      value={newNickname}
                      onChange={(e) => setNewNickname(e.target.value)}
                      className="h-9 bg-background/50 border-input"
                      placeholder="Enter Standoff 2 Nickname"
                    />
                    <Button size="icon" variant="ghost" className="h-9 w-9 text-green-500 hover:text-green-400 hover:bg-green-500/10" onClick={handleSaveNickname} disabled={saving}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive hover:text-destructive/80 hover:bg-destructive/10" onClick={() => setIsEditing(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center md:justify-start gap-3 group">
                    <h1 className="text-3xl md:text-5xl font-black font-display tracking-tighter text-white drop-shadow-sm">
                      {profile?.standoff_nickname || profile?.discord_username || "Unknown Player"}
                    </h1>
                    {isOwnProfile && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => setIsEditing(true)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}

                <p className="text-muted-foreground flex items-center justify-center md:justify-start gap-1.5 text-sm font-medium flex-wrap">
                  <span className="w-2 h-2 rounded-full bg-[#5865F2]"></span>
                  @{profile?.discord_username}
                  {profile?.is_discord_member && (
                    <span className="inline-flex items-center gap-0.5 bg-[#5865F2]/20 text-[#5865F2] px-1.5 py-0.5 rounded text-xs font-bold border border-[#5865F2]/30" title="Discord Server Member">
                      <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M10.067.87a2.89 2.89 0 0 0-4.134 0l-.622.638-.89-.011a2.89 2.89 0 0 0-2.924 2.924l.01.89-.636.622a2.89 2.89 0 0 0 0 4.134l.637.622-.011.89a2.89 2.89 0 0 0 2.924 2.924l.89-.01.622.636a2.89 2.89 0 0 0 4.134 0l.622-.637.89.011a2.89 2.89 0 0 0 2.924-2.924l-.01-.89.636-.622a2.89 2.89 0 0 0 0-4.134l-.637-.622.011-.89a2.89 2.89 0 0 0-2.924-2.924l-.89.01-.622-.636zm.287 5.984-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7 8.793l2.646-2.647a.5.5 0 0 1 .708.708z" />
                      </svg>
                      VERIFIED
                    </span>
                  )}
                  {profile && <LevelBadge elo={profile.elo || 1000} className="ml-1" />}
                  {profile?.standoff_nickname && (
                    <span className="text-xs bg-secondary px-1.5 py-0.5 rounded text-white/50">ID: {profile.id.substring(0, 8)}...</span>
                  )}
                </p>

                {error && <p className="text-xs text-destructive font-bold animate-pulse">{error}</p>}
                {successMsg && <p className="text-xs text-green-500 font-bold">{successMsg}</p>}
              </div>

              {/* Actions - Only shown for own profile */}
              {isOwnProfile && (
                <div className="flex flex-wrap gap-3 justify-center md:justify-start pt-2">
                  <Button onClick={onFindMatch} className="shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all font-bold">
                    <Swords className="mr-2 h-4 w-4" /> FIND MATCH
                  </Button>
                  <Button variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50" onClick={() => setShowLogoutConfirm(true)}>
                    <LogOut className="mr-2 h-4 w-4" /> LOG OUT
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8">
            <EloProgressBar elo={profile?.elo || 1000} />
          </div>
        </CardContent>
      </Card>

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
          <CardTitle className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="font-display font-bold uppercase tracking-wider text-xl">Recent Matches</span>
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
    </div>
  );
}
