
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Flag, Users, Shield, Plus, Trophy, Crown, Zap, Check, FileImage, Clock } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { useAuth } from '../utils/auth';

interface ClanMember {
    id: string;
    username: string;
    avatar: string; // hash
    role: string;
    elo: number;
}

interface Clan {
    id: string;
    name: string;
    tag: string;
    leader_id: string;
    logo_url: string | null;
    max_members: number;
    description: string | null;
    elo: number;
    members: ClanMember[];
    myRole: string;
}

interface ClanPageProps {
    user: any;
    backendUrl: string;
    onViewLobby: (matchId: string) => void;
    onViewClanProfile?: (clanId: string) => void;
}

export default function ClanPage({ user, backendUrl, onViewLobby, onViewClanProfile, initialTab = 'members' }: ClanPageProps & { initialTab?: string }) {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [clan, setClan] = useState<Clan | null>(null);
    const [createForm, setCreateForm] = useState({ name: '', tag: '', size: 20 });
    const [logoFile, setLogoFile] = useState<File | null>(null); // New State
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [addMemberId, setAddMemberId] = useState('');
    const [pendingRequest, setPendingRequest] = useState<any>(null);
    const [activeInvoice, setActiveInvoice] = useState<any>(null); // New state for QPay
    const [activeMatch, setActiveMatch] = useState<any>(null);
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [clanList, setClanList] = useState<any[]>([]);
    const [editForm, setEditForm] = useState({ name: '', tag: '', logo_url: '' });

    useEffect(() => {
        if (clan) {
            setEditForm({ name: clan.name, tag: clan.tag, logo_url: clan.logo_url || '' });
        }
    }, [clan]);

    const fetchClansList = async () => {
        try {
            const res = await fetch(`${backendUrl}/api/clans`);
            if (res.ok) {
                const data = await res.json();
                setClanList(data.clans);
            }
        } catch (e) { console.error(e); }
    };



    const fetchActiveMatch = async () => {
        try {
            const res = await fetch(`${backendUrl}/api/matches/user/${user.id}/active`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setActiveMatch(data.match);
            }
        } catch (e) { console.error(e); }
    };

    // ... (keep handleCreateLobby, handleQueue, fetchMyRequest as is, but hidden in diff for brevity if unmodified, but I must provide valid replacement for the chunk I target. I will target the UPPER part for state/fetch, and LOWER part for render separately or use multi_replace)

    // Actually, I'll use multi_replace to handle the disjoint edits (State/Effect vs Render)
    // But since I have to "generate arguments first", I'll use replace_file_content if I can target one block? No, they are far apart.
    // I will use multi_replace_file_content.


    const handleCreateLobby = async () => {
        setActionLoading(true);
        try {
            const res = await fetch(`${backendUrl}/api/matches`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': user.id
                },
                body: JSON.stringify({
                    host_id: user.id,
                    match_type: 'clan_lobby',
                    lobby_url: 'pending', // Placeholder
                    max_players: 5
                })
            });
            if (res.ok) {
                fetchActiveMatch();
            }
        } catch (e) { setError('Failed to create lobby'); }
        finally { setActionLoading(false); }
    };

    const handleQueue = async () => {
        if (!activeMatch) return;
        setActionLoading(true);
        try {
            const res = await fetch(`${backendUrl}/api/matches/${activeMatch.id}/queue`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': user.id
                },
                body: JSON.stringify({ host_id: user.id })
            });
            const data = await res.json();
            if (data.success) {
                if (data.matchFound) {
                    setSuccess('Match Found! Redirecting...');
                    // Redirect or refresh to see new match
                    setTimeout(() => fetchActiveMatch(), 2000);
                } else {
                    setSuccess('Queued for match...');
                    fetchActiveMatch();
                }
            } else {
                setError(data.error);
            }
        } catch (e) { setError('Network error'); }
        finally { setActionLoading(false); }
    };

    const fetchMyRequest = async () => {
        try {
            const res = await fetch(`${backendUrl}/api/clan-requests/my-request`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': user.id
                }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.request && data.request.status === 'pending') {
                    setPendingRequest(data.request);
                }
            }
        } catch (e) { console.error(e); }
    }

    const fetchClan = async () => {
        try {
            const res = await fetch(`${backendUrl}/api/clans/my-clan`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': user.id
                }
            });
            if (res.ok) {
                const data = await res.json();
                setClan(data);
                if (!data) fetchMyRequest();
            } else {
                // If no clan, check if there is a pending request
                fetchMyRequest();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClan();
        fetchActiveMatch();
        fetchClansList();
    }, []);

    useEffect(() => {
        if (activeMatch && activeMatch.match_type === 'clan_match') {
            onViewLobby(activeMatch.id);
        }
    }, [activeMatch]);

    useEffect(() => {
        let interval: any;
        if (activeInvoice && !success) {
            setActionLoading(true);
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`${backendUrl}/api/clan-requests/check-payment`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'X-User-Id': user.id
                        },
                        body: JSON.stringify({
                            invoice_id: activeInvoice.invoice_id,
                            clan_name: createForm.name,
                            clan_tag: createForm.tag,
                            clan_size: createForm.size
                        })
                    });
                    const data = await res.json();
                    if (data.success && data.paid) {
                        setSuccess('Төлбөр төлөгдлөө. Клан амжилттай үүсгэгдлээ!');
                        setActiveInvoice(null);
                        fetchClan(); // Immediate dashboard load
                        fetchMyRequest();
                        clearInterval(interval);
                        setActionLoading(false);
                    }
                } catch (e) { console.error(e); }
            }, 5000);
        }
        return () => { if (interval) clearInterval(interval); }
    }, [activeInvoice, success]);

    const handleCreateInvoice = async () => {
        setError(null);
        setSuccess(null);
        setActionLoading(true);

        try {
            const res = await fetch(`${backendUrl}/api/clan-requests/invoice`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': user.id
                },
                body: JSON.stringify({ clan_size: createForm.size })
            });
            const data = await res.json();
            if (data.success) {
                setActiveInvoice(data.invoice);
            } else {
                setError(data.error);
            }
        } catch (e: any) {
            setError(e.message || 'Error creating invoice');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddMember = async () => {
        if (!addMemberId) return;
        setActionLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch(`${backendUrl}/api/clans/members/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': user.id
                },
                body: JSON.stringify({ targetUserId: addMemberId })
            });
            const data = await res.json();
            if (res.ok) {
                setSuccess('Member added!');
                setAddMemberId('');
                setIsAddMemberOpen(false);
                fetchClan();
            } else {
                setError(data.error);
            }
        } catch (e) { setError('Network error'); }
        finally { setActionLoading(false); }
    };

    const handleKick = async (id: string) => {
        if (!confirm('Are you sure you want to kick this member?')) return;
        setActionLoading(true);
        try {
            const res = await fetch(`${backendUrl}/api/clans/members/kick`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': user.id
                },
                body: JSON.stringify({ targetUserId: id })
            });
            if (res.ok) {
                fetchClan();
            }
        } catch (e) { console.error(e); }
        finally { setActionLoading(false); }
    };

    const handleUpdateClan = async () => {
        setActionLoading(true);
        setError(null);
        setSuccess(null);
        try {
            let finalLogoUrl = editForm.logo_url;

            // Upload Logo if selected
            if (logoFile) {
                const formData = new FormData();
                formData.append('file', logoFile);
                const uploadRes = await fetch(`${backendUrl}/api/upload`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'X-User-Id': user.id
                    },
                    body: formData
                });

                if (!uploadRes.ok) throw new Error('Failed to upload logo');
                const uploadData = await uploadRes.json();
                finalLogoUrl = uploadData.url;
            }

            const res = await fetch(`${backendUrl}/api/clans/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': user.id
                },
                body: JSON.stringify({ ...editForm, logo_url: finalLogoUrl })
            });
            if (res.ok) {
                setSuccess('Clan profile updated successfully!');
                setLogoFile(null);
                fetchClan();
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to update');
            }
        } catch (e) { setError('Network error'); }
        finally { setActionLoading(false); }
    };

    if (loading) return <div className="h-[50vh] flex items-center justify-center"><LoadingSpinner size="lg" /></div>;

    if (!clan) {
        // Only show full-page pending if NOT viewing an active invoice
        if (pendingRequest && !activeInvoice) {
            return (
                <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-white flex items-center justify-center p-4">
                    <Card className="max-w-md w-full bg-zinc-900/50 border-white/10 text-center p-8 space-y-6">
                        <div className="mx-auto w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4">
                            <Clock className="w-10 h-10 text-yellow-500" />
                        </div>
                        <h2 className="text-3xl font-display font-bold text-white">Хүсэлт хүлээгдэж байна</h2>
                        <p className="text-gray-400">
                            Таны <strong>{pendingRequest.clan_name}</strong> клан үүсгэх хүсэлт админаар шалгагдаж байна. (1-24 цаг)
                        </p>
                        <Badge variant="outline" className="border-yellow-500/50 text-yellow-500 px-4 py-1 text-base">PENDING APPROVAL</Badge>
                        <Button variant="ghost" onClick={() => window.location.reload()} className="w-full mt-4">Shalgah (Refresh)</Button>
                    </Card>
                </div>
            )
        }

        const currentPrice = createForm.size === 50 ? '50,000' : '20,000';

        return (
            <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-white animate-fade-in">
                <div className="container mx-auto px-4 py-8 max-w-6xl">
                    {/* Hero Section */}
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-display font-bold text-white mb-2">Clans</h1>
                        <p className="text-gray-400">Join a clan or create your own to compete in tournaments.</p>
                    </div>

                    <Tabs defaultValue="browse" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-zinc-900 border border-white/10 mb-6 sm:mb-8">
                            <TabsTrigger value="browse">Browse Clans</TabsTrigger>
                            <TabsTrigger value="create">Create Clan</TabsTrigger>
                        </TabsList>

                        <TabsContent value="browse">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {clanList.map(c => (
                                    <Card
                                        key={c.id}
                                        onClick={() => onViewClanProfile && onViewClanProfile(c.id)}
                                        className="bg-zinc-900/50 border-white/10 cursor-pointer hover:bg-zinc-800/80 hover:border-primary/50 transition-all group"
                                    >
                                        <CardContent className="flex items-center gap-4 p-4">
                                            <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10 group-hover:border-primary/50 overflow-hidden">
                                                {c.logo_url ? (
                                                    <img src={c.logo_url} alt={c.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <Flag className="h-6 w-6 text-zinc-400 group-hover:text-primary transition-colors" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white group-hover:text-primary transition-colors flex items-center gap-2">
                                                    {c.name}
                                                    <span className="text-xs text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5">[{c.tag}]</span>
                                                </div>
                                                <div className="text-xs text-zinc-500 flex items-center gap-3 mt-1">
                                                    <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> {c.elo}</span>
                                                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.member_count}/{c.max_members}</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {clanList.length === 0 && (
                                    <div className="col-span-full text-center py-12 text-zinc-500">
                                        No clans found. Be the first to create one!
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="create">
                            <div className="grid md:grid-cols-2 gap-8 mb-12">
                                {/* Instructions */}
                                <Card className="bg-zinc-950/50 backdrop-blur-sm border-white/10 h-full">
                                    <CardHeader>
                                        <CardTitle className="text-2xl font-display text-white border-b border-white/10 pb-4">Заавар (Instructions)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6 pt-6">
                                        {[
                                            { step: '1', title: 'Клан мэдээлэл бөглөх', desc: 'Нэр болон таг оруулна', icon: Shield },
                                            { step: '2', title: 'QPay товчлуур дээр дарах', desc: 'Төлбөрийн хэсэг гарч ирнэ', icon: Zap },
                                            { step: '3', title: 'Банкны апп эсвэл QR сонгох', desc: 'Өөрийн ашигладаг банкаар', icon: Check },
                                            { step: '4', title: `Төлбөр төлөх (${currentPrice}₮)`, desc: 'Гүйлгээ автоматаар шалгагдана', icon: FileImage },
                                            { step: '5', title: 'Клан үүсгэгдэнэ', desc: 'Төлбөр төлөгдөнгүүт шууд үүснэ', icon: Crown },
                                            { step: '6', title: 'Шууд идэвхжинэ', desc: 'Админы оролцоогүй автомат', icon: Zap },
                                        ].map((item, i) => (
                                            <div key={i} className="flex gap-4 items-start">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 text-primary font-bold text-sm">
                                                    {item.step}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-white text-base">{item.title}</h4>
                                                    <p className="text-sm text-gray-500">{item.desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>

                                {/* Request Form */}
                                <div className="space-y-6">
                                    {/* Form */}
                                    <Card className="bg-zinc-950/50 backdrop-blur-sm border-white/10">
                                        <CardHeader>
                                            <CardTitle className="text-xl text-white">Клан мэдээлэл</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-white">Clan Name</Label>
                                                    <Input
                                                        value={createForm.name}
                                                        onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                                                        className="bg-zinc-900 border-white/10"
                                                        maxLength={20}
                                                        disabled={!!pendingRequest}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-white">Tag (3-5 үсэг)</Label>
                                                    <Input
                                                        value={createForm.tag}
                                                        onChange={e => setCreateForm({ ...createForm, tag: e.target.value.toUpperCase() })}
                                                        className="bg-zinc-900 border-white/10 uppercase"
                                                        maxLength={5}
                                                        disabled={!!pendingRequest}
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-white">Хэмжээ (Size)</Label>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div
                                                        className={`p-3 border rounded-lg cursor-pointer text-center transition-all ${createForm.size === 20 ? 'border-primary bg-primary/10 text-white' : 'border-white/10 bg-zinc-900 text-gray-400'}`}
                                                        onClick={() => setCreateForm({ ...createForm, size: 20 })}
                                                    >
                                                        <div className="font-bold">20 Members</div>
                                                        <div className="text-xs">20,000₮</div>
                                                    </div>
                                                    <div
                                                        className={`p-3 border rounded-lg cursor-pointer text-center transition-all ${createForm.size === 50 ? 'border-primary bg-primary/10 text-white' : 'border-white/10 bg-zinc-900 text-gray-400'}`}
                                                        onClick={() => setCreateForm({ ...createForm, size: 50 })}
                                                    >
                                                        <div className="font-bold">50 Members</div>
                                                        <div className="text-xs">50,000₮</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* QPay Section */}
                                            {error && <p className="text-red-400 text-sm bg-red-900/20 p-3 rounded">{error}</p>}
                                            {success && <p className="text-green-400 text-sm bg-green-900/20 p-3 rounded">{success}</p>}

                                            {!activeInvoice ? (
                                                <Button
                                                    className="w-full bg-primary hover:bg-primary/90 text-black font-bold h-12"
                                                    onClick={handleCreateInvoice}
                                                    disabled={actionLoading || !createForm.name || !createForm.tag}
                                                >
                                                    {actionLoading ? <LoadingSpinner size="sm" /> : `QPay -ээр төлөх (${createForm.size === 20 ? '20,000' : '50,000'}₮)`}
                                                </Button>
                                            ) : (
                                                <div className="space-y-6 text-center animate-fade-in mt-4">
                                                    <div className="bg-white p-4 rounded-xl inline-block">
                                                        <img src={`data:image/png;base64,${activeInvoice.qr_image}`} alt="QPay QR" className="w-48 h-48 md:w-64 md:h-64 mx-auto" />
                                                    </div>

                                                    {/* Bank Apps Grid */}
                                                    {activeInvoice.urls && activeInvoice.urls.length > 0 && (
                                                        <div className="space-y-2">
                                                            <p className="text-sm text-gray-400">Эсвэл банкаа сонгон төлнө үү (Use Bank App):</p>
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-zinc-900/50 rounded-lg">
                                                                {activeInvoice.urls.map((bank: any) => (
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
                                                    {actionLoading && (
                                                        <div className="flex items-center justify-center gap-2 text-primary text-sm">
                                                            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                            Төлбөр шалгаж байна...
                                                        </div>
                                                    )}
                                                    <Button variant="ghost" className="text-xs text-gray-500" onClick={() => setActiveInvoice(null)}>
                                                        Буцах / Цуцлах
                                                    </Button>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        );
    }

    // Clan Dashboard (Existing Code)
    return (
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 animate-fade-in space-y-4 sm:space-y-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-zinc-900 to-zinc-950 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-8 flex flex-col items-center text-center md:flex-row md:text-left md:items-center justify-between gap-4 sm:gap-6 shadow-xl">
                <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6">
                    <div className="h-16 w-16 sm:h-24 sm:w-24 bg-primary/20 rounded-xl sm:rounded-2xl flex items-center justify-center border border-primary/30">
                        <Flag className="h-8 w-8 sm:h-12 sm:w-12 text-primary" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-4xl font-display font-black text-white">{clan.name}</h1>
                            <Badge variant="outline" className="text-sm sm:text-lg font-bold border-primary/50 text-primary px-2 sm:px-3">[{clan.tag}]</Badge>
                        </div>
                        <p className="text-zinc-400 flex flex-wrap items-center justify-center md:justify-start gap-2 mt-2 text-sm sm:text-base">
                            <Users className="h-4 w-4" /> {clan.members.length} / {clan.max_members} Members
                            <span className="mx-2">•</span>
                            <Trophy className="h-4 w-4" /> {clan.elo} ELO
                        </p>
                    </div>
                </div>
                <div>
                    {onViewClanProfile && (
                        <Button
                            variant="secondary"
                            className="font-bold"
                            onClick={() => {
                                console.log("Clicking View Profile with ID:", clan.id);
                                if (clan.id) onViewClanProfile(clan.id);
                                else console.error("Clan ID is missing!");
                            }}
                        >
                            <Shield className="mr-2 h-4 w-4" />
                            View Profile
                        </Button>
                    )}
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-zinc-900 border border-white/10 flex-wrap h-auto sm:h-10">
                    <TabsTrigger value="members" className="text-xs sm:text-sm">Members</TabsTrigger>
                    <TabsTrigger value="matches" className="text-xs sm:text-sm">Matches</TabsTrigger>
                    <TabsTrigger value="browse" className="text-xs sm:text-sm">All Clans</TabsTrigger>
                    <TabsTrigger value="settings" disabled={clan.myRole !== 'leader'} className="text-xs sm:text-sm">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="members" className="mt-6 space-y-6">
                    <div className="flex justify-between items-center bg-zinc-900/30 p-4 rounded-xl border border-white/5">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" /> Member List
                            </h3>
                            <p className="text-sm text-zinc-500 mt-1">
                                Your Role: <Badge variant="outline" className="ml-2 uppercase border-primary/50 text-primary">{clan.myRole}</Badge>
                            </p>
                        </div>

                        {['leader', 'coleader'].includes(clan.myRole) && (
                            <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-primary hover:bg-primary/90 text-black font-bold">
                                        <Plus className="mr-2 h-4 w-4" /> Add Member
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-zinc-950 border-white/10 text-white">
                                    <DialogHeader>
                                        <DialogTitle>Add New Member</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="bg-blue-500/10 p-3 rounded border border-blue-500/20 text-sm text-blue-200">
                                            You can add players by their <strong>User ID</strong>, <strong>Standoff Nickname</strong>, or <strong>Discord ID</strong>.
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Player Identifier</Label>
                                            <Input
                                                placeholder="e.g. 123456 or PlayerOne"
                                                value={addMemberId}
                                                onChange={e => setAddMemberId(e.target.value)}
                                                className="bg-black/50 border-white/10"
                                            />
                                        </div>
                                        <Button onClick={() => { handleAddMember(); }} disabled={actionLoading || !addMemberId} className="w-full">
                                            {actionLoading ? <LoadingSpinner size="sm" /> : 'Invite Member'}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                    {error && <p className="text-red-500">{error}</p>}
                    {success && <p className="text-green-500">{success}</p>}

                    <div className="grid gap-4">
                        {clan.members.map(member => (
                            <div key={member.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-zinc-900/30 border border-white/5 p-3 sm:p-4 rounded-xl hover:bg-zinc-900/60 transition-colors gap-3">
                                <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                                    <div className="h-10 w-10 bg-zinc-800 rounded-full overflow-hidden">
                                        <img src={`https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.png`} alt={member.username} className="h-full w-full object-cover" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-white flex items-center gap-2">
                                            {member.username}
                                            {member.role === 'leader' && <Shield className="h-3 w-3 text-yellow-500" />}
                                            {member.role === 'coleader' && <Shield className="h-3 w-3 text-zinc-400" />}
                                        </div>
                                        <div className="text-xs text-zinc-500">ELO: {member.elo}</div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2 sm:gap-4 pt-2 sm:pt-0 border-t sm:border-0 border-white/5">
                                    <span className="text-xs text-zinc-500 uppercase font-bold">{member.role}</span>
                                    {clan.myRole === 'leader' && member.id !== user.id && (
                                        <Button size="sm" variant="destructive" onClick={() => handleKick(member.id)} disabled={actionLoading}>
                                            Kick
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="settings">
                    <div className="bg-zinc-900/50 p-6 rounded-xl border border-white/5 space-y-6 max-w-2xl mx-auto">
                        <h3 className="text-xl font-bold text-white mb-4">Edit Clan Profile</h3>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Clan Name</Label>
                                <Input
                                    value={editForm.name}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    className="bg-black/50 border-white/10"
                                    placeholder="Clan Name"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Clan Tag</Label>
                                <Input
                                    value={editForm.tag}
                                    onChange={e => setEditForm({ ...editForm, tag: e.target.value })}
                                    className="bg-black/50 border-white/10"
                                    placeholder="TAG"
                                    maxLength={5}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Clan Logo</Label>
                                <div className="flex gap-4 items-center">
                                    <div className="h-16 w-16 bg-zinc-800 rounded-full border border-white/10 overflow-hidden flex-shrink-0">
                                        {logoFile ? (
                                            <img src={URL.createObjectURL(logoFile)} alt="Preview" className="h-full w-full object-cover" />
                                        ) : editForm.logo_url ? (
                                            <img src={editForm.logo_url} alt="Current" className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-zinc-500 text-xs">No Logo</div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={e => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setLogoFile(e.target.files[0]);
                                                }
                                            }}
                                            className="bg-black/50 border-white/10 cursor-pointer file:cursor-pointer file:text-white file:bg-zinc-800 file:border-0 file:rounded-md file:mr-4 file:px-2 file:py-1"
                                        />
                                        <p className="text-xs text-zinc-500 mt-1">Upload a PNG/JPG image (Max 2MB)</p>
                                    </div>
                                </div>
                            </div>

                            {error && <p className="text-red-500">{error}</p>}
                            {success && <p className="text-green-500">{success}</p>}

                            <Button onClick={handleUpdateClan} disabled={actionLoading} className="w-full">
                                {actionLoading ? <LoadingSpinner size="sm" /> : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="matches">
                    {!activeMatch && (
                        <div className="text-center py-12 space-y-4">
                            <h2 className="text-2xl font-bold text-white">Clan Matchmaking</h2>
                            <p className="text-zinc-500">Create a lobby, invite 4 clan members, and queue for a 5v5 battle.</p>
                            <Button size="lg" onClick={handleCreateLobby} disabled={actionLoading || clan.myRole === 'member'}>
                                {actionLoading ? <LoadingSpinner size="sm" /> : 'Create Clan Lobby'}
                            </Button>
                            {clan.myRole === 'member' && <p className="text-xs text-zinc-600">Only Leaders/Co-Leaders can start a lobby.</p>}
                        </div>
                    )}

                    {activeMatch && (
                        <Card className="bg-zinc-900 border-primary/20">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center justify-between">
                                    <span>Clan Lobby ({activeMatch.player_count}/5)</span>
                                    <Badge variant={activeMatch.status === 'queuing' ? 'secondary' : 'outline'}>
                                        {activeMatch.status.toUpperCase()}
                                    </Badge>
                                </CardTitle>
                                <CardDescription>Map: {activeMatch.map_name || 'Random'}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {activeMatch.status === 'waiting' && (
                                    <div className="bg-zinc-950 p-4 rounded-lg flex items-center justify-between">
                                        <span className="text-zinc-400">Invite Code/Link:</span>
                                        <code className="bg-black px-2 py-1 rounded text-primary">{activeMatch.id}</code>
                                    </div>
                                )}
                                {activeMatch.status === 'queuing' && (
                                    <div className="text-center py-4 animate-pulse text-primary font-bold">
                                        Searching for opponent...
                                    </div>
                                )}
                                {error && <p className="text-red-500">{error}</p>}
                                {success && <p className="text-green-500">{success}</p>}
                            </CardContent>
                            <CardFooter>
                                {activeMatch.host_id === user.id && activeMatch.status === 'waiting' && (
                                    <Button className="w-full" onClick={handleQueue} disabled={actionLoading || activeMatch.player_count !== 5}>
                                        {activeMatch.player_count !== 5 ? `Need 5 Players (${activeMatch.player_count}/5)` : 'Find Match'}
                                    </Button>
                                )}
                                {activeMatch.host_id !== user.id && (
                                    <div className="w-full text-center text-zinc-500">Waiting for leader to start...</div>
                                )}
                            </CardFooter>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="browse">
                    <div className="bg-zinc-900/50 p-6 rounded-xl border border-white/5">
                        <h3 className="text-xl font-bold mb-6 text-white">Explore Clans</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {clanList.map(c => (
                                <Card
                                    key={c.id}
                                    onClick={() => onViewClanProfile && onViewClanProfile(c.id)}
                                    className="bg-zinc-900 border-white/10 cursor-pointer hover:bg-zinc-800 hover:border-primary/50 transition-all group"
                                >
                                    <CardContent className="flex items-center gap-4 p-4">
                                        <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10 overflow-hidden">
                                            {c.logo_url ? (
                                                <img src={c.logo_url} alt={c.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <Flag className="h-5 w-5 text-zinc-400 group-hover:text-primary transition-colors" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-bold text-white group-hover:text-primary transition-colors text-sm">
                                                {c.name} <span className="text-zinc-500">[{c.tag}]</span>
                                            </div>
                                            <div className="text-xs text-zinc-500 flex items-center gap-3">
                                                <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> {c.elo}</span>
                                                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.member_count}/{c.max_members}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            {clanList.length === 0 && (
                                <div className="col-span-full text-center py-12 text-zinc-500">
                                    No clans found.
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
