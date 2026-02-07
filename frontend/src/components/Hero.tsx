import { useState, useEffect, memo } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, TrendingUp, Users, Gamepad2, Clock, MapPin, ArrowRight } from "lucide-react";

interface LeaderboardPlayer {
  rank: number;
  discord_id: string;
  username: string;
  avatar: string;
  elo: number;
  wins: number;
  losses: number;
  win_rate: number;
}

interface PlatformStats {
  matches_today: number;
  matches_week: number;
  active_players: number;
  popular_map: string;
  avg_duration_minutes: number;
  ongoing_matches_by_rank?: {
    bronze: number;
    silver: number;
    gold: number;
    casual: number;
  };
}

interface HeroProps {
  userId?: string;
  backendUrl: string;
  onNavigate: (page: string) => void;
  onViewProfile: (userId: string) => void;
}

function Hero({ backendUrl, onNavigate, onViewProfile }: HeroProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      // Fetch leaderboard
      const leaderboardRes = await fetch(`${backendUrl}/api/leaderboard`);
      const leaderboardData = await leaderboardRes.json();
      if (Array.isArray(leaderboardData)) {
        setLeaderboard(leaderboardData.slice(0, 10));
      }

      // Fetch stats
      const [statsRes, liveStatsRes] = await Promise.all([
        fetch(`${backendUrl}/api/stats`),
        fetch(`${backendUrl}/api/stats/live`)
      ]);

      const statsData = await statsRes.json();
      const liveStatsData = await liveStatsRes.json();

      if (statsData.success) {
        setStats({
          ...statsData.stats,
          active_players: liveStatsData.online_users || statsData.stats.active_players, // Prefer live count
          matches_today: liveStatsData.active_matches || statsData.stats.matches_today // Show active matches if preferred, or stick to today count
        });
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  return (
    <section className="container px-4 py-8 md:py-12 space-y-8 animate-fade-in">
      {/* Hero Title Area */}
      <div className="text-center space-y-4">
        <div className="flex flex-col items-center gap-2">
          <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 px-4 py-1.5 text-xs font-black uppercase tracking-widest animate-pulse">
            NEW UPDATE v2.0
          </Badge>
          <h1 className="flex flex-wrap items-center justify-center gap-1 text-5xl md:text-7xl font-display font-black tracking-tighter italic uppercase">
            <span className="text-foreground">STAND</span>
            <span className="text-primary">OFF 2</span>
          </h1>
        </div>
        <p className="text-muted-foreground max-w-[600px] mx-auto text-sm md:text-lg font-light leading-relaxed">
          Mongolia's largest Standoff 2 tournament platform. Join the community and prove your skills.
        </p>
      </div>

      {/* Community Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-zinc-900 shadow-2xl border border-white/5">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-blue-500/10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 blur-3xl -mr-32 -mt-32" />
        <div className="relative px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            <div className="bg-orange-500/20 p-4 rounded-2xl">
              <Users className="h-8 w-8 text-orange-500" />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Join the Community</h2>
              <p className="text-zinc-400 text-sm max-w-md">
                Join our Discord server to get tournament and update news immediately.
              </p>
            </div>
          </div>
          <Button
            onClick={() => window.open('https://discord.com/invite/FFCBrMACKm', '_blank')}
            className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-10 py-7 text-lg font-bold rounded-2xl shadow-lg shadow-blue-500/20 whitespace-nowrap group"
          >
            JOIN DISCORD
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>

      {/* Leaderboard + Statistics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaderboard - Takes 2 columns on desktop */}
        <Card className="lg:col-span-2 border-border bg-card/50 backdrop-blur">
          <CardHeader className="border-b border-border/50">
            <CardTitle
              className="flex items-center gap-2 text-xl font-bold cursor-pointer hover:text-primary transition-colors"
              onClick={() => onNavigate('leaderboard')}
            >
              <Trophy className="h-5 w-5 text-primary" />
              Top Players
              <span className="text-xs text-muted-foreground font-normal ml-auto">View All</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading leaderboard...</div>
            ) : leaderboard.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No players yet</div>
            ) : (
              <div className="divide-y divide-border/50">
                {leaderboard.map((player) => (
                  <div
                    key={player.discord_id}
                    className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => onViewProfile(player.discord_id)}
                  >
                    {/* Rank */}
                    <div className="text-2xl font-bold w-12 text-center">
                      {getRankIcon(player.rank)}
                    </div>

                    {/* Avatar */}
                    <Avatar className="h-12 w-12 border-2 border-primary/30">
                      <AvatarImage src={`https://cdn.discordapp.com/avatars/${player.discord_id}/${player.avatar}.png`} />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {player.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate">{player.username}</div>
                      <div className="text-xs text-muted-foreground">
                        {player.wins}W - {player.losses}L ({Math.round((player.wins / (player.wins + player.losses || 1)) * 100)}% WR)
                      </div>
                    </div>

                    {/* ELO */}
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary">{player.elo}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">ELO</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics - Takes 1 column on desktop */}
        <div className="space-y-4">
          <Card className="border-border bg-card/50 backdrop-blur">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <TrendingUp className="h-5 w-5 text-primary" />
                Live Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {loading || !stats ? (
                <div className="text-center text-muted-foreground py-4">Loading stats...</div>
              ) : (
                <>
                  {/* Matches Today */}
                  <div
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => onNavigate('matchmaking')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Gamepad2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Today</div>
                        <div className="font-semibold">Matches</div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-primary">{stats.matches_today}</div>
                  </div>

                  {/* Matches This Week */}
                  <div
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => onNavigate('matchmaking')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Gamepad2 className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">This Week</div>
                        <div className="font-semibold">Matches</div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-blue-500">{stats.matches_week}</div>
                  </div>

                  {/* Active Players */}
                  <div
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => onNavigate('matchmaking')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Users className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Currently</div>
                        <div className="font-semibold">Online</div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-green-500">{stats.active_players}</div>
                  </div>

                  {/* Rank Stats: Bronze, Silver, Gold, Casual */}
                  <div className="pt-2 pb-2">
                    <div className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Ongoing Matches</div>
                    <div className="grid grid-cols-4 gap-2">
                      {/* Casual */}
                      <div className="bg-muted/30 rounded-lg p-2 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onNavigate('matchmaking')}>
                        <Gamepad2 className="w-8 h-8 text-primary mb-1" />
                        <div className="text-lg font-bold text-primary">{stats.ongoing_matches_by_rank?.casual || 0}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Casual</div>
                      </div>
                      {/* Bronze */}
                      <div className="bg-muted/30 rounded-lg p-2 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onNavigate('matchmaking')}>
                        <img src="/ranks/stats/bronze_stat.png" alt="Bronze" className="w-8 h-8 object-contain mb-1" />
                        <div className="text-lg font-bold text-[#cd7f32]">{stats.ongoing_matches_by_rank?.bronze || 0}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Bronze</div>
                      </div>
                      {/* Silver */}
                      <div className="bg-muted/30 rounded-lg p-2 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onNavigate('matchmaking')}>
                        <img src="/ranks/stats/silver_stat.png" alt="Silver" className="w-8 h-8 object-contain mb-1" />
                        <div className="text-lg font-bold text-gray-300">{stats.ongoing_matches_by_rank?.silver || 0}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Silver</div>
                      </div>
                      {/* Gold */}
                      <div className="bg-muted/30 rounded-lg p-2 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onNavigate('matchmaking')}>
                        <img src="/ranks/stats/gold_stat.png" alt="Gold" className="w-8 h-8 object-contain mb-1" />
                        <div className="text-lg font-bold text-yellow-400">{stats.ongoing_matches_by_rank?.gold || 0}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Gold</div>
                      </div>
                    </div>
                  </div>

                  {/* Popular Map */}
                  <div
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => onNavigate('matchmaking')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-purple-500" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Popular Map</div>
                        <div className="font-semibold">{stats.popular_map}</div>
                      </div>
                    </div>
                  </div>

                  {/* Average Duration */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-orange-500" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Avg Duration</div>
                        <div className="font-semibold">{stats.avg_duration_minutes} min</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Division Explanation Section */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="border-border bg-card/50 backdrop-blur overflow-hidden relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 blur-[100px] -mr-48 -mt-48" />
          <CardHeader className="border-b border-border/50 relative z-10">
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <Trophy className="h-5 w-5 text-primary" />
              Ranking System & Division
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 relative z-10">
            <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-4">
              {leaderboard.length >= 0 && [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => {
                const threshold = [
                  { min: 100, max: 500 },
                  { min: 501, max: 750 },
                  { min: 751, max: 900 },
                  { min: 901, max: 1050 },
                  { min: 1051, max: 1200 },
                  { min: 1201, max: 1350 },
                  { min: 1351, max: 1530 },
                  { min: 1531, max: 1750 },
                  { min: 1751, max: 2000 },
                  { min: 2001, max: "∞" }
                ][level - 1];

                return (
                  <div key={level} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-zinc-900/50 border border-white/5 hover:border-primary/30 transition-all group">
                    <img
                      src={`/ranks/${level}.png`}
                      alt={`Level ${level}`}
                      className="h-10 w-10 object-contain group-hover:scale-110 transition-transform"
                    />
                    <div className="text-center">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase">Level {level}</div>
                      <div className="text-xs font-black text-white">{threshold.min}-{threshold.max}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-[#cd7f32]/20 space-y-3 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#cd7f32]/10 blur-3xl -mr-16 -mt-16 transition-opacity group-hover:opacity-100" />
                <div className="flex items-center gap-3">
                  <img src="/ranks/stats/bronze_stat.png" alt="Bronze Division" className="w-12 h-12 object-contain" />
                  <div>
                    <h3 className="text-lg font-bold text-[#cd7f32] italic uppercase">Bronze Division</h3>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Division I</div>
                  </div>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed relative z-10">
                  Includes players Lvl 1-5. In this division, you will learn the basics of the game and the ELO system.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-gray-400/20 space-y-3 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gray-400/10 blur-3xl -mr-16 -mt-16 transition-opacity group-hover:opacity-100" />
                <div className="flex items-center gap-3">
                  <img src="/ranks/stats/silver_stat.png" alt="Silver Division" className="w-12 h-12 object-contain" />
                  <div>
                    <h3 className="text-lg font-bold text-gray-300 italic uppercase">Silver Division</h3>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Division II</div>
                  </div>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed relative z-10">
                  Includes players Lvl 6-9. Intermediate competitive matches where skills and experience are accumulated.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-yellow-500/20 space-y-3 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 blur-3xl -mr-16 -mt-16 transition-opacity group-hover:opacity-100" />
                <div className="flex items-center gap-3">
                  <img src="/ranks/stats/gold_stat.png" alt="Gold Division" className="w-12 h-12 object-contain" />
                  <div>
                    <h3 className="text-lg font-bold text-yellow-400 italic uppercase">Gold Division</h3>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Division III</div>
                  </div>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed relative z-10">
                  Includes players up to Lvl 10. Professional level competition and battles for the highest ELO points.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </section>
  );
}

export default memo(Hero);
