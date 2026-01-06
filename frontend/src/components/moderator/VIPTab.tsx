import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, X, ExternalLink, CreditCard } from "lucide-react";
import { toast } from "sonner";
import type { VIPRequest } from "./types";

interface VIPTabProps {
    backendUrl: string;
    userId: string;
}

export default function VIPTab({ backendUrl, userId }: VIPTabProps) {
    const [requests, setRequests] = useState<VIPRequest[]>([]);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${backendUrl}/api/moderator/vip-requests/pending`, {
                headers: { 'X-User-Id': userId },
                credentials: 'include'
            });
            if (res.ok) setRequests(await res.json());
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
        try {
            const res = await fetch(`${backendUrl}/api/moderator/vip-requests/${requestId}/${action}`, {
                method: 'POST',
                headers: { 'X-User-Id': userId },
                credentials: 'include'
            });
            if (res.ok) {
                toast.success(`Request ${action}ed`);
                fetchRequests();
            } else {
                toast.error("Failed to process request");
            }
        } catch (error) {
            toast.error("Error connecting to server");
        }
    };

    return (
        <div className="space-y-4">
            {isLoading ? (
                <div className="text-center py-12 text-zinc-500">Loading...</div>
            ) : requests.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 bg-[#1e1f22]/50 rounded-xl border border-white/5 border-dashed">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No pending VIP requests</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {requests.map(req => (
                        <Card key={req.id} className="bg-[#1e1f22] border-white/5 overflow-hidden">
                            <CardContent className="p-0">
                                <div
                                    className="h-48 bg-black/50 relative group cursor-pointer"
                                    onClick={() => setSelectedImage(req.screenshot_url)}
                                >
                                    <img
                                        src={req.screenshot_url}
                                        alt="Proof"
                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                        <ExternalLink className="text-white h-8 w-8" />
                                    </div>
                                </div>
                                <div className="p-4">
                                    <div className="flex items-center gap-3 mb-4">
                                        <Avatar>
                                            <AvatarImage src={`https://cdn.discordapp.com/avatars/${req.user_id}/${req.user_discord_avatar}.png`} />
                                            <AvatarFallback>U</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-bold text-white">{req.discord_username}</p>
                                            <p className="text-xs text-zinc-400">Submitted: {new Date(req.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>

                                    {req.phone_number && (
                                        <div className="mb-4 p-2 bg-zinc-900 rounded text-sm font-mono text-zinc-300">
                                            Phone: {req.phone_number}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleAction(req.id, 'approve')}>
                                            <Check className="h-4 w-4 mr-2" /> Approve
                                        </Button>
                                        <Button className="flex-1" variant="destructive" onClick={() => handleAction(req.id, 'reject')}>
                                            <X className="h-4 w-4 mr-2" /> Reject
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
                <DialogContent className="max-w-4xl bg-black border-white/10 p-0 overflow-hidden">
                    {selectedImage && (
                        <img src={selectedImage} alt="Full Proof" className="w-full h-full object-contain" />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
