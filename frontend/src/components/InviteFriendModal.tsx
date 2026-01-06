import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Loader2 } from "lucide-react";

interface Friend {
    id: string;
    username: string;
    nickname?: string;
    avatar?: string;
    elo: number;
    is_online?: boolean;  // Added is_online
}

interface InviteFriendModalProps {
    isOpen: boolean;
    currentPartyIds: string[];
    onInvite: (friend: Friend) => void;
    onClose: () => void;
}

export default function InviteFriendModal({ isOpen, currentPartyIds, onInvite, onClose }: InviteFriendModalProps) {
    const [friends, setFriends] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const fetchFriends = async () => {
            const savedUser = localStorage.getItem('user');
            if (!savedUser) return;

            const user = JSON.parse(savedUser);

            try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787'}/api/friends/${user.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setFriends(data.friends || []);
                } else {
                    setError('Failed to load friends');
                }
            } catch (err) {
                console.error('Failed to fetch friends', err);
                setError('Network error');
            } finally {
                setLoading(false);
            }
        };

        fetchFriends();
    }, [isOpen]);

    // Filter friends not in party, prioritising online friends
    const availableFriends = friends
        .filter(f => !currentPartyIds.includes(f.id))
        .sort((a, b) => (b.is_online ? 1 : 0) - (a.is_online ? 1 : 0));

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md bg-zinc-900 text-white border-zinc-800">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Invite Players
                    </DialogTitle>
                </DialogHeader>

                <div className="py-2">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : error ? (
                        <div className="text-center text-red-400 py-4">{error}</div>
                    ) : availableFriends.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            No active friends available to invite.
                        </div>
                    ) : (
                        <div className="h-[300px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                            {availableFriends.map(friend => (
                                <div
                                    key={friend.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors border border-white/5"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <Avatar className="h-10 w-10 border border-white/10">
                                                <AvatarImage src={`https://cdn.discordapp.com/avatars/${friend.id}/${friend.avatar}.png`} />
                                                <AvatarFallback>{friend.username[0]}</AvatarFallback>
                                            </Avatar>
                                            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-zinc-900 ${friend.is_online ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-zinc-500'}`} />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-sm flex items-center gap-2">
                                                {friend.nickname || friend.username}
                                                <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-zinc-700 text-zinc-300">
                                                    {friend.elo}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                {friend.is_online ? (
                                                    <span className="text-green-400 font-medium">Online</span>
                                                ) : (
                                                    <span>Offline</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => onInvite(friend)}
                                        className={friend.is_online ? "bg-primary hover:bg-primary/90" : "bg-zinc-700 hover:bg-zinc-600"}
                                    >
                                        Invite
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog >
    );
}
