import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Crown, Trophy, Shield, Zap, Check, Upload, AlertTriangle,
    Clock, CheckCircle2, XCircle, Copy
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
    const [message, setMessage] = useState('');
    const [screenshot, setScreenshot] = useState<File | null>(null);
    const [screenshotPreview, setScreenshotPreview] = useState<string>('');
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [currentRequest, setCurrentRequest] = useState<VIPRequest | null>(null);
    const [copied, setCopied] = useState(false);

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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError('Зөвхөн зураг файл оруулна уу');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                setError('Файлын хэмжээ 5MB-аас бага байх ёстой');
                return;
            }
            setScreenshot(file);
            setScreenshotPreview(URL.createObjectURL(file));
            setError('');
        }
    };

    const handleSubmit = async () => {
        if (!user) {
            setError('Нэвтэрч орно уу');
            return;
        }

        if (!screenshot) {
            setError('Шилжүүлгийн screenshot оруулна уу');
            return;
        }

        if (!phoneNumber) {
            setError('Утасны дугаараа оруулна уу');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            // 1. Upload screenshot
            setUploading(true);
            const formData = new FormData();
            formData.append('screenshot', screenshot);

            const uploadResponse = await fetch(`${backendUrl}/api/vip-requests/upload/vip-screenshot`, {
                method: 'POST',
                headers: { 'X-User-Id': user.id },
                body: formData
            });

            const uploadData = await uploadResponse.json();
            setUploading(false);

            if (!uploadData.success) {
                throw new Error(uploadData.error || 'Screenshot upload failed');
            }

            // 2. Submit VIP request
            const requestResponse = await fetch(`${backendUrl}/api/vip-requests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user.id
                },
                body: JSON.stringify({
                    discord_username: user.username,
                    phone_number: phoneNumber,
                    screenshot_url: uploadData.url,
                    message: message || undefined
                })
            });

            const requestData = await requestResponse.json();

            if (requestData.success) {
                setSuccess('VIP хүсэлт амжилттай илгээгдлээ! Админ 1-24 цагийн дотор хянана.');
                setPhoneNumber('');
                setMessage('');
                setScreenshot(null);
                setScreenshotPreview('');
                fetchCurrentRequest();
            } else {
                throw new Error(requestData.error || 'Request submission failed');
            }
        } catch (err: any) {
            setError(err.message || 'Алдаа гарлаа. Дахин оролдоно уу.');
        } finally {
            setSubmitting(false);
            setUploading(false);
        }
    };

    const handleCopyAccount = () => {
        navigator.clipboard.writeText('MN770005005653332153');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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

                    <Card className="bg-gradient-to-br from-primary/10 to-zinc-950/50 backdrop-blur-sm border-primary/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <Zap className="w-5 h-5 text-primary" />
                                Үнэ ба төлбөр
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="text-center py-4">
                                <div className="text-5xl font-bold text-primary mb-2">10,000₮</div>
                                <div className="text-gray-400">/ 1 сар</div>
                            </div>
                            <div className="bg-zinc-900/50 p-4 rounded-lg space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Банк:</span>
                                    <span className="text-white font-medium">Хаан банк</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Нэр:</span>
                                    <span className="text-white font-medium">Амаржаргал Ананд</span>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <span className="text-gray-400">Данс:</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-mono text-xs">MN770005005653332153</span>
                                        <button
                                            onClick={handleCopyAccount}
                                            className="p-1 hover:bg-white/10 rounded transition-colors"
                                            title="Хуулах"
                                        >
                                            {copied ? (
                                                <Check className="w-3 h-3 text-green-500" />
                                            ) : (
                                                <Copy className="w-3 h-3 text-gray-400" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-yellow-900/20 border border-yellow-500/20 p-3 rounded-lg flex items-start gap-2">
                                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-xs text-yellow-200">
                                        <strong>АНХААРУУЛГА:</strong> Зөвхөн дээрх данс руу шилжүүлэг хийнэ үү!
                                    </p>
                                    <p className="text-xs text-yellow-400 font-bold">
                                        Гүйлгээний утга: Өөрийн Discord нэр + Утасны дугаар
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* How to Get VIP */}
                <Card className="mb-8 bg-zinc-950/50 backdrop-blur-sm border-white/10">
                    <CardHeader>
                        <CardTitle className="text-2xl font-display text-white">Хэрхэн VIP авах вэ?</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid md:grid-cols-7 gap-4">
                            {[
                                { step: '1', text: 'Данс руу 10,000₮ шилжүүлэх (Утга: Discord нэр + Утас)', icon: Shield },
                                { step: '2', text: 'Шилжүүлгийн screenshot авна', icon: Upload },
                                { step: '3', text: 'Доорх маягтыг бөглөнө', icon: Check },
                                { step: '4', text: 'Screenshot-оо хавсаргана', icon: Upload },
                                { step: '5', text: 'Хүсэлт илгээнэ', icon: Zap },
                                { step: '6', text: 'Админ баталгаажуулна (1-24 цаг)', icon: Clock },
                                { step: '7', text: 'VIP эрх идэвхжинэ', icon: Crown }
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
                                Дээрх данс руу төлбөр хийсний дараа энэ маягтыг бөглөнө үү
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

                            <div className="space-y-2">
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
                                />
                                <p className="text-[10px] text-gray-500">Бид тантай холбогдоход ашиглана</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white">
                                    Шилжүүлгийн Screenshot <span className="text-red-500">*</span>
                                </label>
                                <div className="border-2 border-dashed border-white/10 rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="screenshot-upload"
                                    />
                                    <label htmlFor="screenshot-upload" className="cursor-pointer">
                                        {screenshotPreview ? (
                                            <div className="space-y-2">
                                                <img src={screenshotPreview} alt="Preview" className="max-h-64 mx-auto rounded-lg" />
                                                <p className="text-sm text-green-500">✓ Зураг сонгогдсон</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <Upload className="w-12 h-12 mx-auto text-gray-400" />
                                                <p className="text-gray-400">Зураг сонгох</p>
                                                <p className="text-xs text-gray-500">PNG, JPG (max 5MB)</p>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white">Нэмэлт мэдээлэл (заавал биш)</label>
                                <Textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Хэрэв асуух зүйл байвал энд бичнэ үү..."
                                    className="bg-zinc-800/50 border-white/10 text-white min-h-[100px]"
                                />
                            </div>

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

                            <Button
                                onClick={handleSubmit}
                                disabled={!screenshot || !phoneNumber || submitting || uploading}
                                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black font-bold text-lg h-12"
                            >
                                {uploading ? (
                                    <>
                                        <div className="h-4 w-4 border-2 border-black/30 border-t-black rounded-full animate-spin mr-2" />
                                        Зураг байршуулж байна...
                                    </>
                                ) : submitting ? (
                                    <>
                                        <div className="h-4 w-4 border-2 border-black/30 border-t-black rounded-full animate-spin mr-2" />
                                        Илгээж байна...
                                    </>
                                ) : (
                                    <>
                                        <Crown className="mr-2 h-5 w-5" />
                                        VIP ХҮСЭЛТ ИЛГЭЭХ
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
