import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "../components/WebSocketContext";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Crown, Medal, TrendingUp, Gamepad2, Flag, Users } from "lucide-react";
import LevelBadge from "../components/LevelBadge";
import RewardsCard from "../components/RewardsCard";

interface LeaderboardEntry {
  rank: number;
  id: string;
  discord_id: string;
  username: string;
  avatar?: string;
  nickname?: string;
  elo: number;
  wins: number;
  losses: number;
  allies_elo?: number;
  allies_wins?: number;
  allies_losses?: number;
  is_discord_member?: boolean;
  is_vip?: boolean | number;
  vip_until?: string;
}

type MatchTypeFilter = 'standard' | 'allies';

type FilterType = "elo" | "winrate" | "matches";

const CACHE_KEY = "leaderboard_cache";
const CACHE_TIMESTAMP_KEY = "leaderboard_cache_timestamp";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface LeaderboardPageProps {
  onViewProfile?: (userId: string) => void;
}

export default function LeaderboardPage({ onViewProfile }: LeaderboardPageProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [filteredLeaderboard, setFilteredLeaderboard] = useState<
    LeaderboardEntry[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("elo");
  const [matchTypeFilter, setMatchTypeFilter] = useState<MatchTypeFilter>('standard');
  const [stats, setStats] = useState<{ total_vip_players: number; average_elo: number; total_matches: number } | null>(null);
  const { lastMessage, sendMessage, isConnected } = useWebSocket();
  const [viewMode, setViewMode] = useState<'players' | 'clans'>('players');
  const [clanLeaderboard, setClanLeaderboard] = useState<any[]>([]);

  const fetchClanLeaderboard = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/clans`);
      if (res.ok) {
        const data = await res.json();
        setClanLeaderboard(data.clans || []);
      }
    } catch (e) {
      console.error("Failed to fetch clan leaderboard", e);
    }
  };

  useEffect(() => {
    if (viewMode === 'clans' && clanLeaderboard.length === 0) {
      fetchClanLeaderboard();
    }
  }, [viewMode]);

  // Move applyFilter declaration up before it is used
  const applyFilter = useCallback((data: LeaderboardEntry[], filter: FilterType, matchType: MatchTypeFilter) => {
    let sorted = [...data];

    switch (filter) {
      case "elo":
        sorted.sort((a, b) => {
          const eloA = matchType === 'allies' ? (a.allies_elo || 1000) : a.elo;
          const eloB = matchType === 'allies' ? (b.allies_elo || 1000) : b.elo;
          return eloB - eloA;
        });
        break;
      case "winrate":
        sorted.sort((a, b) => {
          const winsA = matchType === 'allies' ? (a.allies_wins || 0) : a.wins;
          const lossesA = matchType === 'allies' ? (a.allies_losses || 0) : a.losses;
          const winrateA = winsA + lossesA > 0 ? winsA / (winsA + lossesA) : 0;

          const winsB = matchType === 'allies' ? (b.allies_wins || 0) : b.wins;
          const lossesB = matchType === 'allies' ? (b.allies_losses || 0) : b.losses;
          const winrateB = winsB + lossesB > 0 ? winsB / (winsB + lossesB) : 0;

          return winrateB - winrateA;
        });
        break;
      case "matches":
        sorted.sort((a, b) => {
          const matchesA = matchType === 'allies' ? ((a.allies_wins || 0) + (a.allies_losses || 0)) : (a.wins + a.losses);
          const matchesB = matchType === 'allies' ? ((b.allies_wins || 0) + (b.allies_losses || 0)) : (b.wins + b.losses);
          return matchesB - matchesA;
        });
        break;
    }

    // Recalculate ranks after sorting
    const ranked = sorted.map((player, index) => ({
      ...player,
      rank: index + 1,
    }));

    setFilteredLeaderboard(ranked);
  }, []);

  // Load cached data immediately on mount
  useEffect(() => {
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cacheTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

    if (cachedData && cacheTimestamp) {
      const age = Date.now() - parseInt(cacheTimestamp);
      if (age < CACHE_DURATION) {
        const parsed = JSON.parse(cachedData);
        const players = parsed.players || parsed; // Handle both old and new format
        const statsData = parsed.stats || null;

        setLeaderboard(players);
        setStats(statsData);
        applyFilter(players, activeFilter, matchTypeFilter);
        setLoading(false);
      }
    }

    // Fetch fresh data via HTTP
    fetchLeaderboard();

    // Request via WebSocket if connected
    if (isConnected) {
      sendMessage({ type: 'REQUEST_LEADERBOARD' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Request leaderboard when WebSocket connects
  useEffect(() => {
    if (isConnected) {
      sendMessage({ type: 'REQUEST_LEADERBOARD' });
    }
  }, [isConnected, sendMessage]);

  // Listen for real-time leaderboard updates via WebSocket
  useEffect(() => {
    if (lastMessage?.type === "LEADERBOARD_UPDATE") {
      console.log("Real-time leaderboard update received");
      const response = lastMessage.data;
      const updatedData = response.players || response; // Handle both old and new format
      const updatedStats = response.stats || null;

      setLeaderboard(updatedData);
      setStats(updatedStats);
      applyFilter(updatedData, activeFilter, matchTypeFilter);

      // Update cache
      localStorage.setItem(CACHE_KEY, JSON.stringify({ players: updatedData, stats: updatedStats }));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    }
  }, [lastMessage, activeFilter, applyFilter]);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/leaderboard`
      );
      if (res.ok) {
        const response = await res.json();
        const players = response.players || response; // Handle both old and new format
        const statsData = response.stats || null;

        setLeaderboard(players);
        setStats(statsData);
        applyFilter(players, activeFilter, matchTypeFilter);

        // Cache the data
        localStorage.setItem(CACHE_KEY, JSON.stringify({ players, stats: statsData }));
        localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
      }
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (leaderboard.length > 0) {
      applyFilter(leaderboard, activeFilter, matchTypeFilter);
    }
  }, [activeFilter, matchTypeFilter, leaderboard, applyFilter]);

  return (
    <div className="space-y-6 container mx-auto max-w-7xl animate-fade-in pb-12 px-4 md:px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tighter text-white flex items-center gap-2">
            <Trophy className="h-8 w-8 text-primary" /> Global Rankings
          </h1>
          <p className="text-muted-foreground">Top 500 players ranked by specialized matchmaking performance.</p>
        </div>
        {stats && (
          <div className="flex gap-4 text-sm">
            <div className="bg-zinc-900/50 px-4 py-2 rounded-lg border border-white/10">
              <div className="text-[#9ca3af] text-xs uppercase tracking-wider">VIP Players</div>
              <div className="text-white font-bold text-lg">{stats.total_vip_players}</div>
            </div>
            <div className="bg-zinc-900/50 px-4 py-2 rounded-lg border border-white/10">
              <div className="text-[#9ca3af] text-xs uppercase tracking-wider">Avg ELO</div>
              <div className="text-[#ff5500] font-bold text-lg">{stats.average_elo.toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Tabs defaultValue="players" value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList className="bg-zinc-900 border border-white/10 h-10">
                <TabsTrigger value="players" className="px-6 h-8">Players</TabsTrigger>
                <TabsTrigger value="clans" className="px-6 h-8">Clans</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="players" className="mt-0">
              <Card className="bg-zinc-950/50 backdrop-blur-sm border-white/10 shadow-lg overflow-hidden">
                <CardHeader className="p-4 md:p-6 border-b border-white/10 bg-zinc-900/30">
                  <Tabs defaultValue="elo" onValueChange={(v) => setActiveFilter(v as FilterType)} className="w-full">
                    <div className="w-full overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                      <TabsList className="bg-zinc-900 border border-white/5 w-full sm:w-auto min-w-fit flex-shrink-0">
                        <TabsTrigger
                          value="elo"
                          className="data-[state=active]:bg-primary data-[state=active]:text-white text-[10px] sm:text-xs md:text-sm px-2 sm:px-3 flex-shrink-0 whitespace-nowrap"
                        >
                          <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                          <span className="hidden sm:inline">ELO Rating</span>
                          <span className="sm:hidden">ELO</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="winrate"
                          className="data-[state=active]:bg-primary data-[state=active]:text-white text-[10px] sm:text-xs md:text-sm px-2 sm:px-3 flex-shrink-0 whitespace-nowrap"
                        >
                          <Crown className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                          <span className="hidden sm:inline">Win Rate</span>
                          <span className="sm:hidden">Win</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="matches"
                          className="data-[state=active]:bg-primary data-[state=active]:text-white text-[10px] sm:text-xs md:text-sm px-2 sm:px-3 flex-shrink-0 whitespace-nowrap"
                        >
                          <Gamepad2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                          <span className="hidden sm:inline">Matches</span>
                          <span className="sm:hidden">Match</span>
                        </TabsTrigger>
                      </TabsList>
                    </div>
                  </Tabs>

                  {/* Match Type Toggles */}
                  <div className="flex items-center gap-2 mt-4 md:mt-0">
                    <div className="bg-zinc-900 border border-white/5 p-1 rounded-md flex">
                      <button
                        onClick={() => setMatchTypeFilter('standard')}
                        className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${matchTypeFilter === 'standard' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                      >
                        Standard (5v5)
                      </button>
                      <button
                        onClick={() => setMatchTypeFilter('allies')}
                        className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${matchTypeFilter === 'allies' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                      >
                        Allies (2v2)
                      </button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0 overflow-x-auto">
                  <Table className="min-w-full">
                    <TableHeader className="bg-zinc-900/50 hover:bg-zinc-900/50">
                      <TableRow className="border-b border-white/10 hover:bg-transparent">
                        <TableHead className="w-[50px] md:w-[80px] text-center font-bold text-gray-400 text-xs md:text-sm">Rank</TableHead>
                        <TableHead className="min-w-[100px] md:w-[300px] font-bold text-gray-400 text-xs md:text-sm">Player</TableHead>
                        <TableHead className="min-w-[70px] md:min-w-[90px] text-center font-bold text-gray-400 text-xs md:text-sm">ELO</TableHead>
                        <TableHead className="min-w-[70px] text-center font-bold text-gray-400 text-xs md:text-sm">Win Rate</TableHead>
                        <TableHead className="min-w-[60px] text-center font-bold text-gray-400 text-xs md:text-sm">Matches</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        Array.from({ length: 10 }).map((_, i) => (
                          <TableRow key={i} className="border-b border-white/5">
                            <TableCell className="h-16"><div className="h-4 w-8 bg-zinc-800 animate-pulse rounded mx-auto"></div></TableCell>
                            <TableCell><div className="flex items-center gap-3"><div className="h-8 w-8 bg-zinc-800 animate-pulse rounded-full"></div><div className="h-4 w-32 bg-zinc-800 animate-pulse rounded"></div></div></TableCell>
                            <TableCell><div className="h-4 w-12 bg-zinc-800 animate-pulse rounded mx-auto"></div></TableCell>
                            <TableCell><div className="h-4 w-12 bg-zinc-800 animate-pulse rounded mx-auto"></div></TableCell>
                            <TableCell><div className="h-4 w-12 bg-zinc-800 animate-pulse rounded mx-auto"></div></TableCell>
                          </TableRow>
                        ))
                      ) : filteredLeaderboard.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                            No players found in the leaderboard.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredLeaderboard.map((player) => {
                          const wins = matchTypeFilter === 'allies' ? (player.allies_wins || 0) : player.wins;
                          const losses = matchTypeFilter === 'allies' ? (player.allies_losses || 0) : player.losses;
                          const elo = matchTypeFilter === 'allies' ? (player.allies_elo || 1000) : player.elo;

                          const winRate =
                            wins + losses > 0
                              ? ((wins / (wins + losses)) * 100).toFixed(1)
                              : "0.0";

                          return (
                            <TableRow
                              key={player.id}
                              className="border-b border-white/5 hover:bg-white/5 transition-colors group cursor-pointer"
                              onClick={() => onViewProfile?.(player.id)}
                            >
                              <TableCell className="text-center py-4">
                                <div className="flex items-center justify-center">
                                  {player.rank === 1 && <Crown className="h-5 w-5 md:h-6 md:w-6 text-yellow-500 fill-yellow-500/20" />}
                                  {player.rank === 2 && <Medal className="h-5 w-5 md:h-6 md:w-6 text-gray-300 fill-gray-300/20" />}
                                  {player.rank === 3 && <Medal className="h-5 w-5 md:h-6 md:w-6 text-amber-600 fill-amber-600/20" />}
                                  {player.rank > 3 && <span className="text-sm md:text-lg font-mono font-bold text-gray-500 group-hover:text-white transition-colors">#{player.rank}</span>}
                                </div>
                              </TableCell>
                              <TableCell className="min-w-[100px]">
                                <div className="flex items-center gap-1.5 md:gap-3 min-w-0">
                                  <Avatar className={`h-7 w-7 md:h-10 md:w-10 border-2 flex-shrink-0 ${player.rank === 1 ? 'border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]' : 'border-zinc-800'}`}>
                                    <AvatarImage src={`https://cdn.discordapp.com/avatars/${player.discord_id}/${player.avatar}.png`} />
                                    <AvatarFallback className="text-xs md:text-sm">{player.username[0]?.toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className={`font-bold flex items-center gap-1 truncate text-xs md:text-sm ${player.rank === 1 ? 'text-yellow-500' : 'text-white'}`}>
                                      <span className="truncate">{player.nickname || player.username}</span>
                                      {/* VIP Badge */}
                                      {(player.is_vip === true || player.is_vip === 1) && (
                                        <div className="bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-600 text-black px-1.5 py-0.5 rounded-[2px] text-[10px] font-black uppercase tracking-wider shadow-[0_0_10px_rgba(234,179,8,0.3)] flex items-center gap-1 transform skew-x-[-10deg] scale-90 origin-left ml-2">
                                          <Trophy className="w-2.5 h-2.5 fill-black" />
                                          <span className="skew-x-[10deg]">VIP</span>
                                        </div>
                                      )}
                                    </span>
                                    {player.nickname && (
                                      <span className="text-[10px] md:text-xs text-muted-foreground truncate">@{player.username}</span>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center min-w-[70px] md:min-w-[90px]">
                                <div className="flex justify-center items-center">
                                  <LevelBadge elo={elo} showElo />
                                </div>
                              </TableCell>
                              <TableCell className="text-center min-w-[70px]">
                                <div className="flex flex-col items-center gap-0.5 md:gap-1">
                                  <span className="font-bold text-white text-xs md:text-sm">{winRate}%</span>
                                  <div className="w-12 md:w-16 h-1 bg-zinc-800 rounded-full overflow-hidden hidden md:block">
                                    <div className={`h-full transition-all ${parseFloat(winRate) >= 50 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${winRate}%` }} />
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center min-w-[60px] font-mono text-gray-400 text-xs md:text-sm">
                                {wins + losses}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="clans" className="mt-0">
              <Card className="bg-zinc-950/50 backdrop-blur-sm border-white/10 shadow-lg overflow-hidden">
                <CardHeader className="p-4 md:p-6 border-b border-white/10 bg-zinc-900/30">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Flag className="h-5 w-5 text-primary" /> Top Clans
                  </h3>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table className="min-w-full">
                    <TableHeader className="bg-zinc-900/50 hover:bg-zinc-900/50">
                      <TableRow className="border-b border-white/10 hover:bg-transparent">
                        <TableHead className="w-[50px] md:w-[80px] text-center font-bold text-gray-400">Rank</TableHead>
                        <TableHead className="min-w-[200px] font-bold text-gray-400">Clan</TableHead>
                        <TableHead className="text-center font-bold text-gray-400">Members</TableHead>
                        <TableHead className="text-center font-bold text-gray-400">ELO</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clanLeaderboard.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-40 text-center text-muted-foreground">
                            {loading ? <div className="flex justify-center"><div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div> : "No clans found."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        clanLeaderboard.map((clan, index) => (
                          <TableRow
                            key={clan.id}
                            className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
                          // Assuming we can navigate to clan profile if implemented, or just view.
                          // The user didn't explicitly ask for linking, but it's good practice.
                          // Does current page have access to navigation? No, usually passed props.
                          // But for now purely display.
                          >
                            <TableCell className="text-center py-4">
                              <div className="flex items-center justify-center">
                                {index + 1 === 1 && <Crown className="h-5 w-5 text-yellow-500 fill-yellow-500/20" />}
                                {index + 1 === 2 && <Medal className="h-5 w-5 text-gray-300 fill-gray-300/20" />}
                                {index + 1 === 3 && <Medal className="h-5 w-5 text-amber-600 fill-amber-600/20" />}
                                {index + 1 > 3 && <span className="font-mono font-bold text-gray-500">#{index + 1}</span>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full border border-zinc-700 flex items-center justify-center overflow-hidden bg-zinc-900">
                                  {clan.logo_url ? (
                                    <img src={clan.logo_url} alt={clan.name} className="h-full w-full object-cover" />
                                  ) : (
                                    <Flag className="h-4 w-4 text-zinc-500" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-bold text-white group-hover:text-primary transition-colors">{clan.name}</div>
                                  <div className="text-xs text-muted-foreground">[{clan.tag}]</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1 text-zinc-400">
                                <Users className="h-4 w-4" />
                                <span>{clan.member_count}/{clan.max_members}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="inline-block px-3 py-1 bg-zinc-900 rounded border border-white/10 font-bold text-primary">
                                {clan.elo}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="lg:col-span-1">
          <RewardsCard />
        </div>
      </div>
    </div >
  );
}
