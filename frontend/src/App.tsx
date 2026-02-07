import { useState, useEffect, Suspense, lazy, useCallback } from "react";
import Chat from './components/Chat';
import Header from "./components/Header";
import Hero from "./components/Hero";
// Eager Load Leaderboard for homepage
import Leaderboard from "./components/Leaderboard";
import Footer from "./components/Footer";
import NicknameSetupModal from "./components/NicknameSetupModal";
import { WebSocketProvider, useWebSocket } from "./components/WebSocketContext";
import RecentMatches from "./components/RecentMatches";
import LoadingSpinner from "./components/LoadingSpinner";

// Lazy Loaded Routes
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const FriendsPage = lazy(() => import("./pages/FriendsPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const ModeratorPage = lazy(() => import("./pages/ModeratorPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const MatchmakingPage = lazy(() => import("./pages/MatchmakingPage"));
const VIPPage = lazy(() => import("./pages/VIPPage"));
const JoinGatePage = lazy(() => import("./pages/JoinGatePage"));
const StreamersPage = lazy(() => import("./pages/StreamersPage"));
const StreamerDashboard = lazy(() => import("./pages/StreamerDashboard"));
const ClanPage = lazy(() => import("./pages/ClanPage"));
const ClanProfilePage = lazy(() => import("./pages/ClanProfilePage"));
const GoldPage = lazy(() => import("./pages/GoldPage"));
const RewardsPage = lazy(() => import("./pages/RewardsPage"));
const TournamentPage = lazy(() => import("./pages/TournamentPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const ExplorePage = lazy(() => import("./pages/ExplorePage"));

// Placeholder components (to be implemented)
const DailyRewards = () => <div className="placeholder-card border border-white/5 bg-white/5 rounded-xl p-6 flex items-center justify-center text-muted-foreground italic h-full">Daily Rewards - Coming Soon</div>;

const MatchLobbyPage = lazy(() => import("./pages/LobbyDetailPage"));

interface User {
  id: string;
  username: string;
  avatar: string;
  standoff_nickname?: string;
  elo?: number;
  role?: string;
  is_vip?: number | boolean;
  vip_until?: string;
  is_discord_member?: boolean;
  created_at?: string;
  discord_roles?: string[];
  gold?: number;
}



// Inner App component that uses WebSocket context
function AppContent() {
  const [currentPage, setCurrentPage] = useState(() => {
    const savedPage = localStorage.getItem("currentPage");
    const validPages = [
      "home", "profile", "leaderboard", "friends", "vip", "join_gate", "matchmaking", "streamers", "streamer-dashboard", "clans", "clan-profile", "gold-dashboard", "chat", "explore"
    ];
    if (savedPage && validPages.includes(savedPage)) {
      return savedPage;
    }
    return "home";
  });

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [inviteNotification, setInviteNotification] = useState<{
    fromUser: any;
    lobbyId: string;
  } | null>(null);

  const [activeLobbyId, setActiveLobbyId] = useState<string | undefined>(() => {
    const saved = localStorage.getItem("activeLobbyId");
    return saved || undefined;
  });

  const [matchData, setMatchData] = useState<any>(() => {
    const saved = localStorage.getItem("matchData");
    return saved ? JSON.parse(saved) : null;
  });

  const [navigatedAwayLobbyId, setNavigatedAwayLobbyId] = useState<string | null>(() => {
    return localStorage.getItem("navigatedAwayLobbyId");
  });

  const { registerUser, lastMessage, requestMatchState } = useWebSocket();

  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [viewClanId, setViewClanId] = useState<string | null>(null);
  const [clanInitialTab, setClanInitialTab] = useState('members');
  const [targetMatchId, setTargetMatchId] = useState<string | null>(null);
  const [previousPage, setPreviousPage] = useState<string | null>(null);

  const handleLogout = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem("user");
    localStorage.removeItem("currentPage");
    setCurrentPage("home");
  }, []);

  const handleNavigate = useCallback((page: string) => {
    const matchPages = ["matchgame"];

    setCurrentPage(prev => {
      // Logic for navigating away from matches
      if (matchPages.includes(prev) && !matchPages.includes(page)) {
        if (activeLobbyId) setNavigatedAwayLobbyId(activeLobbyId);
      }

      // Handle previous page logic for profile
      if (page === "profile") {
        if (prev !== "profile") setPreviousPage(prev);
        setViewUserId(null); // Default to own profile if not set via onViewProfile
      } else {
        if (prev === "profile") setPreviousPage(null);
      }

      return page;
    });

    if (matchPages.includes(page)) setNavigatedAwayLobbyId(null);
    if (page !== "matchmaking") setTargetMatchId(null);
  }, [activeLobbyId]);

  const handleViewProfile = useCallback((userId: string) => {
    setPreviousPage(currentPage);
    setViewUserId(userId);
    setCurrentPage("profile");
    localStorage.setItem("previousProfileUserId", userId);
  }, [currentPage]);

  const handleViewClanProfile = useCallback((clanId: string) => {
    console.log("Navigating to clan profile:", clanId);
    setPreviousPage(currentPage);
    setViewClanId(clanId);
    setCurrentPage("clan-profile");
  }, [currentPage]);

  const handleProfileBack = useCallback(() => {
    if (previousPage && previousPage !== "profile") {
      setCurrentPage(previousPage);
    } else {
      const savedPage = localStorage.getItem("currentPage");
      if (savedPage && savedPage !== "profile") {
        setCurrentPage(savedPage);
      } else {
        setCurrentPage("home");
      }
    }
    setPreviousPage(null);
    setViewUserId(null);
  }, [previousPage]);

  const handleNicknameSaved = useCallback((nickname: string) => {
    setUser(prev => {
      if (!prev) return null;
      const updatedUser = { ...prev, standoff_nickname: nickname };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      return updatedUser;
    });
    setShowNicknameModal(false);
  }, []);

  const handleFindMatch = useCallback(() => setCurrentPage("matchmaking"), []);
  const handleGoHome = useCallback(() => { setViewUserId(null); setCurrentPage("home"); }, []);
  const handleViewLobby = useCallback((lobbyId: string) => { setTargetMatchId(lobbyId); setCurrentPage("matchmaking"); }, []);
  const handleAcceptInvite = useCallback(() => { setInviteNotification(null); setCurrentPage("matchmaking"); }, []);
  const handleDeclineInvite = useCallback(() => setInviteNotification(null), []);

  useEffect(() => {
    localStorage.setItem("currentPage", currentPage);
  }, [currentPage]);

  useEffect(() => {
    if (activeLobbyId) {
      localStorage.setItem("activeLobbyId", activeLobbyId);
    } else {
      localStorage.removeItem("activeLobbyId");
    }
  }, [activeLobbyId]);

  useEffect(() => {
    if (matchData) {
      localStorage.setItem("matchData", JSON.stringify(matchData));
    } else {
      localStorage.removeItem("matchData");
    }
  }, [matchData]);

  useEffect(() => {
    if (navigatedAwayLobbyId) {
      localStorage.setItem("navigatedAwayLobbyId", navigatedAwayLobbyId);
    } else {
      localStorage.removeItem("navigatedAwayLobbyId");
    }
  }, [navigatedAwayLobbyId]);

  useEffect(() => {
    if (user && user.id) {
      registerUser(user.id);
    }
  }, [user?.id, registerUser]); // Only depend on id to avoid user-object re-renders

  useEffect(() => {
    // 1. Validate Active Match on Load / Auth
    if (user && user.id) {
      const checkActiveMatch = async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/matches/user/${user.id}/active`);
          const data = await response.json();

          if (data.success && data.match) {
            console.log('[App] Syncing active match:', data.match.id);
            if (activeLobbyId !== data.match.id) {
              setActiveLobbyId(data.match.id);
            }
            // Also update matchData context if missing
            if (!matchData || matchData.lobby?.id !== data.match.id) {
              // Optional: Fetch full detail or just wait for WS
              // setMatchData({ type: 'LOBBY_UPDATE', lobby: data.match });
            }
          } else {
            // No active match found -> Clear local state if it exists
            if (activeLobbyId) {
              console.log('[App] Clearing stale active match:', activeLobbyId);
              setActiveLobbyId(undefined);
              localStorage.removeItem("activeLobbyId");
              localStorage.removeItem("matchData");
            }
          }
        } catch (err) {
          console.error('[App] Failed to check active match:', err);
        }
      };

      checkActiveMatch();
    }
  }, [user?.id]); // Run once when user logs in

  useEffect(() => {
    if (user && user.id && activeLobbyId) {
      const timeout = setTimeout(() => {
        if (currentPage === "matchgame" || !matchData) {
          requestMatchState(activeLobbyId);
        }
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [activeLobbyId, requestMatchState, currentPage, matchData, user?.id]);

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === "AUTH_ERROR") {
      handleLogout();
      return;
    }

    if (lastMessage.type === "INVITE_RECEIVED" || lastMessage.type === "LOBBY_INVITE") {
      const { fromUser, lobbyId, senderId, senderName, senderAvatar } = lastMessage;

      const inviter = fromUser || {
        id: senderId,
        username: senderName,
        avatar: senderAvatar
      };

      setInviteNotification({ fromUser: inviter, lobbyId });
      setTimeout(() => setInviteNotification(null), 10000);
    }

    if (lastMessage.type === "MATCH_READY") {
      if (lastMessage.lobbyId) {
        setActiveLobbyId(lastMessage.lobbyId);
        if (lastMessage.players && Array.isArray(lastMessage.players)) {



          if (user && user.id) {
            const isUserInMatch = lastMessage.players.some((p: any) =>
              String(p.id) === String(user.id) ||
              (p.discord_id && String(p.discord_id) === String(user.id))
            );
            if (isUserInMatch && navigatedAwayLobbyId !== lastMessage.lobbyId) {
              // Directly go to matchgame
              setCurrentPage("matchgame");
              setNavigatedAwayLobbyId(null);
            }
          }
        }
      }
    }

    if (lastMessage.type === "LOBBY_UPDATE" || lastMessage.type === "MATCH_START") {
      const lobby = lastMessage.lobby || lastMessage.matchData;
      const lobbyId = lobby?.id || lastMessage.lobbyId;

      if (lastMessage.type === "MATCH_START") {
        if (lobbyId && matchData?.lobby?.id === lobbyId) return;
        setMatchData(lastMessage);
        if (navigatedAwayLobbyId !== lobbyId && currentPage !== "matchgame") {
          setCurrentPage("matchgame");
        }
        return;
      }

      if (lobby && lobby.id) {
        if (activeLobbyId && lobby.id !== activeLobbyId) return;
        setActiveLobbyId(lobby.id);
        if (lastMessage.type === "LOBBY_UPDATE") {
          setMatchData({ type: "LOBBY_UPDATE", lobby: lobby, matchData: lobby });
        }

        if (navigatedAwayLobbyId !== lobby.id) {
          if (lobby.serverInfo && currentPage !== "matchgame") {
            setCurrentPage("matchgame");
          }
        }
      }
    }

    if (lastMessage.type === "MATCH_CANCELLED" ||
      lastMessage.type === "MATCH_STATE_ERROR" ||
      lastMessage.type === "LEAVE_MATCH_SUCCESS") {
      setActiveLobbyId(undefined);

      setMatchData(null);
      setNavigatedAwayLobbyId(null);
      if (["matchgame"].includes(currentPage)) {
        setCurrentPage("matchmaking");
      }
    }

    if (lastMessage.type === "SERVER_READY") {
      if (lastMessage.serverInfo && matchData) {
        setMatchData((prev: any) => ({
          ...prev,
          matchData: { ...prev.matchData, serverInfo: lastMessage.serverInfo },
          serverInfo: lastMessage.serverInfo
        }));
      }
    }
  }, [lastMessage, currentPage, navigatedAwayLobbyId, matchData, activeLobbyId, user?.id, handleLogout]);

  useEffect(() => {
    const initUser = async () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      const username = params.get("username");
      const avatar = params.get("avatar");
      let userData: User | null = null;

      if (id && username) {
        userData = {
          id, username, avatar: avatar || "",
          role: params.get("role") || 'user',
          elo: params.get("elo") ? parseInt(params.get("elo")!) : 1000,
          is_vip: params.get("is_vip") === '1' ? 1 : 0,
          vip_until: params.get("vip_until") || undefined,
          is_discord_member: params.get("is_discord_member") === 'true',
          created_at: params.get("created_at") || undefined
        };
        window.history.replaceState({}, document.title, "/");
      } else {
        const savedUser = localStorage.getItem("user");
        if (savedUser) {
          try { userData = JSON.parse(savedUser); } catch (e) { localStorage.removeItem("user"); }
        }
      }

      if (userData) {
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem("user", JSON.stringify(userData));
        try {
          const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/profile/${userData.id}`);
          if (res.ok) {
            const profile = await res.json();
            if (!profile.standoff_nickname) setShowNicknameModal(true);
            const updatedUser = {
              ...userData,
              id: profile.id, // Synchronize with DB primary key
              standoff_nickname: profile.standoff_nickname,
              elo: profile.elo || 1000,
              role: profile.role,
              is_vip: profile.is_vip || 0,
              vip_until: profile.vip_until,
              is_discord_member: profile.is_discord_member,
              created_at: profile.created_at,
              discord_roles: profile.discord_roles,
              gold: profile.gold,
            };
            setUser(updatedUser);
            localStorage.setItem("user", JSON.stringify(updatedUser));
          }
        } catch (error) { console.error("Failed to fetch profile", error); }
      }
    };
    initUser();
  }, []);

  if (!isAuthenticated) return <AuthPage />;

  const isStaff = user?.role === 'admin' || user?.role === 'moderator';
  const hasExpiredGracePeriod = user && user.is_discord_member === false && user.created_at && (
    new Date().getTime() - new Date(user.created_at).getTime() > 24 * 60 * 60 * 1000
  );

  if (hasExpiredGracePeriod && !isStaff) {
    return (
      <div className="flex flex-col min-h-screen bg-background relative font-sans">
        <Header currentPage="join_gate" user={user} onNavigate={handleNavigate} onLogout={handleLogout} backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"} activeLobbyId={activeLobbyId} />
        <main className="container mx-auto px-4 md:px-8 py-8 flex-1 flex items-center justify-center">
          <JoinGatePage />
        </main>
        <Footer />
      </div>
    );
  }

  const validPages = [
    "home", "profile", "leaderboard", "rewards", "friends",
    "matchmaking", "moderator", "admin", "vip", "join_gate", "matchgame", "streamers", "streamer-dashboard", "clans", "clan-profile", "gold-dashboard", "tournaments", "chat", "explore"
  ];

  if (!validPages.includes(currentPage)) return <NotFoundPage onGoHome={handleGoHome} />;

  return (
    <div className="flex flex-col min-h-screen bg-background relative font-sans">
      {inviteNotification && (
        <div className="invite-notification-toast">
          <div className="invite-content">
            <div className="invite-avatar">
              <img
                src={inviteNotification.fromUser?.avatar
                  ? `https://cdn.discordapp.com/avatars/${inviteNotification.fromUser.id}/${inviteNotification.fromUser.avatar}.png`
                  : "https://placehold.co/40x40"
                }
                alt="avatar"
              />
            </div>
            <div className="invite-text">
              <span className="invite-name">{inviteNotification.fromUser.username}</span>
              <span className="invite-msg">таныг тоглох урилга илгээлээ!</span>
            </div>
          </div>
          <div className="invite-actions">
            <button className="invite-btn accept" onClick={handleAcceptInvite}>ЗӨВШӨӨРӨХ</button>
            <button className="invite-btn decline" onClick={handleDeclineInvite}>✕</button>
          </div>
        </div>
      )}

      {showNicknameModal && user && (
        <NicknameSetupModal userId={user.id} onSave={handleNicknameSaved} />
      )}

      <Header
        currentPage={currentPage}
        user={user}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}
        activeLobbyId={activeLobbyId}
      />

      <main className="container mx-auto px-4 md:px-8 py-8 flex-1">
        <Suspense fallback={<LoadingSpinner />}>
          {currentPage === "home" && (
            <>
              <Hero backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"} onNavigate={handleNavigate} onViewProfile={handleViewProfile} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                <Leaderboard />
                <RecentMatches userId={user?.id} backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"} onNavigate={handleNavigate} />
                <DailyRewards />
              </div>
            </>
          )}
          {currentPage === "profile" && <ProfilePage user={user} targetUserId={viewUserId || user?.id} onFindMatch={handleFindMatch} onLogout={handleLogout} onBack={handleProfileBack} />}
          {currentPage === "leaderboard" && <LeaderboardPage onViewProfile={handleViewProfile} />}
          {currentPage === "rewards" && <RewardsPage user={user} backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"} />}
          {currentPage === "friends" && <FriendsPage onViewProfile={handleViewProfile} />}
          {currentPage === "clans" && <ClanPage user={user} backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"} onViewLobby={handleViewLobby} onViewClanProfile={handleViewClanProfile} initialTab={clanInitialTab} />}
          {currentPage === "clan-profile" && viewClanId && <ClanProfilePage backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"} clanId={viewClanId} onBack={() => handleNavigate('clans')} onManage={() => { setClanInitialTab('settings'); handleNavigate('clans'); }} />}
          {currentPage === "moderator" && <ModeratorPage user={user} backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"} onViewLobby={handleViewLobby} />}
          {currentPage === "admin" && <AdminPage user={user} backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"} />}
          {currentPage === "vip" && <VIPPage user={user} backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"} />}
          {currentPage === "streamers" && <StreamersPage />}
          {currentPage === "streamers" && <StreamersPage />}
          {currentPage === "streamer-dashboard" && <StreamerDashboard />}
          {currentPage === "gold-dashboard" && <GoldPage />}
          {currentPage === "tournaments" && <TournamentPage user={user} />}
          {currentPage === "chat" && <ChatPage />}
          {currentPage === "explore" && <ExplorePage onNavigate={handleNavigate} />}
          {currentPage === "matchmaking" && (
            <MatchmakingPage
              user={user}
              backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}
              onViewProfile={handleViewProfile}
              onNavigateToVip={() => handleNavigate('vip')}
              targetMatchId={targetMatchId}
            />
          )}

          {currentPage === "matchgame" && (
            <MatchLobbyPage
              matchId={matchData?.lobby?.id || matchData?.matchData?.id || matchData?.id || activeLobbyId || ""}
              user={user}
              backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}
              onBack={() => handleNavigate("home")}
              onNavigateToProfile={handleViewProfile}
            />
          )}
        </Suspense>
      </main>

      {user && currentPage !== "matchgame" && (
        <Chat variant="floating" />
      )}

      <Footer />
    </div>
  );
}

function App() {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://backend.anandoctane4.workers.dev";
  return (
    <WebSocketProvider url={backendUrl}>
      <AppContent />
    </WebSocketProvider>
  );
}

export default App;
