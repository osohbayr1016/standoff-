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
import MatchLobbyPage from "./components/MatchLobbyPage";
import MapBanPage from "./components/MapBanPage";
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
  mmr?: number;
}

interface PartyMember {
  id: string;
  username: string;
  avatar?: string;
  mmr?: number;
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
      "matchlobby",
      "mapban",
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
  const [activeLobbyId, setActiveLobbyId] = useState<string | undefined>(); // Track active lobby

  const { registerUser, lastMessage } = useWebSocket();

  // Save currentPage to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("currentPage", currentPage);
  }, [currentPage]);

  // Register user on socket when authenticated
  useEffect(() => {
    if (user && user.id) {
      registerUser(user.id);
    }
  }, [user, registerUser]);

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
              mmr: p.mmr || 1000,
            }));
          } else {
            players = lastMessage.players.map((id: string) => ({
              id,
              username: "Player",
              mmr: 1000,
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

    // 3. Handle Match Cancelled
    if (lastMessage.type === "MATCH_CANCELLED") {
      console.log("Match Cancelled:", lastMessage);
      // Clear lobby state
      setActiveLobbyId(undefined);
      setLobbyPartyMembers([]);
      setSelectedMap(undefined);
      // Navigate back to matchmaking or home
      if (currentPage === "mapban" || currentPage === "matchlobby") {
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
        userData = { id, username, avatar: avatar || "", mmr: 1000 };
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
            `${
              import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"
            }/api/profile/${userData.id}`
          );
          if (res.ok) {
            const profile = await res.json();

            if (!profile.standoff_nickname) {
              setShowNicknameModal(true);
            }

            // Sync latest data including MMR
            const updatedUser = {
              ...userData,
              standoff_nickname: profile.standoff_nickname,
              mmr: profile.mmr || 1000,
            };

            // Only update if changes found
            if (
              updatedUser.mmr !== userData.mmr ||
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
              <span className="invite-msg">invited you to play!</span>
            </div>
          </div>
          <div className="invite-actions">
            <button className="invite-btn accept" onClick={handleAcceptInvite}>
              ACCEPT
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
        {currentPage === "matchlobby" && (
          <MatchLobbyPage
            partyMembers={lobbyPartyMembers}
            selectedMap={selectedMap}
            onCancel={() => setCurrentPage("home")}
          />
        )}
        {currentPage === "mapban" && (
          <MapBanPage
            partyMembers={lobbyPartyMembers}
            onCancel={() => setCurrentPage("home")}
            onMapSelected={(map) => {
              setSelectedMap(map);
              setCurrentPage("matchlobby");
            }}
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
