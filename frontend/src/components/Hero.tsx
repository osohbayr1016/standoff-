import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Users, Globe, Gamepad2, Timer } from "lucide-react";

interface Match {
  id: string;
  host_id: string;
  map_name: string;
  status: string;
  player_count: number;
  max_players: number;
  players?: any[];
}

interface HeroProps {
  onFindMatch: () => void;
  onViewMatch: (matchId: string) => void;
  userId?: string;
  backendUrl: string;
}

export default function Hero({ onFindMatch, onViewMatch, userId, backendUrl }: HeroProps) {
  const [activeMatches, setActiveMatches] = useState<Match[]>([]);
  const [myMatchId, setMyMatchId] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveMatches();
    const interval = setInterval(fetchActiveMatches, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  const fetchActiveMatches = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/matches?status=waiting,in_progress`);
      const data = await response.json();
      if (data.success) {
        // Sort: My match first, then by player count descending
        const matches = (data.matches || []).sort((a: Match, b: Match) => {
          if (userId) {
            // If I have a match ID, prioritize it? logic is complex here, simplest is just render
          }
          return b.player_count - a.player_count;
        });
        setActiveMatches(matches);
      }

      // Check if user is in any match
      if (userId) {
        const userMatchRes = await fetch(`${backendUrl}/api/matches/user/${userId}/active`);
        const userMatchData = await userMatchRes.json();
        if (userMatchData.success && userMatchData.match) {
          setMyMatchId(userMatchData.match.id);
        } else {
          setMyMatchId(null);
        }
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
    }
  };

  return (
    <section className="container px-4 py-8 md:py-12 space-y-8 animate-fade-in">
      {/* Hero Title Area */}
      <div className="text-center space-y-2">
        <h1 className="flex items-center justify-center gap-1 text-4xl md:text-6xl font-display font-bold tracking-tighter">
          <span className="text-foreground">STAN</span>
          <span className="text-primary">D</span>
          <span className="text-foreground">OFF 2</span>
        </h1>
        <p className="text-muted-foreground max-w-[600px] mx-auto text-sm md:text-base">
          Join active lobbies or create your own custom match. Competitive 5v5 gameplay.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" /> Active Matches
        </h2>
        <Button onClick={onFindMatch} size="lg" className="shadow-lg shadow-primary/20">
          <Plus className="mr-2 h-4 w-4" /> Create Lobby
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {activeMatches.map(match => {
          const isMyMatch = match.id === myMatchId;
          const players = match.players || [];
          const maxDisplayPlayers = 5;

          return (
            <Card
              key={match.id}
              className={`group relative overflow-hidden transition-all hover:-translate-y-1 hover:border-primary/50 cursor-pointer ${isMyMatch ? 'border-primary shadow-[0_0_20px_hsl(45_93%_47%_/_0.15)]' : 'border-border'}`}
              onClick={() => onViewMatch(match.id)}
            >
              {isMyMatch && (
                <div className="absolute top-0 right-0 p-2">
                  <Badge variant="default" className="text-[10px] px-2 py-0.5">YOUR MATCH</Badge>
                </div>
              )}

              <CardHeader className="pb-2">
                <CardTitle className="flex justify-between items-start">
                  <span className="text-lg font-bold truncate pr-6">{match.map_name || 'Map TBD'}</span>
                </CardTitle>
                <div className="flex gap-2 mt-1">
                  <Badge variant={match.status === 'in_progress' ? "destructive" : "secondary"} className="text-[10px] uppercase">
                    {match.status === 'in_progress' ? 'Live' : 'Waiting'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-primary/20 text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {match.player_count}/{match.max_players}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex -space-x-2 overflow-hidden py-1">
                  {players.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic pl-1">No players yet</span>
                  ) : (
                    players.slice(0, maxDisplayPlayers).map((p, i) => (
                      <Avatar key={i} className="inline-block h-8 w-8 border-2 border-background ring-2 ring-background">
                        <AvatarImage src={`https://cdn.discordapp.com/avatars/${p.discord_id}/${p.discord_avatar}.png`} />
                        <AvatarFallback className="bg-muted text-[10px]">
                          {p.discord_username?.[0]?.toUpperCase() || 'P'}
                        </AvatarFallback>
                      </Avatar>
                    ))
                  )}
                  {players.length > maxDisplayPlayers && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium text-muted-foreground hover:bg-muted/80">
                      +{players.length - maxDisplayPlayers}
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-0 text-xs text-muted-foreground flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <Gamepad2 className="w-3 h-3" /> 5v5
                </span>
                {match.status === 'waiting' && (
                  <span className="flex items-center gap-1 text-primary">
                    <Timer className="w-3 h-3" /> Waiting...
                  </span>
                )}
              </CardFooter>
            </Card>
          );
        })}

        {activeMatches.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-border rounded-xl bg-card/50">
            <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Globe className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold">No Active Matches</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Be the first to create a lobby and start the game!
            </p>
            <Button onClick={onFindMatch} variant="outline">
              Create First Lobby
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

