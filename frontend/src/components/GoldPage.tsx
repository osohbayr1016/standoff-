
import { useAuth } from '../utils/auth';
import { Coins } from "lucide-react";

export default function GoldPage() {
    const { user } = useAuth();

    if (!user) return <div className="text-white text-center pt-20 font-rajdhani">Log in to view Gold Market</div>;

    return (
        <div className="min-h-screen bg-black/95 pt-20 pb-12 px-2 sm:px-6 font-rajdhani">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                            <Coins className="w-6 h-6 text-yellow-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight uppercase">Gold Market</h1>
                            <p className="text-xs text-gray-400">Secure Delivery via Daisuke.mn</p>
                        </div>
                    </div>
                </div>

                {/* Daisuke.mn Iframe */}
                <div className="w-full bg-zinc-900/50 rounded-2xl border border-white/10 overflow-hidden shadow-2xl" style={{ height: 'calc(100vh - 250px)', minHeight: '700px' }}>
                    <iframe
                        src="https://daisuke.mn/category/3"
                        className="w-full h-full border-0"
                        title="Daisuke Gold Market"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                </div>

                {/* Footer Info */}
                <div className="flex flex-col items-center gap-2 pt-4">
                    <div className="text-[10px] text-gray-500 flex items-center gap-4">
                        <span>Tel: 95500327</span>
                        <span className="w-1 h-1 bg-gray-600 rounded-full" />
                        <a href="https://www.facebook.com/people/Daisukemn/61585481892424/" target="_blank" className="text-blue-400/80 hover:text-blue-400 transition-colors">Daisuke FB Page</a>
                    </div>
                    <p className="text-[9px] text-gray-600 font-mono opacity-30">
                        Integrated via Secure Iframe Proxy
                    </p>
                </div>
            </div>
        </div>
    );
}
