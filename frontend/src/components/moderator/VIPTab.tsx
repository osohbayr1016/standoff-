import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TrendingUp, Users, Calendar, DollarSign } from "lucide-react";

interface VIPTabProps {
    backendUrl: string;
    userId: string;
}

interface VIPPurchase {
    id: string;
    user_id: string;
    discord_username: string;
    phone_number: string;
    screenshot_url: string;
    purchase_date: string;
    approved_date: string;
    user_avatar: string;
    standoff_nickname: string;
    is_vip: number;
    vip_until: string;
    reviewer_username: string;
    price: number;
    price_listed: number;
    payment_method: string;
}

interface VIPStats {
    total_purchases: number;
    unique_buyers: number;
    total_revenue: number;
    last_30_days: number;
    last_7_days: number;
    vip_price_net: number;
    vip_price_listed: number;
}

export default function VIPTab({ backendUrl, userId }: VIPTabProps) {
    const [purchases, setPurchases] = useState<VIPPurchase[]>([]);
    const [stats, setStats] = useState<VIPStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchPurchases();
    }, []);

    const fetchPurchases = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${backendUrl}/api/moderator/vip-purchases`, {
                headers: { 'X-User-Id': userId },
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setPurchases(data.purchases || []);
                setStats(data.stats || null);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('mn-MN').format(price) + '₮';
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (isLoading) {
        return <div className="text-center py-12 text-zinc-500">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-green-400 flex items-center gap-2">
                                <DollarSign className="h-4 w-4" /> Net Revenue
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-white">{formatPrice(stats.total_revenue)}</p>
                            <p className="text-xs text-zinc-400">{stats.total_purchases} purchases @ {formatPrice(stats.vip_price_net)}</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-blue-400 flex items-center gap-2">
                                <Users className="h-4 w-4" /> Unique Buyers
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-white">{stats.unique_buyers}</p>
                            <p className="text-xs text-zinc-400">VIP members</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-yellow-400 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" /> Last 7 Days
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-white">{stats.last_7_days}</p>
                            <p className="text-xs text-zinc-400">{formatPrice(stats.last_7_days * stats.vip_price_net)}</p>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm text-purple-400 flex items-center gap-2">
                                <Calendar className="h-4 w-4" /> Last 30 Days
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-white">{stats.last_30_days}</p>
                            <p className="text-xs text-zinc-400">{formatPrice(stats.last_30_days * stats.vip_price_net)}</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Purchases Table */}
            <Card className="bg-[#1e1f22] border-white/5">
                <CardHeader>
                    <CardTitle className="text-lg text-white">Purchase History</CardTitle>
                </CardHeader>
                <CardContent>
                    {purchases.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500">
                            No VIP purchases yet
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/10 text-left text-xs text-zinc-400 uppercase">
                                        <th className="pb-3 pr-4">User</th>
                                        <th className="pb-3 pr-4">Date</th>
                                        <th className="pb-3 pr-4">Net Received</th>
                                        <th className="pb-3 pr-4">Method</th>
                                        <th className="pb-3 pr-4">VIP Until</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {purchases.map(purchase => (
                                        <tr key={purchase.id} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="py-3 pr-4">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={`https://cdn.discordapp.com/avatars/${purchase.user_id}/${purchase.user_avatar}.png`} />
                                                        <AvatarFallback>U</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="text-sm font-medium text-white">{purchase.discord_username}</p>
                                                        {purchase.standoff_nickname && (
                                                            <p className="text-xs text-zinc-400">{purchase.standoff_nickname}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 pr-4 text-sm text-zinc-300">
                                                {formatDate(purchase.purchase_date)}
                                            </td>
                                            <td className="py-3 pr-4">
                                                <span className="text-sm font-mono text-green-400">{formatPrice(purchase.price)}</span>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">
                                                    {purchase.payment_method}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-4 text-sm text-zinc-300">
                                                {purchase.vip_until ? formatDate(purchase.vip_until) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
