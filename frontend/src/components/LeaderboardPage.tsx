import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "./WebSocketContext";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Crown, Medal, TrendingUp, Gamepad2 } from "lucide-react";
import LevelBadge from "./LevelBadge";
import { VerifiedBadge } from "./VerifiedBadge";

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
  is_discord_member?: boolean;
}

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
  const { lastMessage, sendMessage, isConnected } = useWebSocket();

  // Move applyFilter declaration up before it is used
  const applyFilter = useCallback((data: LeaderboardEntry[], filter: FilterType) => {
    let sorted = [...data];

    switch (filter) {
      case "elo":
        sorted.sort((a, b) => b.elo - a.elo);
        break;
      case "winrate":
        sorted.sort((a, b) => {
          const winrateA =
            a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
          const winrateB =
            b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
          return winrateB - winrateA;
        });
        break;
      case "matches":
        sorted.sort((a, b) => {
          const matchesA = a.wins + a.losses;
          const matchesB = b.wins + b.losses;
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
        setLeaderboard(parsed);
        applyFilter(parsed, activeFilter);
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
      const updatedData = lastMessage.data;
      setLeaderboard(updatedData);
      applyFilter(updatedData, activeFilter);

      // Update cache
      localStorage.setItem(CACHE_KEY, JSON.stringify(updatedData));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    }
  }, [lastMessage, activeFilter, applyFilter]);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/leaderboard`
      );
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
        applyFilter(data, activeFilter);

        // Cache the data
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
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
      applyFilter(leaderboard, activeFilter);
    }
  }, [activeFilter, leaderboard, applyFilter]);

  return (
    <div className="space-y-6 container mx-auto max-w-7xl animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tighter text-white flex items-center gap-2">
            <Trophy className="h-8 w-8 text-primary" /> Global Rankings
          </h1>
          <p className="text-muted-foreground">Top 500 players ranked by specialized matchmaking performance.</p>
        </div>
      </div>

      <Card className="bg-zinc-950/50 backdrop-blur-sm border-white/10 shadow-lg overflow-hidden">
        <CardHeader className="p-4 md:p-6 border-b border-white/10 bg-zinc-900/30">
          <Tabs defaultValue="elo" onValueChange={(v) => setActiveFilter(v as FilterType)} className="w-full">
            <div className="flex items-center justify-between">
              <TabsList className="bg-zinc-900 border border-white/5">
                <TabsTrigger value="elo" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                  <TrendingUp className="h-4 w-4 mr-2" /> ELO Rating
                </TabsTrigger>
                <TabsTrigger value="winrate" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                  <Crown className="h-4 w-4 mr-2" /> Win Rate
                </TabsTrigger>
                <TabsTrigger value="matches" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                  <Gamepad2 className="h-4 w-4 mr-2" /> Matches
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-900/50 hover:bg-zinc-900/50">
              <TableRow className="border-b border-white/10 hover:bg-transparent">
                <TableHead className="w-[80px] text-center font-bold text-gray-400">Rank</TableHead>
                <TableHead className="w-[300px] font-bold text-gray-400">Player</TableHead>
                <TableHead className="text-center font-bold text-gray-400">ELO</TableHead>
                <TableHead className="text-center font-bold text-gray-400 mobile-hide">Win Rate</TableHead>
                <TableHead className="text-center font-bold text-gray-400 mobile-hide">Matches</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-white/5">
                    <TableCell className="h-16"><div className="h-4 w-8 bg-zinc-800 animate-pulse rounded mx-auto"></div></TableCell>
                    <TableCell><div className="flex items-center gap-3"><div className="h-8 w-8 bg-zinc-800 animate-pulse rounded-full"></div><div className="h-4 w-32 bg-zinc-800 animate-pulse rounded"></div></div></TableCell>
                    <TableCell><div className="h-4 w-12 bg-zinc-800 animate-pulse rounded mx-auto"></div></TableCell>
                    <TableCell className="mobile-hide"><div className="h-4 w-12 bg-zinc-800 animate-pulse rounded mx-auto"></div></TableCell>
                    <TableCell className="mobile-hide"><div className="h-4 w-12 bg-zinc-800 animate-pulse rounded mx-auto"></div></TableCell>
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
                  const winRate =
                    player.wins + player.losses > 0
                      ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)
                      : "0.0";

                  return (
                    <TableRow
                      key={player.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors group cursor-pointer"
                      onClick={() => onViewProfile?.(player.id)}
                    >
                      <TableCell className="text-center py-4">
                        <div className="flex items-center justify-center">
                          {player.rank === 1 && <Crown className="h-6 w-6 text-yellow-500 fill-yellow-500/20" />}
                          {player.rank === 2 && <Medal className="h-6 w-6 text-gray-300 fill-gray-300/20" />}
                          {player.rank === 3 && <Medal className="h-6 w-6 text-amber-600 fill-amber-600/20" />}
                          {player.rank > 3 && <span className="text-lg font-mono font-bold text-gray-500 group-hover:text-white transition-colors">#{player.rank}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className={`h-10 w-10 border-2 ${player.rank === 1 ? 'border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]' : 'border-zinc-800'}`}>
                            <AvatarImage src={`https://cdn.discordapp.com/avatars/${player.discord_id}/${player.avatar}.png`} />
                            <AvatarFallback>{player.username[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className={`font-bold flex items-center gap-1.5 ${player.rank === 1 ? 'text-yellow-500' : 'text-white'}`}>
                              {player.nickname || player.username}
                              <VerifiedBadge isVerified={player.is_discord_member} showText={false} className="w-3.5 h-3.5" />
                            </span>
                            {player.nickname && (
                              <span className="text-xs text-muted-foreground">@{player.username}</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <LevelBadge elo={player.elo} showElo />
                        </div>
                      </TableCell>
                      <TableCell className="text-center mobile-hide">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-bold text-white">{winRate}%</span>
                          <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 transition-all" style={{ width: `${winRate}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center mobile-hide font-mono text-gray-400">
                        {player.wins + player.losses}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <style>{`
        @media (max-width: 768px) {
          .mobile-hide {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
