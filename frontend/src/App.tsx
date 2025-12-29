import { useState, useEffect, Suspense, lazy } from "react";
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
const ProfilePage = lazy(() => import("./components/ProfilePage"));
const LeaderboardPage = lazy(() => import("./components/LeaderboardPage"));
const FriendsPage = lazy(() => import("./components/FriendsPage"));
const AuthPage = lazy(() => import("./components/AuthPage"));
const NotFoundPage = lazy(() => import("./components/NotFoundPage"));
const ModeratorPage = lazy(() => import("./components/ModeratorPage"));
const AdminPage = lazy(() => import("@/components/AdminPage"));
const MatchmakingPage = lazy(() => import("./components/MatchmakingPage"));
const VIPPage = lazy(() => import("./components/VIPPage"));
const JoinGatePage = lazy(() => import("./components/JoinGatePage"));
const StreamersPage = lazy(() => import("./components/StreamersPage"));
const StreamerDashboard = lazy(() => import("./components/StreamerDashboard"));
const ClanPage = lazy(() => import("@/components/ClanPage"));
const ClanProfilePage = lazy(() => import("@/components/ClanProfilePage"));
const GoldPage = lazy(() => import("./components/GoldPage"));

// Placeholder components (to be implemented)
const DailyRewards = () => <div className="placeholder-card">Daily Rewards - Coming Soon</div>;
const RewardsPage = () => <div className="placeholder-page">Rewards Page - Coming Soon</div>;
const MapBanPage = (_props: any) => <div className="placeholder-page">Map Ban - Coming Soon</div>;
const MatchLobbyPage = (_props: any) => <div className="placeholder-page">Match Lobby - Coming Soon</div>;

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

interface PartyMember {
  id: string;
  username: string;
  avatar?: string;
  elo?: number;
}

// Inner App component that uses WebSocket context
function AppContent() {
  const [currentPage, setCurrentPage] = useState(() => {
    const savedPage = localStorage.getItem("currentPage");
    const validPages = [
      "home", "profile", "leaderboard", "friends", "vip", "join_gate", "matchmaking", "streamers", "streamer-dashboard", "clans", "clan-profile", "gold-dashboard"
    ];
    if (savedPage && validPages.includes(savedPage)) {
      return savedPage;
    }
    return "home";
  });

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [lobbyPartyMembers, setLobbyPartyMembers] = useState<PartyMember[]>([]);
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

  const handleViewProfile = (userId: string) => {
    setPreviousPage(currentPage);
    setViewUserId(userId);
    setCurrentPage("profile");
    localStorage.setItem("previousProfileUserId", userId);
  };

  const handleViewClanProfile = (clanId: string) => {
    setPreviousPage(currentPage);
    setViewClanId(clanId);
    setCurrentPage("clan-profile");
  };

  const handleProfileBack = () => {
    if (previousPage && previousPage !== "profile") {
      setCurrentPage(previousPage);
      setPreviousPage(null);
    } else {
      const savedPage = localStorage.getItem("currentPage");
      if (savedPage && savedPage !== "profile") {
        setCurrentPage(savedPage);
      } else {
        setCurrentPage("home");
      }
    }
    setViewUserId(null);
  };

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
  }, [user, registerUser]);

  useEffect(() => {
    if (user && user.id && activeLobbyId) {
      const timeout = setTimeout(() => {
        if (currentPage === "matchgame" || !matchData) {
          requestMatchState(activeLobbyId);
        }
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [activeLobbyId, requestMatchState, currentPage, matchData, user]);

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === "AUTH_ERROR") {
      handleLogout();
      return;
    }

    if (lastMessage.type === "INVITE_RECEIVED") {
      const { fromUser, lobbyId } = lastMessage;
      setInviteNotification({ fromUser, lobbyId });
      setTimeout(() => setInviteNotification(null), 10000);
    }

    if (lastMessage.type === "MATCH_READY") {
      if (lastMessage.lobbyId) {
        setActiveLobbyId(lastMessage.lobbyId);
        if (lastMessage.players && Array.isArray(lastMessage.players)) {
          const players = lastMessage.players.map((p: any) => ({
            id: p.id || p.discord_id,
            username: p.username || p.name || "Unknown",
            avatar: p.avatar || p.avatar_url,
            elo: p.elo || 1000,
          }));
          setLobbyPartyMembers(players);

          if (user && user.id) {
            const isUserInMatch = lastMessage.players.some((p: any) =>
              String(p.id) === String(user.id) ||
              (p.discord_id && String(p.discord_id) === String(user.id))
            );
            if (isUserInMatch && navigatedAwayLobbyId !== lastMessage.lobbyId) {
              setCurrentPage("mapban");
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
        if (lobby.players && Array.isArray(lobby.players)) {
          const players = lobby.players.map((p: any) => ({
            id: p.id || p.discord_id,
            username: p.username || p.name || "Unknown",
            avatar: p.avatar || p.avatar_url,
            elo: p.elo || 1000,
          }));
          setLobbyPartyMembers(players);
        }
        if (navigatedAwayLobbyId !== lobby.id) {
          if (lobby.serverInfo && currentPage !== "matchgame") {
            setCurrentPage("matchgame");
          } else if (lobby.mapBanState?.mapBanPhase && currentPage !== "mapban") {
            setCurrentPage("mapban");
          }
        }
      }
    }

    if (lastMessage.type === "MATCH_CANCELLED" ||
      lastMessage.type === "MATCH_STATE_ERROR" ||
      lastMessage.type === "LEAVE_MATCH_SUCCESS") {
      setActiveLobbyId(undefined);
      setLobbyPartyMembers([]);
      setMatchData(null);
      setNavigatedAwayLobbyId(null);
      if (["mapban", "matchgame"].includes(currentPage)) {
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
  }, [lastMessage, currentPage, navigatedAwayLobbyId, matchData, activeLobbyId, user]);

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

  const handleNicknameSaved = (nickname: string) => {
    if (user) {
      const updatedUser = { ...user, standoff_nickname: nickname };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }
    setShowNicknameModal(false);
  };

  const handleFindMatch = () => setCurrentPage("matchmaking");
  const handleGoHome = () => { setViewUserId(null); setCurrentPage("home"); };

  const handleNavigate = (page: string) => {
    const matchPages = ["mapban", "matchgame"];
    if (matchPages.includes(currentPage) && !matchPages.includes(page)) {
      if (activeLobbyId) setNavigatedAwayLobbyId(activeLobbyId);
    }
    if (matchPages.includes(page)) setNavigatedAwayLobbyId(null);
    if (page === "profile") {
      if (currentPage !== "profile") setPreviousPage(currentPage);
      setViewUserId(null);
    } else {
      if (currentPage === "profile") setPreviousPage(null);
    }
    if (page !== "matchmaking") setTargetMatchId(null);
    setCurrentPage(page);
  };

  const handleViewLobby = (lobbyId: string) => { setTargetMatchId(lobbyId); setCurrentPage("matchmaking"); };

  const handleLogout = () => {
    setUser(null); setIsAuthenticated(false);
    localStorage.removeItem("user"); localStorage.removeItem("currentPage");
    setCurrentPage("home");
  };

  const handleAcceptInvite = () => { setInviteNotification(null); setCurrentPage("matchmaking"); };
  const handleDeclineInvite = () => setInviteNotification(null);

  const validPages = [
    "home", "profile", "leaderboard", "rewards", "friends",
    "matchmaking", "moderator", "admin", "vip", "join_gate", "mapban", "matchgame", "streamers", "streamer-dashboard", "clans", "clan-profile", "gold-dashboard"
  ];

  if (!isAuthenticated) return <AuthPage />;

  const isStaff = user?.role === 'admin' || user?.role === 'moderator';
  const hasExpiredGracePeriod = user && user.is_discord_member === false && user.created_at && (
    new Date().getTime() - new Date(user.created_at).getTime() > 24 * 60 * 60 * 1000
  );

  if (hasExpiredGracePeriod && !isStaff) {
    return (
      <div className="flex flex-col min-h-screen bg-background relative">
        <Header currentPage="join_gate" user={user} onNavigate={handleNavigate} onLogout={handleLogout} backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"} />
        <main className="container mx-auto px-4 md:px-8 py-8 flex-1 flex items-center justify-center">
          <JoinGatePage />
        </main>
        <Footer />
      </div>
    );
  }

  if (!validPages.includes(currentPage)) return <NotFoundPage onGoHome={handleGoHome} />;

  return (
    <div className="flex flex-col min-h-screen bg-background relative">
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
          {currentPage === "rewards" && <RewardsPage />}
          {currentPage === "friends" && <FriendsPage onViewProfile={handleViewProfile} />}
          {currentPage === "clans" && <ClanPage user={user} backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"} onViewLobby={handleViewLobby} onViewClanProfile={handleViewClanProfile} initialTab={clanInitialTab} />}
          {currentPage === "clan-profile" && viewClanId && <ClanProfilePage backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"} clanId={viewClanId} onBack={() => handleNavigate('clans')} onManage={() => { setClanInitialTab('settings'); handleNavigate('clans'); }} />}
          {currentPage === "moderator" && <ModeratorPage user={user} backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"} onViewLobby={handleViewLobby} />}
          {currentPage === "admin" && <AdminPage user={user} backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"} />}
          {currentPage === "vip" && <VIPPage user={user} backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"} />}
          {currentPage === "streamers" && <StreamersPage />}
          {currentPage === "streamer-dashboard" && <StreamerDashboard />}
          {currentPage === "gold-dashboard" && <GoldPage />}
          {currentPage === "matchmaking" && (
            <MatchmakingPage
              user={user}
              backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}
              onViewProfile={handleViewProfile}
              onNavigateToVip={() => handleNavigate('vip')}
              targetMatchId={targetMatchId}
            />
          )}
          {currentPage === "mapban" && (
            <MapBanPage
              partyMembers={lobbyPartyMembers}
              onCancel={() => handleNavigate("home")}
              onReadyPhaseStart={() => setCurrentPage("matchgame")}
            />
          )}
          {currentPage === "matchgame" && (
            <MatchLobbyPage
              lobby={matchData?.lobby || matchData?.matchData || matchData}
              serverInfo={matchData?.matchData?.serverInfo || matchData?.serverInfo}
            />
          )}
        </Suspense>
      </main>

      {user && currentPage !== "matchgame" && currentPage !== "mapban" && (
        <Chat variant="floating" />
      )}

      <Footer />
    </div>
  );
}

function App() {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8787";
  return (
    <WebSocketProvider url={backendUrl}>
      <AppContent />
    </WebSocketProvider>
  );
}

export default App;
