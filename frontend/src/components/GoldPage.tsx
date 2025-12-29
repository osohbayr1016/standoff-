
import { useState, useEffect } from 'react';
import { useAuth } from '../utils/auth';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coins, History, CheckCircle, FileText, Upload, PlayCircle, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

const GOLD_SELLER_ROLE_ID = '1455115991049703579';

interface Order {
    id: string;
    user_id: string;
    gold_amount: number;
    price_mnt: number;
    status: 'pending' | 'completed' | 'rejected';
    proof_url: string;
    created_at: string;
    discord_username?: string;
    discord_avatar?: string;
}

export default function GoldPage() {
    const { user, token } = useAuth();
    const [activeTab, setActiveTab] = useState('buy');

    // Seller State
    const [orders, setOrders] = useState<Order[]>([]);

    // Buyer State
    const [buyAmount, setBuyAmount] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userOrders, setUserOrders] = useState<Order[]>([]);

    const isGoldSeller = user && (
        (user.role === 'admin') ||
        (user.discord_roles && user.discord_roles.includes(GOLD_SELLER_ROLE_ID))
    );

    useEffect(() => {
        if (token) fetchOrders();
    }, [token, isGoldSeller]);

    const fetchOrders = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/gold/orders`, {
                headers: { 'Authorization': `Bearer ${token}`, 'X-User-Id': user?.id || '' }
            });
            const data = await res.json();
            if (data.success) {
                if (data.isSeller) setOrders(data.orders);
                else setUserOrders(data.orders);
            }
        } catch (e) { console.error(e); }
    };

    const handleBuySubmit = async () => {
        if (!buyAmount || !proofFile) {
            alert('Please enter amount and upload proof.');
            return;
        }
        setIsSubmitting(true);
        try {
            // 1. Upload Proof
            const formData = new FormData();
            formData.append('file', proofFile);
            const uploadRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'X-User-Id': user?.id || '' },
                body: formData
            });
            if (!uploadRes.ok) throw new Error('Failed to upload proof image');
            const uploadData = await uploadRes.json();

            // 2. Submit Order
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/gold/request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': user?.id || ''
                },
                body: JSON.stringify({
                    goldAmount: buyAmount,
                    proofUrl: uploadData.url
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('Order submitted successfully! Wait 5-20 minutes.');
                setBuyAmount('');
                setProofFile(null);
                fetchOrders();
                setActiveTab('history');
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (e: any) {
            alert(`Failed: ${e.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleProcessOrder = async (orderId: string, status: 'completed' | 'rejected') => {
        if (!confirm(`Mark order as ${status}?`)) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/gold/orders/${orderId}/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': user?.id || ''
                },
                body: JSON.stringify({ status })
            });
            if (res.ok) fetchOrders();
        } catch (e) { alert('Failed to process order'); }
    };

    if (!user) return <div className="text-white text-center pt-20">Please log in.</div>;

    return (
        <div className="min-h-screen bg-black/95 pt-24 pb-12 px-4 sm:px-6">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                            <Coins className="w-8 h-8 text-yellow-500" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">Standoff 2 Gold Market</h1>
                            <p className="text-gray-400">Secure & Fast Gold Delivery (5-20 mins)</p>
                        </div>
                    </div>
                    {isGoldSeller && (
                        <Badge variant="outline" className="border-yellow-500 text-yellow-500 bg-yellow-500/10">
                            SELLER MODE
                        </Badge>
                    )}
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="bg-zinc-900 border border-white/10 p-1 mb-8">
                        <TabsTrigger value="buy" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
                            Request Gold
                        </TabsTrigger>
                        <TabsTrigger value="history" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
                            My Orders
                        </TabsTrigger>
                        {isGoldSeller && (
                            <TabsTrigger value="seller" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
                                Seller Dashboard
                            </TabsTrigger>
                        )}
                    </TabsList>

                    {/* BUY GOLD TAB */}
                    <TabsContent value="buy">
                        <div className="grid md:grid-cols-2 gap-8">
                            <Card className="bg-zinc-900/50 border-white/10">
                                <CardHeader>
                                    <CardTitle className="text-white">How to Buy</CardTitle>
                                    <CardDescription>Follow these steps carefully.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6 text-gray-300">
                                    <div className="space-y-2">
                                        <h3 className="font-bold text-white flex items-center gap-2">
                                            <span className="bg-yellow-500 text-black w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                                            Market Listing
                                        </h3>
                                        <p className="text-sm">
                                            Маркет Gold-р авхын тулд зураг дээрх <span className="text-yellow-500 font-bold">"Mad Move"</span> нэртэй graffiti авсан байх ёстой.
                                        </p>
                                        <div className="mt-2 rounded-lg overflow-hidden border border-white/10">
                                            {/* Placeholder for Graffiti Image */}
                                            <div className="bg-zinc-800 h-40 flex items-center justify-center text-gray-500 italic">
                                                [Graffiti "Mad Move" Image Here]
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="font-bold text-white flex items-center gap-2">
                                            <span className="bg-yellow-500 text-black w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
                                            Instructions
                                        </h3>
                                        <p className="text-sm">
                                            Хэрвээ авч мэдэхгүй байвал доорхи видео заавар товч дээр дарж бичлэг үзээрэй.
                                        </p>
                                        <Button variant="outline" className="w-full border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10">
                                            <PlayCircle className="w-4 h-4 mr-2" /> Видео Заавар (Video)
                                        </Button>
                                    </div>

                                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg text-yellow-200">
                                        <h4 className="font-bold mb-1">Delivery Time</h4>
                                        <p className="text-sm">Gold орох хугацаа 5-20мин.</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-zinc-900/50 border-white/10">
                                <CardHeader>
                                    <CardTitle className="text-white">Submit Request</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-white">Gold Amount (That you listed)</Label>
                                        <Input
                                            type="number"
                                            placeholder="e.g. 1000"
                                            value={buyAmount}
                                            onChange={(e) => setBuyAmount(e.target.value)}
                                            className="bg-zinc-950 border-white/10 text-white"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-white">Payment Proof (Screenshot)</Label>
                                        <div className="border-2 border-dashed border-white/20 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-yellow-500/50 transition-colors bg-zinc-950/30">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                id="proof-upload"
                                                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                                            />
                                            <label htmlFor="proof-upload" className="flex flex-col items-center cursor-pointer w-full">
                                                {proofFile ? (
                                                    <div className="flex items-center gap-2 text-green-500">
                                                        <CheckCircle className="w-6 h-6" />
                                                        <span className="text-sm truncate max-w-[200px]">{proofFile.name}</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                                        <span className="text-sm text-gray-400">Click to upload transaction screenshot</span>
                                                    </>
                                                )}
                                            </label>
                                        </div>
                                    </div>

                                    <Button
                                        className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold h-12 text-lg"
                                        onClick={handleBuySubmit}
                                        disabled={isSubmitting || !buyAmount || !proofFile}
                                    >
                                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : 'Submit Request'}
                                    </Button>
                                    <p className="text-xs text-center text-gray-500">
                                        By submitting, you confirm you have listed the item in market.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* HISTORY TAB */}
                    <TabsContent value="history">
                        <Card className="bg-zinc-900/50 border-white/10">
                            <CardHeader>
                                <CardTitle className="text-white">My Orders</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-white/10">
                                            <TableHead>Date</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Proof</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {userOrders.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-gray-500">No recent orders</TableCell>
                                            </TableRow>
                                        ) : (
                                            userOrders.map(order => (
                                                <TableRow key={order.id} className="border-white/5">
                                                    <TableCell className="text-gray-300">
                                                        {new Date(order.created_at).toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="font-bold text-yellow-500">{order.gold_amount} G</TableCell>
                                                    <TableCell>
                                                        <Badge className={
                                                            order.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                                                                order.status === 'rejected' ? 'bg-red-500/20 text-red-500' :
                                                                    'bg-yellow-500/20 text-yellow-500'
                                                        }>
                                                            {order.status.toUpperCase()}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <a href={order.proof_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-sm">
                                                            View Image
                                                        </a>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* SELLER DASHBOARD TAB */}
                    {isGoldSeller && (
                        <TabsContent value="seller">
                            <Card className="bg-zinc-900/50 border-white/10">
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-white">Incoming Orders (Manage)</CardTitle>
                                        <Button variant="outline" onClick={fetchOrders} size="sm"><History className="w-4 h-4 mr-2" /> Refresh</Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-white/10">
                                                <TableHead>User</TableHead>
                                                <TableHead>Amount</TableHead>
                                                <TableHead>Proof</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {orders.map(order => (
                                                <TableRow key={order.id} className="border-white/5">
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Avatar className="w-6 h-6">
                                                                <AvatarImage src={`https://cdn.discordapp.com/avatars/${order.user_id}/${order.discord_avatar}.png`} />
                                                                <AvatarFallback>?</AvatarFallback>
                                                            </Avatar>
                                                            <div className="text-white text-sm">
                                                                <div>{order.discord_username}</div>
                                                                <div className="text-xs text-gray-500">{order.user_id}</div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-bold text-yellow-400">{order.gold_amount} G</TableCell>
                                                    <TableCell>
                                                        {order.proof_url && (
                                                            <a href={order.proof_url} target="_blank" rel="noreferrer" className="flex items-center text-blue-400 hover:underline text-xs">
                                                                <FileText className="w-3 h-3 mr-1" /> Open
                                                            </a>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={
                                                            order.status === 'pending' ? 'border-yellow-500 text-yellow-500' :
                                                                order.status === 'completed' ? 'border-green-500 text-green-500' :
                                                                    'border-red-500 text-red-500'
                                                        }>{order.status}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right space-x-2">
                                                        {order.status === 'pending' && (
                                                            <>
                                                                <Button size="sm" onClick={() => handleProcessOrder(order.id, 'completed')} className="bg-green-600 hover:bg-green-700 h-7 text-xs">
                                                                    Approve
                                                                </Button>
                                                                <Button size="sm" onClick={() => handleProcessOrder(order.id, 'rejected')} variant="destructive" className="h-7 text-xs">
                                                                    Reject
                                                                </Button>
                                                            </>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    )}
                </Tabs>
            </div>
        </div>
    );
}
