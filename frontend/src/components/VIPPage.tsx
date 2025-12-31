import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Crown, Trophy, Shield, Zap, Check, Upload, AlertTriangle,
    Clock, CheckCircle2, XCircle
} from "lucide-react";

interface VIPPageProps {
    user: {
        id: string;
        username: string;
        avatar?: string;
        is_vip?: number | boolean;
        vip_until?: string;
    } | null;
    backendUrl: string;
}

interface VIPRequest {
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    reviewed_at?: string;
    rejection_reason?: string;
    screenshot_url?: string;
}

export default function VIPPage({ user, backendUrl }: VIPPageProps) {
    const [phoneNumber, setPhoneNumber] = useState('');
    // const [message, setMessage] = useState(''); // Unused for now in QPay flow unless we added it back?
    // Actually I removed the textarea in step 72. So remove message state.
    const [invoice, setInvoice] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [currentRequest, setCurrentRequest] = useState<VIPRequest | null>(null);
    const [checkingPayment, setCheckingPayment] = useState(false);

    useEffect(() => {
        if (user) {
            fetchCurrentRequest();
        }
    }, [user]);

    const fetchCurrentRequest = async () => {
        try {
            const response = await fetch(`${backendUrl}/api/vip-requests/my-request`, {
                headers: { 'X-User-Id': user?.id || '' }
            });
            const data = await response.json();
            if (data.success && data.request) {
                setCurrentRequest(data.request);
            }
        } catch (err) {
            console.error('Error fetching VIP request:', err);
        }
    };

    useEffect(() => {
        let interval: any;

        if (invoice && !success) {
            setCheckingPayment(true);
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`${backendUrl}/api/vip-requests/check-payment`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-User-Id': user?.id || ''
                        },
                        body: JSON.stringify({
                            invoice_id: invoice.invoice_id,
                            phone_number: phoneNumber,
                            discord_username: user?.username
                        })
                    });
                    const data = await res.json();
                    if (data.success && data.paid) {
                        setSuccess('Төлбөр амжилттай төлөгдлөөн. VIP хүсэлт илгээгдлээ!');
                        setInvoice(null);
                        setCheckingPayment(false);
                        fetchCurrentRequest();
                        clearInterval(interval);
                    }
                } catch (e) { console.error('Check payment error', e); }
            }, 5000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [invoice, success]);

    const handleCreateInvoice = async () => {
        if (!user) {
            setError('Нэвтэрч орно уу');
            return;
        }
        if (!phoneNumber) {
            setError('Утасны дугаараа оруулна уу');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const res = await fetch(`${backendUrl}/api/vip-requests/invoice`, {
                method: 'POST',
                headers: { 'X-User-Id': user.id }
            });
            const data = await res.json();

            if (data.success) {
                setInvoice(data.invoice);
            } else {
                throw new Error(data.error || 'Нэхэмжлэх үүсгэж чадсангүй');
            }
        } catch (e: any) {
            setError(e.message || 'Алдаа гарлаа');
        } finally {
            setSubmitting(false);
        }
    };

    const isVipActive = !!user?.is_vip && user?.vip_until && new Date(user.vip_until) > new Date();

    return (
        <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-white">
            <div className="container mx-auto px-4 py-8 max-w-6xl">
                {/* Hero Section */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 mb-6 shadow-2xl shadow-yellow-500/50">
                        <Crown className="w-12 h-12 text-black" />
                    </div>
                    <h1 className="text-5xl font-display font-bold mb-4 bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
                        VIP ГИШҮҮНЧЛЭЛ
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        League тоглолтод оролцож, ELO оноогоо өсгө!
                    </p>
                </div>

                {/* Current VIP Status */}
                {isVipActive && (
                    <Card className="mb-8 bg-gradient-to-r from-yellow-900/20 to-zinc-900/50 border-yellow-500/20">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <CheckCircle2 className="w-12 h-12 text-yellow-500" />
                                <div>
                                    <h3 className="text-2xl font-bold text-yellow-500">Та VIP гишүүн байна!</h3>
                                    <p className="text-gray-400">
                                        Дуусах хугацаа: {new Date(user.vip_until!).toLocaleDateString('mn-MN')}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Why VIP Section */}
                <Card className="mb-8 bg-zinc-950/50 backdrop-blur-sm border-white/10">
                    <CardHeader>
                        <CardTitle className="text-2xl font-display text-white">VIP гэж юу вэ? Яагаад хэрэгтэй вэ?</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-gray-300">
                        <p className="text-lg">
                            <strong className="text-primary">League тоглолтууд нь зөвхөн VIP гишүүдэд нээлттэй.</strong> Энэ нь өндөр түвшний, мэргэжлийн тоглогчидтой тоглох, ELO ranking системд оролцох боломжийг танд олгоно.
                        </p>
                        <p>
                            Casual тоглолтууд үнэгүй боловч ELO оноо өөрчлөгддөггүй. League тоглолтууд нь таны ур чадварыг үнэлж, ranking-д оруулдаг.
                        </p>
                    </CardContent>
                </Card>

                {/* Benefits Grid */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <Card className="bg-zinc-950/50 backdrop-blur-sm border-white/10 hover:border-primary/50 transition-all">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <Trophy className="w-5 h-5 text-primary" />
                                VIP-ийн давуу тал
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {[
                                'League matches-д оролцох эрх',
                                'ELO оноо авах боломж',
                                'Өндөр түвшний тоглогчидтой тоглох',
                                'Discord дээр тусгай VIP дүр',
                                'Хамгийн сайн тоглогчидтой өрсөлдөх'
                            ].map((benefit, i) => (
                                <div key={i} className="flex items-start gap-2">
                                    <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                                    <span className="text-gray-300">{benefit}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>


                </div>

                {/* How to Get VIP */}
                <Card className="mb-8 bg-zinc-950/50 backdrop-blur-sm border-white/10">
                    <CardHeader>
                        <CardTitle className="text-2xl font-display text-white">Хэрхэн VIP авах вэ?</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid md:grid-cols-5 gap-4">
                            {[
                                { step: '1', text: 'Утасны дугаараа оруулна', icon: Zap },
                                { step: '2', text: 'QPay товч дарна', icon: Shield },
                                { step: '3', text: 'QR код эсвэл банкны апп сонгоно', icon: Check },
                                { step: '4', text: 'Төлбөр төлнө (10,000₮)', icon: Upload },
                                { step: '5', text: 'VIP эрх ШУУД идэвхжинэ!', icon: Crown }
                            ].map((item, i) => (
                                <div key={i} className="flex flex-col items-center text-center">
                                    <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center mb-2">
                                        <item.icon className="w-6 h-6 text-primary" />
                                    </div>
                                    <div className="text-xs font-bold text-primary mb-1">Алхам {item.step}</div>
                                    <div className="text-xs text-gray-400">{item.text}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Request Status or Form */}
                {currentRequest?.status === 'pending' ? (
                    <Card className="bg-blue-900/20 border-blue-500/20 mb-8">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <Clock className="w-12 h-12 text-blue-500" />
                                <div>
                                    <h3 className="text-2xl font-bold text-blue-500">Хүсэлт хүлээгдэж байна</h3>
                                    <p className="text-gray-400">
                                        Таны VIP хүсэлт админд илгээгдсэн. 1-24 цагийн дотор хянагдана.
                                    </p>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Илгээсэн: {new Date(currentRequest.created_at).toLocaleString('mn-MN')}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : currentRequest?.status === 'rejected' ? (
                    <Card className="bg-red-900/20 border-red-500/20 mb-8">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <XCircle className="w-12 h-12 text-red-500" />
                                <div>
                                    <h3 className="text-2xl font-bold text-red-500">Хүсэлт татгалзагдсан</h3>
                                    <p className="text-gray-400">
                                        Шалтгаан: {currentRequest.rejection_reason || 'Тодорхойгүй'}
                                    </p>
                                    <p className="text-sm text-gray-500 mt-2">
                                        Та дахин хүсэлт илгээж болно.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : null}

                {/* Request Form */}
                {(!currentRequest || currentRequest.status === 'rejected') && !isVipActive && (
                    <Card className="bg-zinc-950/50 backdrop-blur-sm border-white/10">
                        <CardHeader>
                            <CardTitle className="text-2xl font-display text-white">VIP хүсэлт илгээх</CardTitle>
                            <CardDescription className="text-gray-400">
                                Утасны дугаараа оруулаад QPay -ээр төлөх товч дарна уу
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white">Discord Username</label>
                                <Input
                                    value={user?.username || ''}
                                    disabled
                                    className="bg-zinc-800/50 border-white/10 text-white"
                                />
                                <p className="text-xs text-gray-500">Автоматаар бөглөгдсөн</p>
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-medium text-white flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-primary" />
                                    Утасны дугаар <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    placeholder="99119911"
                                    className="bg-zinc-800/50 border-white/10 text-white"
                                    required
                                    disabled={!!invoice}
                                />
                                <p className="text-[10px] text-gray-500">Бид тантай холбогдоход ашиглана</p>
                            </div>

                            {/* QPay Section */}
                            {!invoice ? (
                                <Button
                                    onClick={handleCreateInvoice}
                                    disabled={!phoneNumber || submitting}
                                    className="w-full bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black font-bold text-lg h-12"
                                >
                                    {submitting ? (
                                        <>
                                            <div className="h-4 w-4 border-2 border-black/30 border-t-black rounded-full animate-spin mr-2" />
                                            Нэхэмжлэх үүсгэж байна...
                                        </>
                                    ) : (
                                        <>
                                            <Crown className="mr-2 h-5 w-5" />
                                            QPay -ээр төлөх (10,000₮)
                                        </>
                                    )}
                                </Button>
                            ) : (
                                <div className="space-y-6 text-center animate-fade-in">
                                    <div className="bg-white p-4 rounded-xl inline-block">
                                        <img src={`data:image/png;base64,${invoice.qr_image}`} alt="QPay QR" className="w-48 h-48 md:w-64 md:h-64 mx-auto" />
                                    </div>

                                    {/* Bank Apps Grid */}
                                    {invoice.urls && invoice.urls.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-gray-400">Эсвэл банкаа сонгон төлнө үү (Use Bank App):</p>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-zinc-900/50 rounded-lg">
                                                {invoice.urls.map((bank: any) => (
                                                    <a
                                                        key={bank.name}
                                                        href={bank.link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex flex-col items-center justify-center p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors gap-2"
                                                    >
                                                        {bank.logo ? (
                                                            <img src={bank.logo} alt={bank.name} className="w-8 h-8 rounded-lg" />
                                                        ) : (
                                                            <div className="w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center text-xs text-white">
                                                                {bank.name[0]}
                                                            </div>
                                                        )}
                                                        <span className="text-[10px] text-white text-center leading-tight">{bank.name}</span>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <h3 className="text-xl font-bold text-white">QPay QR кодыг уншуулна уу</h3>
                                        <p className="text-gray-400 text-sm">Төлбөр төлөгдсөний дараа автоматаар баталгаажна.</p>
                                    </div>

                                    {checkingPayment && (
                                        <div className="flex items-center justify-center gap-2 text-yellow-500 text-sm">
                                            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            Төлбөр шалгаж байна...
                                        </div>
                                    )}

                                    <Button variant="ghost" className="text-xs text-gray-500" onClick={() => setInvoice(null)}>
                                        Буцах / Цуцлах
                                    </Button>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-900/20 border border-red-500/20 p-3 rounded-lg flex items-start gap-2">
                                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-200">{error}</p>
                                </div>
                            )}

                            {success && (
                                <div className="bg-green-900/20 border border-green-500/20 p-3 rounded-lg flex items-start gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                                    <p className="text-sm text-green-200">{success}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
