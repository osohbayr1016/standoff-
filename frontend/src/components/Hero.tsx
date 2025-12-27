import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, TrendingUp, Users, Gamepad2, Clock, MapPin } from "lucide-react";

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
  };
}

interface HeroProps {
  userId?: string;
  backendUrl: string;
  onNavigate: (page: string) => void;
  onViewProfile: (userId: string) => void;
}

export default function Hero({ backendUrl, onNavigate, onViewProfile }: HeroProps) {
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
      const statsRes = await fetch(`${backendUrl}/api/stats`);
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.stats);
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
      <div className="text-center space-y-2">
        <h1 className="flex flex-wrap items-center justify-center gap-1 text-4xl md:text-6xl font-display font-bold tracking-tighter">
          <span className="text-foreground">STAND</span>
          <span className="text-primary">OFF 2</span>
        </h1>
        <p className="text-muted-foreground max-w-[600px] mx-auto text-sm md:text-base">
          Join active lobbies or create your own custom match. Competitive 5v5 gameplay.
        </p>
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
                        <div className="text-xs text-muted-foreground">24h Active</div>
                        <div className="font-semibold">Players</div>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-green-500">{stats.active_players}</div>
                  </div>

                  {/* Rank Stats: Bronze, Silver, Gold */}
                  <div className="pt-2 pb-2">
                    <div className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Ongoing Matches</div>
                    <div className="grid grid-cols-3 gap-2">
                      {/* Bronze */}
                      <div className="bg-muted/30 rounded-lg p-2 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onNavigate('matchmaking')}>
                        <img src="/ranks/stats/bronze_stat.png" alt="Bronze" className="w-8 h-8 object-contain mb-1" />
                        <div className="text-lg font-bold text-[#cd7f32]">{stats.ongoing_matches_by_rank?.bronze || 0}</div>
                      </div>
                      {/* Silver */}
                      <div className="bg-muted/30 rounded-lg p-2 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onNavigate('matchmaking')}>
                        <img src="/ranks/stats/silver_stat.png" alt="Silver" className="w-8 h-8 object-contain mb-1" />
                        <div className="text-lg font-bold text-gray-300">{stats.ongoing_matches_by_rank?.silver || 0}</div>
                      </div>
                      {/* Gold */}
                      <div className="bg-muted/30 rounded-lg p-2 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onNavigate('matchmaking')}>
                        <img src="/ranks/stats/gold_stat.png" alt="Gold" className="w-8 h-8 object-contain mb-1" />
                        <div className="text-lg font-bold text-yellow-400">{stats.ongoing_matches_by_rank?.gold || 0}</div>
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
    </section>
  );
}
