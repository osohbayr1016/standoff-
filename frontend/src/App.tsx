import { useState, useEffect } from "react";
import "./App.css";
import "./InviteToast.css";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Leaderboard from "./components/Leaderboard";
import RecentMatches from "./components/RecentMatches";
import DailyRewards from "./components/DailyRewards";
import ProfilePage from "./components/ProfilePage";
import LeaderboardPage from "./components/LeaderboardPage";
import RewardsPage from "./components/RewardsPage";
import FriendsPage from "./components/FriendsPage";
import MatchmakingPage from "./components/MatchmakingPage";
import MapBanPage from "./components/MapBanPage";
import MatchLobbyPage from "./components/MatchLobbyPage";
import AuthPage from "./components/AuthPage";
import NotFoundPage from "./components/NotFoundPage";
import JoinGatePage from "./components/JoinGatePage";
import Footer from "./components/Footer";
import NicknameSetupModal from "./components/NicknameSetupModal";
import { WebSocketProvider, useWebSocket } from "./components/WebSocketContext";

interface User {
  id: string;
  username: string;
  avatar: string;
  standoff_nickname?: string;
  elo?: number;
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
      "rewards",
      "friends",
      "matchmaking",
      "mapban",
      "matchgame",
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
        userData = { id, username, avatar: avatar || "", elo: 1000 };
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
            };
            if (updatedUser.elo !== userData.elo || updatedUser.standoff_nickname !== userData.standoff_nickname) {
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
  const handleGoHome = () => setCurrentPage("home");

  const handleNavigate = (page: string) => {
    const matchPages = ["mapban", "matchgame"];
    if (matchPages.includes(currentPage) && !matchPages.includes(page)) {
      if (activeLobbyId) setNavigatedAwayLobbyId(activeLobbyId);
    }
    if (matchPages.includes(page)) {
      setNavigatedAwayLobbyId(null);
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
    "matchgame", "join_gate"
  ];

  if (currentPage === "join_gate") {
    // Gate page is special, doesn't need auth necessarily, or acts as auth barrier
    return <JoinGatePage />;
  }

  if (!isAuthenticated) return <AuthPage />;
  if (!validPages.includes(currentPage)) return <NotFoundPage onGoHome={handleGoHome} />;

  return (
    <div className="app">
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
        activeLobbyId={activeLobbyId}
        onReturnToMatch={() => {
          if (activeLobbyId) {
            setNavigatedAwayLobbyId(null);
            requestMatchState(activeLobbyId);
          }
        }}
      />

      <main className="main-content">
        {currentPage === "home" && (
          <>
            <Hero onFindMatch={handleFindMatch} />
            <div className="content-grid">
              <Leaderboard />
              <RecentMatches />
              <DailyRewards />
            </div>
          </>
        )}
        {currentPage === "profile" && <ProfilePage user={user} onFindMatch={handleFindMatch} onLogout={handleLogout} />}
        {currentPage === "leaderboard" && <LeaderboardPage />}
        {currentPage === "rewards" && <RewardsPage />}
        {currentPage === "friends" && <FriendsPage />}
        {currentPage === "matchmaking" && (
          <MatchmakingPage
            onCancel={() => { }}
            onStartLobby={() => { }}
            activeLobbyId={activeLobbyId}
            lobbyState={matchData?.lobby || matchData?.matchData || matchData}
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
