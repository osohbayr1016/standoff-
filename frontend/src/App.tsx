import { useState, useEffect } from "react";
import "./InviteToast.css"; // Keeping for now as it handles toast animations specific to invites
import Header from "./components/Header";
import Hero from "./components/Hero";
import Leaderboard from "./components/Leaderboard";
import ProfilePage from "./components/ProfilePage";
import LeaderboardPage from "./components/LeaderboardPage";
import FriendsPage from "./components/FriendsPage";
import AuthPage from "./components/AuthPage";
import NotFoundPage from "./components/NotFoundPage";
import JoinGatePage from "./components/JoinGatePage";
import ModeratorPage from "./components/ModeratorPage";
import AdminPage from "@/components/AdminPage";
import Footer from "./components/Footer";
import NicknameSetupModal from "./components/NicknameSetupModal";
import MatchmakingPage from "./components/MatchmakingPage";
import { WebSocketProvider, useWebSocket } from "./components/WebSocketContext";

// Placeholder components (to be implemented)
const RecentMatches = () => <div className="placeholder-card">Recent Matches - Coming Soon</div>;
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
  is_vip?: number;
  vip_until?: string;
}

interface PartyMember {
  id: string;
  username: string;
  avatar?: string;
  elo?: number;
}

// Inner App component that uses WebSocket context
function AppContent() {
  // Initialize currentPage from localStorage or default to 'home'
  const [currentPage, setCurrentPage] = useState(() => {
    // Check for error param first (Server Gate)
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "not_in_server") {
      return "join_gate";
    }

    const savedPage = localStorage.getItem("currentPage");
    const validPages = [
      "home",
      "profile",
      "leaderboard",
      "friends",
      "join_gate"
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

  const handleViewProfile = (userId: string) => {
    setViewUserId(userId);
    setCurrentPage("profile");
  };

  // --- Effects ---

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

  // Register user
  useEffect(() => {
    if (user && user.id) {
      console.log('App: Registering user effect triggered', { userId: user.id });
      registerUser(user.id);
    }
  }, [user, registerUser]);

  // Request match state
  useEffect(() => {
    if (user && user.id && activeLobbyId) {
      const timeout = setTimeout(() => {
        if (currentPage === "matchgame" || !matchData) {
          console.log("Requesting match state for lobby:", activeLobbyId);
          requestMatchState(activeLobbyId);
        }
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [activeLobbyId, requestMatchState, currentPage, matchData, user]);

  // WebSocket Message Handling
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === "AUTH_ERROR") {
      console.error("Auth Error:", lastMessage.message);
      // alert("Session Expired: " + lastMessage.message); // Alert might be annoying if loop
      handleLogout();
      return;
    }

    if (lastMessage.type === "ERROR") {
      console.error("Backend Error:", lastMessage.message);
    }

    // 1. Invites
    if (lastMessage.type === "INVITE_RECEIVED") {
      const { fromUser, lobbyId } = lastMessage;
      setInviteNotification({ fromUser, lobbyId });
      setTimeout(() => setInviteNotification(null), 10000);
    }

    // 2. Global Match Ready
    if (lastMessage.type === "MATCH_READY") {
      console.log("Global Match Ready:", lastMessage);
      if (lastMessage.lobbyId) {
        setActiveLobbyId(lastMessage.lobbyId);

        if (lastMessage.players && Array.isArray(lastMessage.players)) {
          let players: PartyMember[] = [];
          if (lastMessage.players.length > 0 && typeof lastMessage.players[0] === "object") {
            players = lastMessage.players.map((p: any) => ({
              id: p.id || p.discord_id,
              username: p.username || p.name || "Unknown",
              avatar: p.avatar || p.avatar_url,
              elo: p.elo || 1000,
            }));
          } else {
            players = lastMessage.players.map((id: string) => ({
              id,
              username: "Player",
              elo: 1000,
            }));
          }
          setLobbyPartyMembers(players);

          // Auto-Navigate
          if (user && user.id) {
            const rawPlayers = lastMessage.players || [];
            const isUserInMatch = rawPlayers.some((p: any) =>
              String(p.id) === String(user.id) ||
              (p.discord_id && String(p.discord_id) === String(user.id))
            );

            if (isUserInMatch) {
              if (navigatedAwayLobbyId === lastMessage.lobbyId) {
                console.log("User previously explicity navigated away. Suppressing.");
              } else {
                console.log("User in match -> MapBan");
                setCurrentPage("mapban");
                setNavigatedAwayLobbyId(null);
              }
            }
          }
        }
      }
    }

    // 3. Ready Phase logic (Deprecated/Removed, but backend might send it - handled by going straight to lobby/game in recent changes)
    if (lastMessage.type === "READY_PHASE_STARTED") {
      // Just ensure matchgame or mapban flow correct
    }

    // 4. Lobby Update / Match Start
    if (lastMessage.type === "LOBBY_UPDATE" || lastMessage.type === "MATCH_START") {
      const lobby = lastMessage.lobby || lastMessage.matchData;
      const lobbyId = lobby?.id || lastMessage.lobbyId || lastMessage.matchData?.id;

      if (lastMessage.type === "MATCH_START") {
        if (lobbyId && matchData?.lobby?.id === lobbyId) return;

        console.log("MATCH STARTED! Switching to Match View", lastMessage);
        setMatchData(lastMessage);

        if (navigatedAwayLobbyId !== lobbyId && currentPage !== "matchgame") {
          setCurrentPage("matchgame");
        }
        return;
      }

      // Sync Lobby Data
      if (lobby && lobby.id) {
        if (activeLobbyId && lobby.id !== activeLobbyId) {
          console.warn("Ignoring LOBBY_UPDATE for different lobby");
          return;
        }
        setActiveLobbyId(lobby.id);

        if (lastMessage.type === "LOBBY_UPDATE") {
          setMatchData({
            type: "LOBBY_UPDATE",
            lobby: lobby,
            matchData: lobby,
          });
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

        // Simple Auto-Nav Logic
        if (navigatedAwayLobbyId !== lobby.id) {
          if (lobby.serverInfo && currentPage !== "matchgame") {
            setCurrentPage("matchgame");
          } else if (lobby.mapBanState?.mapBanPhase && currentPage !== "mapban") {
            setCurrentPage("mapban");
          }
        }
      }
    }

    // 5. Match Cancelled/Error/Leave
    if (lastMessage.type === "MATCH_CANCELLED" ||
      lastMessage.type === "MATCH_STATE_ERROR" ||
      lastMessage.type === "LEAVE_MATCH_SUCCESS") {
      console.log("Match Ended/Error:", lastMessage.type);
      setActiveLobbyId(undefined);
      setLobbyPartyMembers([]);
      setMatchData(null);
      setNavigatedAwayLobbyId(null);
      if (["mapban", "matchgame"].includes(currentPage)) {
        setCurrentPage("matchmaking");
      }
    }

    // 6. Server Ready (Async)
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

  // OAuth Logic
  useEffect(() => {
    const initUser = async () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      const username = params.get("username");
      const avatar = params.get("avatar");

      // Server Gate Handling
      // If error param exists, it's handled in useState initializer, but here we prevent auto-login overlap
      if (params.get("error") === "not_in_server") return;

      let userData: User | null = null;

      if (id && username) {
        const role = params.get("role") || 'user';
        const elo = params.get("elo") ? parseInt(params.get("elo")!) : 1000;
        const is_vip = params.get("is_vip") === '1' ? 1 : 0;
        const vip_until = params.get("vip_until") || undefined;

        userData = {
          id,
          username,
          avatar: avatar || "",
          role,
          elo,
          is_vip,
          vip_until
        };
        window.history.replaceState({}, document.title, "/");
      } else {
        const savedUser = localStorage.getItem("user");
        if (savedUser) {
          try {
            userData = JSON.parse(savedUser);
          } catch (e) {
            localStorage.removeItem("user");
          }
        }
      }

      if (userData) {
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem("user", JSON.stringify(userData));

        try {
          const res = await fetch(
            `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/profile/${userData.id}`
          );
          if (res.ok) {
            const profile = await res.json();
            if (!profile.standoff_nickname) {
              setShowNicknameModal(true);
            }
            const updatedUser = {
              ...userData,
              standoff_nickname: profile.standoff_nickname,
              elo: profile.elo || 1000,
              role: profile.role === 'admin' ? 'admin' : (userData.role === 'admin' ? 'admin' : (profile.role || 'user')),
              is_vip: profile.is_vip || 0,
              vip_until: profile.vip_until,
            };
            if (
              updatedUser.elo !== userData.elo ||
              updatedUser.standoff_nickname !== userData.standoff_nickname ||
              updatedUser.role !== (userData as any).role ||
              updatedUser.is_vip !== (userData as any).is_vip ||
              updatedUser.vip_until !== (userData as any).vip_until
            ) {
              setUser(updatedUser);
              localStorage.setItem("user", JSON.stringify(updatedUser));
            }
          }
        } catch (error) {
          console.error("Failed to fetch profile", error);
        }
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
  const handleGoHome = () => {
    setViewUserId(null);
    setCurrentPage("home");
  };

  const handleNavigate = (page: string) => {
    const matchPages = ["mapban", "matchgame"];
    if (matchPages.includes(currentPage) && !matchPages.includes(page)) {
      if (activeLobbyId) setNavigatedAwayLobbyId(activeLobbyId);
    }
    if (matchPages.includes(page)) {
      setNavigatedAwayLobbyId(null);
    }
    if (page === "profile") {
      // Navigate to OWN profile
      setViewUserId(null);
    }
    setCurrentPage(page);
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem("user");
    localStorage.removeItem("currentPage");
    setCurrentPage("home");
  };

  const handleAcceptInvite = () => {
    console.log("Joined lobby", inviteNotification?.lobbyId);
    setInviteNotification(null);
    setCurrentPage("matchmaking");
  };

  const handleDeclineInvite = () => setInviteNotification(null);

  // Render Check
  const validPages = [
    "home", "profile", "leaderboard", "rewards",
    "friends", "matchmaking", "matchlobby", "mapban",
    "matchgame", "join_gate", "moderator", "admin"
  ];

  if (currentPage === "join_gate") {
    // Gate page is special, doesn't need auth necessarily, or acts as auth barrier
    return <JoinGatePage />;
  }

  if (!isAuthenticated) return <AuthPage />;
  if (!validPages.includes(currentPage)) return <NotFoundPage onGoHome={handleGoHome} />;

  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      {inviteNotification && (
        <div className="invite-notification-toast">
          <div className="invite-content">
            <div className="invite-avatar">
              <img
                src={inviteNotification.fromUser.avatar
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
        {currentPage === "home" && (
          <>
            <Hero
              backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
              <Leaderboard />
              <RecentMatches />
              <DailyRewards />
            </div>
          </>
        )}
        {currentPage === "profile" && <ProfilePage user={user} targetUserId={viewUserId || user?.id} onFindMatch={handleFindMatch} onLogout={handleLogout} />}
        {currentPage === "leaderboard" && <LeaderboardPage onViewProfile={handleViewProfile} />}
        {currentPage === "rewards" && <RewardsPage />}
        {currentPage === "friends" && <FriendsPage onViewProfile={handleViewProfile} />}
        {currentPage === "moderator" && <ModeratorPage user={user} backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"} />}
        {currentPage === "admin" && <AdminPage user={user} backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"} />}
        {currentPage === "matchmaking" && (
          <MatchmakingPage
            user={user}
            backendUrl={import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}
          />
        )}
        {currentPage === "mapban" && (
          <MapBanPage
            partyMembers={lobbyPartyMembers}
            onCancel={() => handleNavigate("home")}
            activeLobbyId={activeLobbyId}
            onReadyPhaseStart={() => setCurrentPage("matchgame")}
          />
        )}
        {currentPage === "matchgame" && (
          <MatchLobbyPage
            lobby={matchData?.lobby || matchData?.matchData || matchData}
            serverInfo={matchData?.matchData?.serverInfo || matchData?.serverInfo}
          />
        )}
      </main>
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
