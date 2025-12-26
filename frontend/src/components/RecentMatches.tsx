import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy } from "lucide-react";

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
}

interface RecentMatchesProps {
  userId?: string | null;
  backendUrl: string;
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

export default function RecentMatches({ userId, backendUrl }: RecentMatchesProps) {
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchMatches();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const fetchMatches = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const res = await fetch(
        `${backendUrl}/api/profile/${userId}/matches`
      );
      
      if (res.ok) {
        const data = await res.json();
        // Get last 5 matches for the home page
        setMatches((data.matches || []).slice(0, 5));
      }
    } catch (e) {
      console.error("Failed to fetch matches", e);
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return (
      <Card className="bg-card/30 border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="font-display font-bold uppercase tracking-wider text-lg">Recent Matches</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Please log in to view your recent matches.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/30 border-white/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-primary" />
          <span className="font-display font-bold uppercase tracking-wider text-lg">Recent Matches</span>
        </CardTitle>
        <CardDescription>Your last 5 competitive matches</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : matches.length > 0 ? (
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="w-[60px]"></TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Map / Date</TableHead>
                <TableHead className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Result</TableHead>
                <TableHead className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Score</TableHead>
                <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-muted-foreground pr-4">ELO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((match) => {
                const isWinner = match.winner_team === match.player_team;
                const mapImage = match.map_name && MAP_IMAGES[match.map_name] 
                  ? MAP_IMAGES[match.map_name] 
                  : '/maps/sandstone.png';

                return (
                  <TableRow
                    key={match.match_id || Math.random().toString()}
                    className="border-white/5 hover:bg-white/5 transition-colors"
                  >
                    {/* Map Image Column */}
                    <TableCell className="p-2">
                      <div className="h-10 w-16 rounded overflow-hidden relative shadow-sm border border-white/10">
                        <img src={mapImage} alt={match.map_name} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-black/20" />
                      </div>
                    </TableCell>

                    {/* Map Name & Date */}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-xs">{match.map_name || 'Unknown Map'}</span>
                        <span className="text-[9px] text-muted-foreground">{new Date(match.created_at).toLocaleDateString()}</span>
                      </div>
                    </TableCell>

                    {/* Result Badge */}
                    <TableCell className="text-center">
                      <Badge 
                        variant={isWinner ? "default" : "destructive"} 
                        className={`
                          ${isWinner
                            ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20"
                            : "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"} 
                          uppercase text-[9px] font-bold tracking-wider px-1.5 py-0.5 border
                        `}
                      >
                        {isWinner ? "W" : "L"}
                      </Badge>
                    </TableCell>

                    {/* Score */}
                    <TableCell className="text-center">
                      <div className="font-mono font-bold text-xs text-white/80">
                        {match.alpha_score ?? '-'} : {match.bravo_score ?? '-'}
                      </div>
                    </TableCell>

                    {/* ELO Change */}
                    <TableCell className="text-right pr-4">
                      {match.elo_change !== undefined && match.elo_change !== null ? (
                        <span className={`font-mono font-bold text-xs ${match.elo_change > 0 ? 'text-green-500' : match.elo_change < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                          {match.elo_change > 0 ? '+' : ''}{match.elo_change}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground italic bg-muted/5">
            <p className="text-sm">No recent matches found.</p>
            <p className="text-xs mt-1">Start playing to see your match history here!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
