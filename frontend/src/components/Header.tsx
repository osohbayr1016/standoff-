import { useState } from "react";
import { loginWithDiscord } from "../utils/auth";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Menu,
  Swords,
  Trophy,
  Gift,
  Users,
  Shield,
  LogOut,
  User as UserIcon,
  ShieldAlert,
  MessageCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface User {
  id: string;
  username: string;
  avatar: string;
  standoff_nickname?: string;
  elo?: number;
  role?: string;
  is_vip?: number;
  vip_until?: string;
}

interface HeaderProps {
  currentPage: string;
  user?: User | null;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  backendUrl: string;
}

export default function Header({
  currentPage,
  user,
  onNavigate,
  onLogout,
}: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getAvatarUrl = () => {
    if (user?.avatar) {
      return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
    }
    return null;
  };

  const NavItems = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      <Button
        variant={currentPage === "home" ? "secondary" : "ghost"}
        className={`justify-start ${mobile ? "w-full" : ""}`}
        onClick={() => {
          onNavigate("home");
          if (mobile) setIsOpen(false);
        }}
      >
        <div className="flex items-center gap-2">
          {/* Home Icon could go here, or just text */}
          <span className="font-display font-bold">HOME</span>
        </div>
      </Button>
      <Button
        variant={currentPage === "matchmaking" ? "secondary" : "ghost"}
        className={`justify-start ${mobile ? "w-full" : ""}`}
        onClick={() => {
          onNavigate("matchmaking");
          if (mobile) setIsOpen(false);
        }}
      >
        <Swords className="mr-2 h-4 w-4" />
        PLAY
      </Button>
      <Button
        variant={currentPage === "leaderboard" ? "secondary" : "ghost"}
        className={`justify-start ${mobile ? "w-full" : ""}`}
        onClick={() => {
          onNavigate("leaderboard");
          if (mobile) setIsOpen(false);
        }}
      >
        <Trophy className="mr-2 h-4 w-4" />
        RANKINGS
      </Button>
      <Button
        variant={currentPage === "rewards" ? "secondary" : "ghost"}
        className={`justify-start ${mobile ? "w-full" : ""}`}
        onClick={() => {
          onNavigate("rewards");
          if (mobile) setIsOpen(false);
        }}
      >
        <Gift className="mr-2 h-4 w-4" />
        REWARDS
      </Button>
      <Button
        variant={currentPage === "friends" ? "secondary" : "ghost"}
        className={`justify-start ${mobile ? "w-full" : ""}`}
        onClick={() => {
          onNavigate("friends");
          if (mobile) setIsOpen(false);
        }}
      >
        <Users className="mr-2 h-4 w-4" />
        FRIENDS
      </Button>
      {(user?.role === 'moderator' || user?.role === 'admin') && (
        <Button
          variant={currentPage === "moderator" ? "destructive" : "ghost"}
          className={`justify-start text-destructive hover:text-destructive-foreground hover:bg-destructive/90 ${mobile ? "w-full" : ""}`}
          onClick={() => {
            onNavigate("moderator");
            if (mobile) setIsOpen(false);
          }}
        >
          <Shield className="mr-2 h-4 w-4" />
          MOD PANEL
        </Button>
      )}
      {user?.role === 'admin' && (
        <Button
          variant={currentPage === "admin" ? "default" : "ghost"}
          className={`justify-start text-primary hover:text-primary-foreground hover:bg-primary/90 ${mobile ? "w-full" : ""}`}
          onClick={() => {
            onNavigate("admin");
            if (mobile) setIsOpen(false);
          }}
        >
          <ShieldAlert className="mr-2 h-4 w-4" />
          ADMIN PANEL
        </Button>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">

        {/* Logo */}
        <div
          className="flex items-center gap-1 cursor-pointer select-none"
          onClick={() => onNavigate("home")}
        >
          <span className="font-display text-2xl font-bold tracking-tighter text-foreground">STAN</span>
          <span className="font-display text-2xl font-bold tracking-tighter text-primary">D</span>
          <span className="font-display text-2xl font-bold tracking-tighter text-foreground">OFF 2</span>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          <NavItems />
        </nav>

        {/* User Menu (Desktop & Mobile) */}
        <div className="flex items-center gap-2">
          {/* Discord Server Link */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full hover:bg-[#5865F2]/10 hover:text-[#5865F2] transition-colors"
            onClick={() => window.open('https://discord.gg/4dSXyfWUdq', '_blank', 'noopener,noreferrer')}
            title="Join our Discord server"
          >
            <MessageCircle className="h-5 w-5" />
            <span className="sr-only">Join Discord Server</span>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarImage src={getAvatarUrl() || undefined} alt={user.username} />
                    <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium leading-none">{user.standoff_nickname || user.username}</p>
                      {user.is_vip === 1 && (
                        <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-[10px] h-4 px-1 border-none text-black font-bold">VIP</Badge>
                      )}
                    </div>
                    <p className="text-xs leading-none text-muted-foreground">ELO: {user.elo || 1000}</p>
                    {user.is_vip === 1 && user.vip_until && (
                      <p className="text-[10px] leading-none text-yellow-500/70">
                        Expires: {new Date(user.vip_until).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onNavigate("profile")}>
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLogout} className="text-destructive focus:bg-destructive/10">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={loginWithDiscord}>
              Login
            </Button>
          )}

          {/* Mobile Menu Trigger */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle className="text-left font-display font-bold text-2xl">
                  <span>STAN</span><span className="text-primary">D</span><span>OFF 2</span>
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 py-4 mt-4">
                <NavItems mobile />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
