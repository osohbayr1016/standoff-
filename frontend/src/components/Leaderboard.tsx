import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Crown, Medal } from "lucide-react";

interface LeaderboardPlayer {
  rank: number;
  id: string;
  discord_id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  elo: number;
  wins: number;
  losses: number;
  is_vip?: boolean;
}

export default function Leaderboard() {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787';
        const response = await fetch(`${backendUrl}/api/leaderboard`);

        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard');
        }

        const data = await response.json();
        // Handle new API format: {players: [], stats: {}} or old format: []
        const players = data.players || data;
        // Backend now returns only valid VIPs, so we just take the top 5
        const top5 = players.slice(0, 5).map((player: any, index: number) => ({
          rank: index + 1,
          ...player
        }));
        setLeaderboardData(top5);
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setError('Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const getAvatarUrl = (player: LeaderboardPlayer) => {
    if (player.avatar) {
      return `https://cdn.discordapp.com/avatars/${player.discord_id}/${player.avatar}.png`;
    }
    return null;
  };

  const getDisplayName = (player: LeaderboardPlayer) => {
    return player.nickname || player.username || 'Unknown';
  };

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Top Players
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  if (error || leaderboardData.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Top Players
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground text-center px-4">
          {error || 'No VIP players found in rankings yet'}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold font-display uppercase tracking-wider flex items-center gap-2 text-primary">
          <Crown className="h-5 w-5 text-yellow-500" /> VIP Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-white/5">
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">ELO</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboardData.map((player) => (
              <TableRow key={player.id} className="hover:bg-muted/50 border-b border-white/5 last:border-0 transition-colors">
                <TableCell className="font-bold text-center">
                  {player.rank === 1 && <Crown className="h-5 w-5 text-yellow-500 mx-auto" />}
                  {player.rank === 2 && <Medal className="h-5 w-5 text-gray-400 mx-auto" />}
                  {player.rank === 3 && <Medal className="h-5 w-5 text-amber-700 mx-auto" />}
                  {player.rank > 3 && <span className="text-muted-foreground text-lg">{player.rank}</span>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className={`h-8 w-8 ${player.rank === 1 ? 'ring-2 ring-yellow-500' : ''}`}>
                      <AvatarImage src={getAvatarUrl(player) || undefined} />
                      <AvatarFallback>{player.username[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <div className={`font-medium ${player.rank === 1 ? 'text-yellow-500' : 'text-foreground'} flex items-center gap-2`}>
                        {getDisplayName(player)}
                        {player.is_vip && (
                          <div className="bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-600 text-black px-1.5 py-0.5 rounded-[2px] text-[10px] font-black uppercase tracking-wider shadow-[0_0_10px_rgba(234,179,8,0.3)] flex items-center gap-1 transform skew-x-[-10deg] scale-90 origin-left">
                            <Trophy className="w-2.5 h-2.5 fill-black" />
                            <span className="skew-x-[10deg]">VIP</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-primary">
                  {player.elo}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

