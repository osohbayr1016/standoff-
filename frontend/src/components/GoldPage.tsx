
import { useState, useEffect } from 'react';
import { useAuth } from '../utils/auth';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coins, History, CheckCircle, FileText, Upload, PlayCircle, Loader2, Image as ImageIcon } from "lucide-react";
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
import { toast } from 'sonner';




// Default for fallback only
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

export default function GoldPage() {
    const { user, token } = useAuth();
    const [activeTab, setActiveTab] = useState('buy');

    // Shared State
    const [priceList, setPriceList] = useState(DEFAULT_PRICE_LIST);

    // Seller State
    const [orders, setOrders] = useState<Order[]>([]);
    const [isEditingPrice, setIsEditingPrice] = useState<number | null>(null);
    const [editPriceValue, setEditPriceValue] = useState('');

    // Buyer State
    const [selectedPackage, setSelectedPackage] = useState<{ gold: number, price: number } | null>(null);
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [graffitiFile, setGraffitiFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userOrders, setUserOrders] = useState<Order[]>([]);

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
    };

    const uploadFile = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787'}/api/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'X-User-Id': user?.id || '' },
            body: formData
        });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        return data.url;
    };

    const handleBuySubmit = async () => {
        if (!selectedPackage || !proofFile || !graffitiFile) {
            toast.warning('Missing information', {
                description: 'Please select a package and upload both images (Graffiti & Payment)'
            });
            return;
        }
        setIsSubmitting(true);
        try {
            // Upload Both Files
            const [proofUrl, graffitiUrl] = await Promise.all([
                uploadFile(proofFile),
                uploadFile(graffitiFile)
            ]);

            // Submit Order
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787'}/api/gold/request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': user?.id || ''
                },
                body: JSON.stringify({
                    goldAmount: selectedPackage.gold,
                    priceMnt: selectedPackage.price,
                    proofUrl,
                    graffitiUrl
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Order submitted!', { description: 'Check My Orders tab for status updates' });
                setSelectedPackage(null);
                setProofFile(null);
                setGraffitiFile(null);
                fetchOrders();
                setActiveTab('history');
            } else {
                toast.error('Order failed', { description: data.error || 'Please try again' });
            }
        } catch (e: any) {
            toast.error('Submission failed', { description: e.message || 'Unable to submit your order' });
        } finally {
            setIsSubmitting(false);
        }
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
            toast.error('Processing failed', { description: 'Unable to process your order' });
        }
    };

    const handleUpdatePrice = async (gold: number, newPrice: number) => {
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
                toast.success('Price updated');
                fetchPrices(); // Refresh
                setIsEditingPrice(null);
            }
        } catch (e) {
            toast.error('Failed to update price');
        }
    };

    const [transferUserId, setTransferUserId] = useState('');
    const [transferAmount, setTransferAmount] = useState('');
    const [transferReason, setTransferReason] = useState('');

    const handleManualTransfer = async () => {
        if (!transferUserId || !transferAmount || !transferReason) return toast.warning('Fill all fields');
        if (!confirm(`Are you sure you want to transfer ${transferAmount} G to ${transferUserId}?`)) return;

        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787'}/api/gold/manual`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': user?.id || ''
                },
                body: JSON.stringify({
                    userId: transferUserId,
                    amount: Number(transferAmount),
                    reason: transferReason
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Transfer successful');
                setTransferUserId('');
                setTransferAmount('');
                setTransferReason('');
            } else {
                toast.error(data.error || 'Transfer failed');
            }
        } catch (e) {
            toast.error('Failed to execute transfer');
        }
    };

    if (!user) return <div className="text-white text-center pt-20">Please log in.</div>;

    return (
        <div className="min-h-screen bg-black/95 pt-20 pb-12 px-2 sm:px-6">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header */}
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center mb-4">
                    <p className="text-red-500 font-bold uppercase animate-pulse">
                        ⚠️ Odoogor ajilgaagui bga ⚠️
                    </p>
                </div>

                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                            <Coins className="w-6 h-6 text-yellow-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">Gold Market</h1>
                            <p className="text-xs text-gray-400">Secure Delivery (5-20m)</p>
                        </div>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="bg-zinc-900 border border-white/10 p-1 mb-6 w-full justify-start overflow-x-auto no-scrollbar">
                        <TabsTrigger value="buy" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black flex-1 min-w-[100px]">
                            Buy Gold
                        </TabsTrigger>
                        <TabsTrigger value="history" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black flex-1 min-w-[100px]">
                            My Orders
                        </TabsTrigger>
                        {isGoldSeller && (
                            <TabsTrigger value="seller" className="data-[state=active]:bg-red-500 data-[state=active]:text-white flex-1 min-w-[120px]">
                                Seller
                            </TabsTrigger>
                        )}
                    </TabsList>

                    {/* BUY GOLD TAB */}
                    <TabsContent value="buy">
                        <div className="grid lg:grid-cols-12 gap-6">

                            {/* Left: Packages Grid */}
                            <div className="lg:col-span-8 space-y-4">
                                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                    <span className="bg-yellow-500 text-black w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                                    Select Package
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {priceList.map((pkg) => (
                                        <button
                                            key={pkg.gold}
                                            onClick={() => setSelectedPackage(pkg)}
                                            className={`relative p-3 rounded-xl border transition-all duration-200 flex flex-col items-center justify-center gap-1 group
                                                ${selectedPackage?.gold === pkg.gold
                                                    ? 'bg-yellow-500 border-yellow-400 shadow-lg shadow-yellow-500/20 scale-105 z-10'
                                                    : 'bg-zinc-900/50 border-white/10 hover:border-yellow-500/50 hover:bg-zinc-800'
                                                }`}
                                        >
                                            <span className={`text-lg font-black tracking-tight ${selectedPackage?.gold === pkg.gold ? 'text-black' : 'text-yellow-400'}`}>
                                                {pkg.gold} G
                                            </span>
                                            <span className={`text-xs font-mono font-bold ${selectedPackage?.gold === pkg.gold ? 'text-black/80' : 'text-gray-400'}`}>
                                                {pkg.price.toLocaleString()}₮
                                            </span>
                                            {/* Shine effect */}
                                            {selectedPackage?.gold === pkg.gold && (
                                                <div className="absolute inset-0 rounded-xl bg-white/20 animate-pulse pointer-events-none" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Instructions & Upload */}
                            <div className="lg:col-span-4 space-y-6">
                                <Card className="bg-zinc-900/80 border-white/10 sticky top-24">
                                    <CardHeader className="pb-3">
                                        <div className="bg-red-500/10 border border-red-500/20 rounded p-2 mb-2 text-center">
                                            <p className="text-red-400 text-xs font-bold uppercase animate-pulse">
                                                Анхааруулга: Order Detail заавал уншина уу!
                                            </p>
                                        </div>
                                        <CardTitle className="text-white text-lg">Order Details</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">

                                        {/* Selected Summary */}
                                        <div className="bg-zinc-950 p-4 rounded-lg border border-white/5 space-y-2">
                                            <div className="flex justify-between text-sm text-gray-400">
                                                <span>Танд очих:</span>
                                                <span className="text-white font-bold">{selectedPackage ? `${selectedPackage.gold} G` : '-'}</span>
                                            </div>
                                            <div className="flex justify-between text-base">
                                                <span className="text-yellow-500 font-bold">Graffiti тавих үнэ:</span>
                                                <span className="text-yellow-500 font-bold text-lg">{selectedPackage ? `${Math.ceil(selectedPackage.gold / 0.8)} G` : '-'}</span>
                                            </div>
                                            <div className="flex justify-between text-sm text-gray-400">
                                                <span>Төлөх дүн:</span>
                                                <span className="text-green-400 font-bold">{selectedPackage ? `${selectedPackage.price.toLocaleString()}₮` : '-'}</span>
                                            </div>
                                        </div>

                                        {/* Instructions */}
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <h4 className="text-white text-sm font-bold flex items-center gap-2">
                                                    <span className="bg-yellow-500 text-black w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
                                                    Follow Steps
                                                </h4>
                                                <div className="text-xs text-gray-400 space-y-2">
                                                    <p>
                                                        Market дээр Graffiti-г <span className="text-yellow-500 font-bold text-sm">{selectedPackage ? Math.ceil(selectedPackage.gold / 0.8) : '...'} G</span> үнээр тавина уу.
                                                    </p>
                                                    <p className="text-[10px] text-gray-500">
                                                        (20% шимтгэл хасагдаад, танд <span className="text-white">{selectedPackage?.gold} G</span> очих болно.)
                                                    </p>

                                                    <div className="bg-zinc-950/50 p-2 rounded border border-white/5">
                                                        <p className="italic text-[10px] text-gray-500">
                                                            Хэрвээ авах Gold байхгүй бол өөрт байгаа Item/skin зарах эсвэл match дараад тоглоод box нээгээд унагасан skin -ээ цуглуулж зараад авч болно.
                                                        </p>
                                                    </div>
                                                    <p>Зарсныхаа дараа "Only My Requests" дээр дарж SCREENSHOT явуулаарай.</p>
                                                </div>
                                                {/* Tutorial Image */}
                                                <div className="rounded-lg overflow-hidden border border-white/10 bg-zinc-950 h-40 flex items-center justify-center relative group cursor-pointer" onClick={() => window.open('/gold_tutorial.jpg', '_blank')}>
                                                    <img
                                                        src="/gold_tutorial.jpg"
                                                        alt="Tutorial"
                                                        className="h-full w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                                    />
                                                    <div className="absolute bottom-1 right-1 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white">View Full</div>
                                                </div>
                                                <Button
                                                    variant="outline" size="sm"
                                                    className="w-full text-xs border-yellow-500/30 text-yellow-500 h-7"
                                                    onClick={() => window.open('https://www.youtube.com/watch?v=7VFt3QQNzxw', '_blank')}
                                                >
                                                    <PlayCircle className="w-3 h-3 mr-1" /> Видео заавар (Video)
                                                </Button>
                                            </div>

                                            {/* Uploads */}
                                            <div className="space-y-3">
                                                <div className="space-y-1">
                                                    <Label className="text-white text-xs">1. Graffiti Screenshot (In Market)</Label>
                                                    <div className={`border-2 border-dashed rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer transition-colors ${graffitiFile ? 'border-green-500/50 bg-green-500/10' : 'border-white/20 hover:border-yellow-500/50 bg-zinc-950/50'}`}>
                                                        <input type="file" accept="image/*" className="hidden" id="graffiti-upload" onChange={(e) => setGraffitiFile(e.target.files?.[0] || null)} />
                                                        <label htmlFor="graffiti-upload" className="w-full h-full flex items-center justify-center gap-2 cursor-pointer">
                                                            {graffitiFile ? <CheckCircle className="w-5 h-5 text-green-500" /> : <ImageIcon className="w-5 h-5 text-gray-400" />}
                                                            <span className="text-xs text-gray-300 truncate max-w-[150px]">{graffitiFile ? graffitiFile.name : 'Upload Graffiti'}</span>
                                                        </label>
                                                    </div>
                                                </div>

                                                <div className="space-y-1">
                                                    <Label className="text-white text-xs">2. Bank Transfer Proof</Label>
                                                    <div className={`border-2 border-dashed rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer transition-colors ${proofFile ? 'border-green-500/50 bg-green-500/10' : 'border-white/20 hover:border-yellow-500/50 bg-zinc-950/50'}`}>
                                                        <input type="file" accept="image/*" className="hidden" id="proof-upload" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                                                        <label htmlFor="proof-upload" className="w-full h-full flex items-center justify-center gap-2 cursor-pointer">
                                                            {proofFile ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Upload className="w-5 h-5 text-gray-400" />}
                                                            <span className="text-xs text-gray-300 truncate max-w-[150px]">{proofFile ? proofFile.name : 'Upload Payment'}</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>

                                            <Button
                                                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold h-10"
                                                onClick={handleBuySubmit}
                                                disabled={isSubmitting || !selectedPackage || !proofFile || !graffitiFile}
                                            >
                                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Submit Order'}
                                            </Button>

                                            {/* Contact */}
                                            <div className="text-[10px] text-gray-500 text-center space-x-2">
                                                <span>Tel: 95500327</span>
                                                <span>•</span>
                                                <a href="https://www.facebook.com/people/Daisukemn/61585481892424/" target="_blank" className="text-blue-400 hover:underline">FB Page</a>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>

                    {/* HISTORY TAB */}
                    <TabsContent value="history">
                        <Card className="bg-zinc-900/50 border-white/10 overflow-x-auto">
                            <CardHeader><CardTitle className="text-white">Order History</CardTitle></CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-white/10 hover:bg-transparent">
                                            <TableHead>Date</TableHead>
                                            <TableHead>Package</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Price</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {userOrders.length === 0 ? (
                                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-500">No orders</TableCell></TableRow>
                                        ) : (
                                            userOrders.map(order => (
                                                <TableRow key={order.id} className="border-white/5 hover:bg-white/5">
                                                    <TableCell className="text-gray-300 text-xs">{new Date(order.created_at).toLocaleDateString()}</TableCell>
                                                    <TableCell className="font-bold text-yellow-500">{order.gold_amount} G</TableCell>
                                                    <TableCell>
                                                        <Badge className={`text-[10px] ${order.status === 'completed' ? 'bg-green-500/20 text-green-500' : order.status === 'rejected' ? 'bg-red-500/20 text-red-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                                                            {order.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-gray-400">{order.price_mnt?.toLocaleString()}₮</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* SELLER TAB */}
                    {isGoldSeller && (
                        <TabsContent value="seller">
                            <Card className="bg-zinc-900/50 border-white/10 overflow-hidden">
                                <CardHeader className="flex flex-row justify-between items-center bg-red-900/10">
                                    <CardTitle className="text-white text-lg">Seller Dashboard</CardTitle>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={fetchPrices}><Coins className="w-3 h-3 mr-2" /> Syn Prices</Button>
                                        <Button variant="outline" size="sm" onClick={fetchOrders}><History className="w-3 h-3 mr-2" /> Refresh Orders</Button>
                                    </div>
                                </CardHeader>
                                <div className="p-4 border-b border-white/10">
                                    <h4 className="text-white font-bold mb-4">Price Editor</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                        {priceList.map(pkg => (
                                            <div key={pkg.gold} className="bg-zinc-950/50 p-2 rounded border border-white/10 flex flex-col gap-1">
                                                <div className="text-xs text-yellow-500 font-bold">{pkg.gold} G</div>
                                                {isEditingPrice === pkg.gold ? (
                                                    <div className="flex gap-1">
                                                        <input
                                                            className="w-full bg-zinc-900 text-white text-xs p-1 rounded border border-white/20"
                                                            autoFocus
                                                            defaultValue={pkg.price}
                                                            onChange={(e) => setEditPriceValue(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleUpdatePrice(pkg.gold, Number((e.target as any).value));
                                                                if (e.key === 'Escape') setIsEditingPrice(null);
                                                            }}
                                                        />
                                                        <Button size="icon" className="h-6 w-6 shrink-0 bg-green-600" onClick={() => handleUpdatePrice(pkg.gold, Number(editPriceValue || pkg.price))}>
                                                            <CheckCircle className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="text-white text-sm font-mono cursor-pointer hover:text-yellow-400 flex items-center gap-1"
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
                                    </div>
                                </div>

                                <div className="p-4 border-b border-white/10 bg-zinc-900/30">
                                    <h4 className="text-white font-bold mb-4">Manual Tool</h4>
                                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                                        <div className="space-y-1 w-full sm:w-auto">
                                            <Label className="text-xs text-gray-400">User ID</Label>
                                            <input
                                                className="w-full sm:w-48 bg-zinc-950 text-white text-sm p-2 rounded border border-white/10"
                                                placeholder="Discord User ID"
                                                value={transferUserId}
                                                onChange={e => setTransferUserId(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1 w-full sm:w-auto">
                                            <Label className="text-xs text-gray-400">Amount (+/-)</Label>
                                            <input
                                                className="w-full sm:w-32 bg-zinc-950 text-white text-sm p-2 rounded border border-white/10"
                                                type="number"
                                                placeholder="e.g. 100 or -100"
                                                value={transferAmount}
                                                onChange={e => setTransferAmount(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1 w-full">
                                            <Label className="text-xs text-gray-400">Reason</Label>
                                            <input
                                                className="w-full bg-zinc-950 text-white text-sm p-2 rounded border border-white/10"
                                                placeholder="e.g. Refund, Bonus, Correction"
                                                value={transferReason}
                                                onChange={e => setTransferReason(e.target.value)}
                                            />
                                        </div>
                                        <Button className="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-700" onClick={handleManualTransfer}>
                                            Execute
                                        </Button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-white/10">
                                                <TableHead className="w-[200px]">User</TableHead>
                                                <TableHead>Gold</TableHead>
                                                <TableHead>Price</TableHead>
                                                <TableHead>Proofs</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
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
                                                            <div className="text-xs text-white">
                                                                <div className="font-bold">{order.discord_username}</div>
                                                                <div className="text-[10px] text-gray-500">{order.user_id}</div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-bold text-yellow-500">{order.gold_amount} G</TableCell>
                                                    <TableCell className="text-gray-400 text-xs">{order.price_mnt?.toLocaleString()}₮</TableCell>
                                                    <TableCell className="space-y-1">
                                                        {order.graffiti_url && (
                                                            <a href={order.graffiti_url} target="_blank" className="flex items-center text-blue-400 hover:text-blue-300 text-[10px]">
                                                                <ImageIcon className="w-3 h-3 mr-1" /> Graffiti
                                                            </a>
                                                        )}
                                                        <a href={order.proof_url} target="_blank" className="flex items-center text-green-400 hover:text-green-300 text-[10px]">
                                                            <FileText className="w-3 h-3 mr-1" /> Payment
                                                        </a>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={`text-[10px] ${order.status === 'pending' ? 'border-yellow-500 text-yellow-500' :
                                                            order.status === 'completed' ? 'border-green-500 text-green-500' :
                                                                'border-red-500 text-red-500'
                                                            }`}>{order.status}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {order.status === 'pending' && (
                                                            <div className="flex justify-end gap-1">
                                                                <Button size="sm" onClick={() => handleProcessOrder(order.id, 'completed')} className="bg-green-600 hover:bg-green-700 h-6 text-[10px] px-2">OK</Button>
                                                                <Button size="sm" onClick={() => handleProcessOrder(order.id, 'rejected')} variant="destructive" className="h-6 text-[10px] px-2">X</Button>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>
                        </TabsContent>
                    )}
                </Tabs>

                <div className="text-[10px] text-gray-600 font-mono mt-10 text-center opacity-50 hover:opacity-100">
                    DEBUG: ID:{user.id.substring(0, 8)}... | Role:{user.role} | DRoles:{user.discord_roles ? JSON.stringify(user.discord_roles) : 'NuLL'}
                </div>
            </div>
        </div>
    );
}
