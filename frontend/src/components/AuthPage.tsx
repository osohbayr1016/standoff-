import { loginWithDiscord } from "../utils/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Gamepad2, Users, Bell, ArrowRight } from "lucide-react";

export default function AuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#050505]">
      {/* Background Image with Overlay */}
      <div
        className="absolute inset-0 z-0 opacity-40 bg-cover bg-center"
        style={{ backgroundImage: 'url("/assets/login_bg.png")' }}
      />
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-transparent via-[#050505]/80 to-[#050505]" />

      {/* Content Container */}
      <div className="relative z-20 w-full max-w-5xl px-6 grid lg:grid-cols-2 gap-12 items-center">

        {/* Left Side: Information & News */}
        <div className="space-y-8 animate-fade-in-up">
          <div className="space-y-4">
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 px-3 py-1 text-xs font-bold uppercase tracking-wider">
              ШИНЭ ШИНЭЧЛЭЛТ v2.0
            </Badge>
            <h1 className="text-5xl lg:text-7xl font-display font-black tracking-tight leading-none text-white uppercase italic">
              STANDOFF 2 <br />
              <span className="text-orange-500">LEAGUE</span>
            </h1>
            <p className="text-xl text-zinc-400 max-w-lg leading-relaxed font-light">
              Монголын хамгийн том Standoff 2 тэмцээний платформд тавтай морил. Хамт олонтойгоо нэгдэж, ур чадвараа батал.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-4 rounded-xl space-y-2 hover:bg-white/10 transition-colors cursor-default group">
              <div className="bg-orange-500/20 p-2 rounded-lg w-fit group-hover:bg-orange-500/40 transition-colors">
                <Users className="h-5 w-5 text-orange-500" />
              </div>
              <h3 className="font-bold text-white uppercase text-sm">Community</h3>
              <p className="text-xs text-zinc-500 leading-tight">10,000+ гаруй тоглогчидтой нэгдэж, шинэ найзуудтай болох боломжтой.</p>
            </div>

            <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-4 rounded-xl space-y-2 hover:bg-white/10 transition-colors cursor-default group">
              <div className="bg-blue-500/20 p-2 rounded-lg w-fit group-hover:bg-blue-500/40 transition-colors">
                <Bell className="h-5 w-5 text-blue-500" />
              </div>
              <h3 className="font-bold text-white uppercase text-sm">Updates</h3>
              <p className="text-xs text-zinc-500 leading-tight">Тэмцээн, шинэчлэлтүүдийн мэдээллийг цаг алдалгүй Discord-оос аваарай.</p>
            </div>
          </div>

          <a
            href="https://discord.com/invite/FFCBrMACKm"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group text-sm font-medium"
          >
            МАНАЙ DISCORD СЕРВЕРТ НЭГДЭХ <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>

        {/* Right Side: Login Card */}
        <div className="lg:justify-self-end w-full max-w-md animate-fade-in-up delay-150">
          <Card className="border-white/10 bg-zinc-900/40 backdrop-blur-xl shadow-2xl p-8 rounded-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-3xl -mr-16 -mt-16" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/10 blur-3xl -ml-12 -mb-12" />

            <CardContent className="p-0 space-y-8 relative z-10 text-center">
              <div className="mx-auto bg-primary/10 p-5 rounded-3xl w-fit">
                <Gamepad2 className="h-12 w-12 text-primary" />
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-white">Нэвтрэх</h2>
                <p className="text-zinc-500 text-sm">
                  Системд нэвтрэхийн тулд доорх товчийг ашиглана уу. <br />
                  Таны Discord хаягаар бүртгэл автоматаар үүснэ.
                </p>
              </div>

              <Button
                onClick={loginWithDiscord}
                className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white py-8 text-lg font-bold shadow-xl shadow-blue-500/20 group relative overflow-hidden"
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  DISCORD-ООР НЭВТРЭХ
                </span>
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </Button>

              <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                © 2025 STANDOFF 2 PLATFORM BY ANAND
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

const Badge = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
    {children}
  </span>
);


