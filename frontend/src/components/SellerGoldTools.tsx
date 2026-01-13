
import { useState, useEffect } from 'react';
import { useAuth } from '../utils/auth';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Loader2, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { toast } from 'sonner';

const DEFAULT_PRICE_LIST = [
    { gold: 100, price: 5000 }, { gold: 200, price: 9000 }, { gold: 300, price: 12000 },
    { gold: 400, price: 15000 }, { gold: 500, price: 17000 }, { gold: 600, price: 20000 },
    { gold: 700, price: 24000 }, { gold: 800, price: 27000 }, { gold: 900, price: 29000 },
    { gold: 1000, price: 31000 }, { gold: 1100, price: 35000 }, { gold: 1200, price: 39000 },
    { gold: 1300, price: 41000 }, { gold: 1400, price: 45000 }, { gold: 1500, price: 48000 },
    { gold: 1600, price: 53000 }, { gold: 1700, price: 56000 }, { gold: 2000, price: 58000 },
    { gold: 2100, price: 63000 }, { gold: 2200, price: 67000 }, { gold: 2300, price: 72000 },
    { gold: 2500, price: 75000 }, { gold: 3000, price: 88000 }, { gold: 3500, price: 108000 },
    { gold: 4000, price: 116000 }, { gold: 4500, price: 135000 }, { gold: 5000, price: 148000 },
    { gold: 6000, price: 178000 }
];

interface Order {
    id: string;
    user_id: string;
    gold_amount: number;
    price_mnt: number;
    status: 'pending' | 'completed' | 'rejected';
    proof_url: string;
    graffiti_url?: string;
    created_at: string;
    discord_username?: string;
    discord_avatar?: string;
}

export default function SellerGoldTools() {
    const { user, token } = useAuth();
    const [priceList, setPriceList] = useState(DEFAULT_PRICE_LIST);
    const [orders, setOrders] = useState<Order[]>([]);
    const [isEditingPrice, setIsEditingPrice] = useState<number | null>(null);
    const [editPriceValue, setEditPriceValue] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [newGold, setNewGold] = useState('');
    const [newPrice, setNewPrice] = useState('');
    const [isAddingPrice, setIsAddingPrice] = useState(false);
    const [userOrders, setUserOrders] = useState<Order[]>([]);
    const [activeTab, setActiveTab] = useState('history');

    const ALLOWED_SELLERS = ['1237067681623052288', '656126101235695626'];
    const isGoldSeller = user && ALLOWED_SELLERS.includes(user.id);

    useEffect(() => {
        fetchPrices();
        if (token) fetchOrders();
    }, [token, isGoldSeller]);

    const fetchPrices = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787'}/api/gold/prices`);
            const data = await res.json();
            if (data.success && data.prices.length > 0) {
                setPriceList(data.prices);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchOrders = async () => {
        setIsRefreshing(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787'}/api/gold/orders`, {
                headers: { 'Authorization': `Bearer ${token}`, 'X-User-Id': user?.id || '' }
            });
            const data = await res.json();
            if (data.success) {
                if (data.isSeller) setOrders(data.orders);
                else setUserOrders(data.orders);
            }
        } catch (e) { console.error(e); }
        finally { setIsRefreshing(false); }
    };

    const handleProcessOrder = async (orderId: string, status: 'completed' | 'rejected') => {
        if (!confirm(`Mark order as ${status}?`)) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787'}/api/gold/orders/${orderId}/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': user?.id || ''
                },
                body: JSON.stringify({ status })
            });
            if (res.ok) fetchOrders();
        } catch (e) {
            toast.error('Processing failed');
        }
    };

    const handleUpdatePrice = async (gold: number, newPrice: number, successText: string = 'Price updated') => {
        setPriceList(prev => {
            const exists = prev.find(p => p.gold === gold);
            if (exists) {
                return prev.map(p => p.gold === gold ? { gold, price: newPrice } : p);
            } else {
                return [...prev, { gold, price: newPrice }].sort((a, b) => a.gold - b.gold);
            }
        });

        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787'}/api/gold/prices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': user?.id || ''
                },
                body: JSON.stringify({ gold, price: newPrice })
            });
            if (res.ok) {
                toast.success(successText);
                setIsEditingPrice(null);
                setNewGold('');
                setNewPrice('');
            } else {
                fetchPrices();
                toast.error('Failed to update price');
            }
        } catch (e) {
            fetchPrices();
            toast.error('Failed to update price');
        }
    };

    const handleDeletePrice = async (gold: number) => {
        if (!confirm(`Delete ${gold} G package?`)) return;
        setPriceList(prev => prev.filter(p => p.gold !== gold));
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787'}/api/gold/prices`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': user?.id || ''
                },
                body: JSON.stringify({ gold })
            });
            if (res.ok) toast.success('Package deleted');
            else { fetchPrices(); toast.error('Failed to delete'); }
        } catch (e) { fetchPrices(); toast.error('Failed to delete'); }
    };

    const handleClearAllPrices = async () => {
        if (!confirm('Delete ALL gold packages?')) return;
        setPriceList([]);
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787'}/api/gold/prices/all`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}`, 'X-User-Id': user?.id || '' }
            });
            if (res.ok) toast.success('All packages cleared');
            else { fetchPrices(); toast.error('Failed to clear'); }
        } catch (e) { fetchPrices(); toast.error('Failed to clear'); }
    };

    if (!user) return null;

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-zinc-900 border border-white/10 p-1 mb-6 w-full justify-start">
                    <TabsTrigger value="history" className="flex-1">My Orders</TabsTrigger>
                    {isGoldSeller && <TabsTrigger value="seller" className="flex-1">Seller Dashboard</TabsTrigger>}
                </TabsList>

                <TabsContent value="history">
                    <Card className="bg-zinc-900/50 border-white/10 overflow-x-auto">
                        <CardHeader><CardTitle className="text-white text-sm">Order History</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-white/10">
                                        <TableHead>Date</TableHead>
                                        <TableHead>Package</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Price</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {userOrders.map(order => (
                                        <TableRow key={order.id} className="border-white/5">
                                            <TableCell className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString()}</TableCell>
                                            <TableCell className="font-bold text-yellow-500 text-xs">{order.gold_amount} G</TableCell>
                                            <TableCell>
                                                <Badge className="text-[10px]">{order.status}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-xs">{order.price_mnt?.toLocaleString()}₮</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {isGoldSeller && (
                    <TabsContent value="seller">
                        <Card className="bg-zinc-900/50 border-white/10">
                            <CardHeader className="flex flex-row justify-between items-center">
                                <CardTitle className="text-white text-sm">Seller Panel</CardTitle>
                                <Button size="sm" onClick={fetchOrders} disabled={isRefreshing}>Refresh</Button>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-white font-bold text-xs uppercase tracking-wider">Price Manager</h4>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-[10px] text-red-500 border-red-500/30 hover:bg-red-500/10"
                                        onClick={handleClearAllPrices}
                                    >
                                        <Trash2 className="w-3 h-3 mr-2" /> Clear All
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {priceList.map(pkg => (
                                        <div key={pkg.gold} className="bg-zinc-950/50 p-2 rounded border border-white/10 flex flex-col gap-1 relative group">
                                            <div className="flex justify-between items-start">
                                                <div className="text-[10px] text-yellow-500 font-bold">{pkg.gold} G</div>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-4 w-4 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                                    onClick={() => handleDeletePrice(pkg.gold)}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                            {isEditingPrice === pkg.gold ? (
                                                <div className="flex gap-1">
                                                    <input
                                                        className="w-full bg-zinc-900 text-white text-[10px] p-1 rounded border border-white/20"
                                                        autoFocus
                                                        value={editPriceValue}
                                                        onChange={(e) => setEditPriceValue(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleUpdatePrice(pkg.gold, Number(editPriceValue));
                                                            if (e.key === 'Escape') setIsEditingPrice(null);
                                                        }}
                                                    />
                                                    <Button size="icon" className="h-5 w-5 shrink-0 bg-green-600" onClick={() => handleUpdatePrice(pkg.gold, Number(editPriceValue))}>
                                                        <CheckCircle className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div
                                                    className="text-white text-xs font-mono cursor-pointer hover:bg-white/5 rounded px-1 -mx-1 flex justify-between items-center"
                                                    onClick={() => {
                                                        setIsEditingPrice(pkg.gold);
                                                        setEditPriceValue(pkg.price.toString());
                                                    }}
                                                >
                                                    {pkg.price.toLocaleString()}₮
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {/* Add New Package Card */}
                                    <div className="bg-zinc-900/80 p-2 rounded border border-yellow-500/30 flex flex-col gap-2">
                                        <div className="text-[10px] text-yellow-500 font-bold uppercase">Add New</div>
                                        <input
                                            className="w-full bg-black/50 text-white text-[10px] p-1 rounded border border-white/10"
                                            placeholder="Gold"
                                            type="number"
                                            value={newGold}
                                            onChange={e => setNewGold(e.target.value)}
                                        />
                                        <input
                                            className="w-full bg-black/50 text-white text-[10px] p-1 rounded border border-white/10"
                                            placeholder="Price"
                                            type="number"
                                            value={newPrice}
                                            onChange={e => setNewPrice(e.target.value)}
                                        />
                                        <Button size="sm" className="h-6 text-[10px] bg-yellow-600 hover:bg-yellow-700 w-full"
                                            disabled={isAddingPrice}
                                            onClick={async () => {
                                                if (!newGold || !newPrice) return toast.warning('Enter both gold and price');
                                                setIsAddingPrice(true);
                                                await handleUpdatePrice(Number(newGold), Number(newPrice), 'Package added successfully');
                                                setIsAddingPrice(false);
                                            }}
                                        >
                                            {isAddingPrice ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
                                        </Button>
                                    </div>
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow className="text-[10px]">
                                            <TableHead>User</TableHead>
                                            <TableHead>Gold</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {orders.map(order => (
                                            <TableRow key={order.id} className="border-white/5 text-xs">
                                                <TableCell>{order.discord_username}</TableCell>
                                                <TableCell className="text-yellow-500 font-bold">{order.gold_amount} G</TableCell>
                                                <TableCell>{order.status}</TableCell>
                                                <TableCell className="text-right">
                                                    {order.status === 'pending' && (
                                                        <Button size="sm" className="h-6 text-[10px]" onClick={() => handleProcessOrder(order.id, 'completed')}>OK</Button>
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
    );
}
