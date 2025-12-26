import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, Check, X, MessageSquare, Users } from "lucide-react";
import { VerifiedBadge } from "./VerifiedBadge";

interface User {
  id: string;
  username: string;
  avatar: string;
}

interface Friend {
  friendship_id: number;
  id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  elo: number;
  is_discord_member?: boolean;
  status: string;
}

interface SearchResult {
  id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  elo: number;
  is_discord_member?: boolean;
}

interface FriendsPageProps {
  onViewProfile?: (userId: string) => void;
}

export default function FriendsPage({ onViewProfile }: FriendsPageProps) {
  const [activeFriends, setActiveFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      fetchFriends(user.id);
    }
  }, []);

  const fetchFriends = async (userId: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/friends/${userId}`
      );
      if (res.ok) {
        const data = await res.json();
        setActiveFriends(data.friends || []);
        setPendingRequests(data.pendingIncoming || []);
      }
    } catch (err) {
      console.error("Failed to fetch friends", err);
      setError("Failed to load friends network");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentUser) return;

    setSearchLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/users/search?q=${searchQuery}&userId=${currentUser.id}`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setSearchLoading(false);
    }
  };

  const sendFriendRequest = async (targetId: string) => {
    if (!currentUser) return;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/friends/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUser.id, targetId }),
        }
      );

      if (res.ok) {
        setSearchResults((prev) => prev.filter((r) => r.id !== targetId));
        fetchFriends(currentUser.id);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to send request");
      }
    } catch (err) {
      alert("Network error");
    }
  };

  const acceptRequest = async (requestId: number) => {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/friends/accept`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId }),
        }
      );

      if (res.ok) {
        fetchFriends(currentUser.id);
      }
    } catch (err) {
      console.error("Accept failed", err);
    }
  };

  const declineRequest = async (requestId: number) => {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/friends/${requestId}`,
        {
          method: "DELETE",
        }
      );

      if (res.ok) {
        fetchFriends(currentUser.id);
      }
    } catch (err) {
      console.error("Decline failed", err);
    }
  };

  const getAvatarUrl = (discordId: string, avatarHash?: string) => {
    if (!avatarHash) return null;
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png`;
  };

  return (
    <div className="container mx-auto max-w-7xl space-y-6 pb-12 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold font-display tracking-tighter text-white flex items-center gap-2">
          <Users className="h-8 w-8 text-primary" /> Player Network
        </h1>
        <p className="text-muted-foreground">Manage your connections and find new teammates.</p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md border border-destructive/20">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: ACTIVE FRIENDS */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-zinc-950/50 backdrop-blur-sm border-white/10 shadow-lg h-full">
            <CardHeader className="border-b border-white/10 bg-zinc-900/30">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Your Friends
                <Badge variant="secondary" className="ml-2 bg-zinc-800 text-gray-300 hover:bg-zinc-700">
                  {activeFriends.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  Loading network...
                </div>
              ) : activeFriends.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-zinc-800 rounded-lg">
                  <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No connections yet.</p>
                  <p className="text-sm">Search for players to build your team.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeFriends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-zinc-900/50 border border-white/5 hover:border-primary/50 transition-colors group cursor-pointer"
                      onClick={() => onViewProfile?.(friend.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 border border-zinc-700">
                          <AvatarImage src={getAvatarUrl(friend.id, friend.avatar) || undefined} />
                          <AvatarFallback>{friend.username[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white max-w-[120px] truncate flex items-center gap-1.5">
                              {friend.nickname || friend.username}
                              <VerifiedBadge isVerified={friend.is_discord_member} showText={false} className="w-3.5 h-3.5" />
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 text-green-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                              Online
                            </span>
                            <span>•</span>
                            <span className="font-mono text-primary">ELO {friend.elo}</span>
                          </div>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: SEARCH & REQUESTS */}
        <div className="space-y-6">
          {/* SEARCH SECTION */}
          <Card className="bg-zinc-950/50 backdrop-blur-sm border-white/10 shadow-lg">
            <CardHeader className="border-b border-white/10 bg-zinc-900/30">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Add Players
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by username..."
                    className="pl-9 bg-zinc-900/50 border-zinc-800"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
                <Button onClick={handleSearch} disabled={searchLoading} size="icon">
                  {searchLoading ? <span className="animate-spin">⌛</span> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              <div className="space-y-2">
                {searchResults.map((result) => (
                  <div key={result.id} className="flex items-center justify-between p-3 rounded-md bg-zinc-900/30 border border-white/5">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewProfile?.(result.id)}>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={getAvatarUrl(result.id, result.avatar) || undefined} />
                        <AvatarFallback>{result.username[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-white flex items-center gap-1.5">
                          {result.nickname || result.username}
                          <VerifiedBadge isVerified={result.is_discord_member} showText={false} className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-xs text-primary font-mono">ELO {result.elo}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => sendFriendRequest(result.id)} className="h-7 text-xs">
                      Add
                    </Button>
                  </div>
                ))}

                {searchResults.length === 0 && searchQuery && !searchLoading && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No players found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* REQUESTS SECTION */}
          <Card className="bg-zinc-950/50 backdrop-blur-sm border-white/10 shadow-lg">
            <CardHeader className="border-b border-white/10 bg-zinc-900/30">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Requests
                {pendingRequests.length > 0 && (
                  <Badge variant="destructive" className="ml-auto">
                    {pendingRequests.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No pending requests
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-3 rounded-md bg-zinc-900/30 border border-white/5">
                      <div className="flex items-center gap-3 cursor-pointer" onClick={() => onViewProfile?.(request.id)}>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={getAvatarUrl(request.id, request.avatar) || undefined} />
                          <AvatarFallback>{request.username[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-white flex items-center gap-1.5">
                            {request.nickname || request.username}
                            <VerifiedBadge isVerified={request.is_discord_member} showText={false} className="w-3.5 h-3.5" />
                          </span>
                          <span className="text-xs text-primary font-mono">ELO {request.elo}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="default" className="h-8 w-8 bg-green-600 hover:bg-green-700" onClick={() => acceptRequest(request.friendship_id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => declineRequest(request.friendship_id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
