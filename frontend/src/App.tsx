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
    // Restore activeLobbyId from localStorage on mount
    const saved = localStorage.getItem("activeLobbyId");
    return saved || undefined;
  }); // Track active lobby
  const [matchData, setMatchData] = useState<any>(null); // Store match server info

  const { registerUser, lastMessage, requestMatchState } = useWebSocket();

  // Save currentPage to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("currentPage", currentPage);
  }, [currentPage]);

  // Save activeLobbyId to localStorage whenever it changes
  useEffect(() => {
    if (activeLobbyId) {
      localStorage.setItem("activeLobbyId", activeLobbyId);
    } else {
      localStorage.removeItem("activeLobbyId");
    }
  }, [activeLobbyId]);

  // Register user on socket when authenticated and request match state if needed
  useEffect(() => {
    if (user && user.id) {
      registerUser(user.id);

      // If we have an activeLobbyId, request match state after a short delay to ensure socket is ready
      if (activeLobbyId) {
        const timeout = setTimeout(() => {
          requestMatchState(activeLobbyId);
        }, 500); // Small delay to ensure socket is connected
        return () => clearTimeout(timeout);
      }
    }
  }, [user, registerUser, activeLobbyId, requestMatchState]);

  // Handle incoming WebSocket messages (Invites & Match Ready)
  useEffect(() => {
    if (!lastMessage) return;

    // 1. Invites
    if (lastMessage.type === "INVITE_RECEIVED") {
      const { fromUser, lobbyId } = lastMessage;
      setInviteNotification({ fromUser, lobbyId });
      setTimeout(() => setInviteNotification(null), 10000);
    }

    // 2. Global Match Ready Listener (Persistence)
    // Even if user is on Home page, we want to capture this and offer return button
    if (lastMessage.type === "MATCH_READY") {
      console.log("Global Match Ready:", lastMessage);
      if (lastMessage.lobbyId) {
        setActiveLobbyId(lastMessage.lobbyId); // Set active lobby logic

        // Also update party members if available
        if (lastMessage.players && Array.isArray(lastMessage.players)) {
          // Parse players similar to MatchmakingPage logic
          let players: PartyMember[] = [];
          if (
            lastMessage.players.length > 0 &&
            typeof lastMessage.players[0] === "object"
          ) {
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

          // AUTO-NAVIGATE if user is in matchmaking or home (idle)
          // But if they are deep in profile, maybe just show the button?
          // For now, let's auto-navigate if on matchmaking page (handled by that page)
          // OR if just idle on home.
          if (currentPage === "matchmaking" || currentPage === "home") {
            setCurrentPage("mapban");
          }
        }
      }
    }

    // 3. Lobby Update / Match Start Catch-up (Persistence)
    if (
      lastMessage.type === "LOBBY_UPDATE" ||
      lastMessage.type === "MATCH_START"
    ) {
      console.log("Persistence Update:", lastMessage.type);
      const lobby = lastMessage.lobby || lastMessage.matchData;

      if (lastMessage.type === "MATCH_START") {
        console.log("MATCH STARTED! Switching to Match View", lastMessage);
        setMatchData(lastMessage);
        setCurrentPage("matchgame");
        return;
      }

      if (lobby && lobby.id) {
        setActiveLobbyId(lobby.id);

        // Update party members
        if (lobby.players && Array.isArray(lobby.players)) {
          const players = lobby.players.map((p: any) => ({
            id: p.id || p.discord_id,
            username: p.username || p.name || "Unknown",
            avatar: p.avatar || p.avatar_url,
            elo: p.elo || 1000,
          }));
          setLobbyPartyMembers(players);
        }

        // AUTO-NAVIGATE if idle
        if (currentPage === "matchmaking" || currentPage === "home") {
          setCurrentPage("mapban");
        }
      }
    }

    // 4. Handle Match Cancelled
    if (lastMessage.type === "MATCH_CANCELLED") {
      console.log("Match Cancelled:", lastMessage);
      // Clear lobby state
      setActiveLobbyId(undefined);
      setLobbyPartyMembers([]);
      // Navigate back to matchmaking or home
      if (currentPage === "mapban" || currentPage === "matchgame") {
        setCurrentPage("matchmaking");
      }
    }

    // 5. Handle SERVER_READY (Async Server Allocation)
    if (lastMessage.type === "SERVER_READY") {
      console.log("Server Ready Update:", lastMessage);
      if (matchData) {
        // Merge server info into existing match data
        const updatedMatchData = {
          ...matchData,
          matchData: {
            ...matchData.matchData,
            serverInfo: lastMessage.serverInfo
          },
          serverInfo: lastMessage.serverInfo
        };
        setMatchData(updatedMatchData);
      }
    }

    // 6. Handle Match State Error (match not found or user not in match)
    if (lastMessage.type === "MATCH_STATE_ERROR") {
      console.log("Match State Error:", lastMessage);
      // Clear invalid lobby state
      setActiveLobbyId(undefined);
      setLobbyPartyMembers([]);
      // Navigate back to matchmaking or home if on match pages
      if (currentPage === "mapban" || currentPage === "matchgame") {
        setCurrentPage("matchmaking");
      }
    }
  }, [lastMessage, currentPage]);

  // Discord OAuth callback-ыг шалгах
  useEffect(() => {
    const initUser = async () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      const username = params.get("username");
      const avatar = params.get("avatar");

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
        // Optimistically set to show header immediately
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem("user", JSON.stringify(userData));

        try {
          const res = await fetch(
            `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"
            }/api/profile/${userData.id}`
          );
          if (res.ok) {
            const profile = await res.json();

            if (!profile.standoff_nickname) {
              setShowNicknameModal(true);
            }

            // Sync latest data including ELO
            const updatedUser = {
              ...userData,
              standoff_nickname: profile.standoff_nickname,
              elo: profile.elo || 1000,
            };

            // Only update if changes found
            if (
              updatedUser.elo !== userData.elo ||
              updatedUser.standoff_nickname !== userData.standoff_nickname
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

  const handleFindMatch = () => {
    setCurrentPage("matchmaking");
  };

  const handleGoHome = () => {
    setCurrentPage("home");
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem("user");
    localStorage.removeItem("currentPage");
    setCurrentPage("home");
  };

  const handleStartLobby = (partyMembers: PartyMember[]) => {
    setLobbyPartyMembers(partyMembers);
    setCurrentPage("mapban");
  };

  const handleAcceptInvite = () => {
    // Logic to join lobby (Simulated for now by going to matchmaking or lobby page)
    console.log("Joined lobby", inviteNotification?.lobbyId);
    setInviteNotification(null);
    setCurrentPage("matchmaking"); // Or a specific lobby page
  };

  const handleDeclineInvite = () => {
    setInviteNotification(null);
  };

  // Check if current page is valid
  const validPages = [
    "home",
    "profile",
    "leaderboard",
    "rewards",
    "friends",
    "matchmaking",
    "matchlobby",
    "mapban",
    "matchgame",
  ];
  const isValidPage = validPages.includes(currentPage);

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  // Show 404 page if page is not valid
  if (!isValidPage) {
    return <NotFoundPage onGoHome={handleGoHome} />;
  }

  return (
    <div className="app">
      {inviteNotification && (
        <div className="invite-notification-toast">
          <div className="invite-content">
            <div className="invite-avatar">
              <img
                src={
                  inviteNotification.fromUser.avatar
                    ? `https://cdn.discordapp.com/avatars/${inviteNotification.fromUser.id}/${inviteNotification.fromUser.avatar}.png`
                    : "https://placehold.co/40x40"
                }
                alt="avatar"
              />
            </div>
            <div className="invite-text">
              <span className="invite-name">
                {inviteNotification.fromUser.username}
              </span>
              <span className="invite-msg">таныг тоглох урилга илгээлээ!</span>
            </div>
          </div>
          <div className="invite-actions">
            <button className="invite-btn accept" onClick={handleAcceptInvite}>
              ЗӨВШӨӨРӨХ
            </button>
            <button
              className="invite-btn decline"
              onClick={handleDeclineInvite}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {showNicknameModal && user && (
        <NicknameSetupModal userId={user.id} onSave={handleNicknameSaved} />
      )}

      <Header
        currentPage={currentPage}
        user={user}
        onNavigate={setCurrentPage}
        onLogout={handleLogout}
        activeLobbyId={activeLobbyId}
        onReturnToMatch={() => {
          if (activeLobbyId) {
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

        {currentPage === "profile" && (
          <ProfilePage
            user={user}
            onFindMatch={handleFindMatch}
            onLogout={handleLogout}
          />
        )}
        {currentPage === "leaderboard" && <LeaderboardPage />}
        {currentPage === "rewards" && <RewardsPage />}
        {currentPage === "friends" && <FriendsPage />}
        {currentPage === "matchmaking" && (
          <MatchmakingPage
            onCancel={() => setCurrentPage("home")}
            onStartLobby={handleStartLobby}
          />
        )}
        {currentPage === "mapban" && (
          <MapBanPage
            partyMembers={lobbyPartyMembers}
            onCancel={() => setCurrentPage("home")}
            activeLobbyId={activeLobbyId}
          />
        )}
        {currentPage === "matchgame" && (
          <MatchLobbyPage
            lobby={matchData?.matchData || matchData?.lobby || matchData}
            serverInfo={
              matchData?.matchData?.serverInfo || matchData?.serverInfo
            }
            onMatchStart={() => { }}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}

function App() {
  const backendUrl =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:8787";

  return (
    <WebSocketProvider url={backendUrl}>
      <AppContent />
    </WebSocketProvider>
  );
}

export default App;
