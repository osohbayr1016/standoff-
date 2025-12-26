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
  User as UserIcon
} from "lucide-react";
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
                    <p className="text-sm font-medium leading-none">{user.standoff_nickname || user.username}</p>
                    <p className="text-xs leading-none text-muted-foreground">ELO: {user.elo || 1000}</p>
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
