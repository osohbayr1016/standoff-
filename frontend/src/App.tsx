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
import ReadyPage from "./components/ReadyPage";
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
  const [matchData, setMatchData] = useState<any>(() => {
    // Restore matchData from localStorage on mount
    const saved = localStorage.getItem("matchData");
    return saved ? JSON.parse(saved) : null;
  }); // Store match server info
  const [selectedMap, setSelectedMap] = useState<string | undefined>(); // Store selected map for ready page
  const [userNavigatedAway, setUserNavigatedAway] = useState(false); // Track if user explicitly navigated away from match

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

  // Save matchData to localStorage whenever it changes
  useEffect(() => {
    if (matchData) {
      localStorage.setItem("matchData", JSON.stringify(matchData));
    } else {
      localStorage.removeItem("matchData");
    }
  }, [matchData]);

  // Register user on socket when authenticated and request match state if needed
  // 1. Register user on socket when authenticated (and when user changes)
  useEffect(() => {
    if (user && user.id) {
      console.log('App: Registering user effect triggered', { userId: user.id });
      registerUser(user.id);
    } else {
      console.log('App: Skipping registration - no user', { user });
    }
  }, [user, registerUser]);

  // 2. Request match state logic
  useEffect(() => {
    if (user && user.id && activeLobbyId) {
      const timeout = setTimeout(() => {
        // Always request fresh state if on matchgame page (handles refresh)
        // Also request if matchData is missing
        if (currentPage === "matchgame" || !matchData) {
          console.log(
            "Requesting match state for lobby:",
            activeLobbyId,
            "currentPage:",
            currentPage
          );
          requestMatchState(activeLobbyId);
        }
      }, 500); // Small delay to ensure socket is connected
      return () => clearTimeout(timeout);
    }
  }, [activeLobbyId, requestMatchState, currentPage, matchData, user]);

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
        }
      }
    }

    // 3. Ready Phase Started - transition from map ban to ready page
    if (lastMessage.type === "READY_PHASE_STARTED") {
      console.log("Ready phase started:", lastMessage);
      if (lastMessage.selectedMap) {
        setSelectedMap(lastMessage.selectedMap);
      }
    }

    // 4. Lobby Update / Match Start Catch-up (Persistence)
    if (
      lastMessage.type === "LOBBY_UPDATE" ||
      lastMessage.type === "MATCH_START"
    ) {
      console.log("Persistence Update:", lastMessage.type);
      const lobby = lastMessage.lobby || lastMessage.matchData;

      if (lastMessage.type === "MATCH_START") {
        // Prevent processing the same MATCH_START event multiple times
        const eventId = lastMessage.lobbyId || lastMessage.matchData?.id;
        if (eventId && matchData?.lobby?.id === eventId) {
          console.log("MATCH_START already processed for lobby:", eventId);
          return;
        }

        console.log("MATCH STARTED! Switching to Match View", lastMessage);
        setMatchData(lastMessage);
        // Only redirect to matchgame if:
        // 1. User hasn't explicitly navigated away from matchgame, AND
        // 2. User is currently on a match-related page (mapban, ready, or already on matchgame)
        // Never force redirect if user is on home/matchmaking/leaderboard/etc
        if (!userNavigatedAway) {
          const matchRelatedPages = ["mapban", "ready", "matchgame"];
          if (matchRelatedPages.includes(currentPage)) {
            // User is in match flow or already on matchgame, ensure they're on matchgame
            if (currentPage !== "matchgame") {
              setCurrentPage("matchgame");
            }
          }
          // If user is on other pages (home, matchmaking, leaderboard, etc), don't redirect
        }
        // If userNavigatedAway is true, just update matchData but don't force navigation
        return;
      }

      // Handle NeatQueue webhook events
      if (lastMessage.type === "NEATQUEUE_MATCH_STARTED") {
        console.log("🔍 NeatQueue Match Started - Full Data:", lastMessage.data);
        console.log("🔍 Teams Array:", lastMessage.data?.teams);

        // Set match data with NeatQueue info
        const neatqueueTeams = lastMessage.data?.teams || [];
        console.log(`🔍 Number of teams received: ${neatqueueTeams.length}`);

        const teamA =
          neatqueueTeams[0]?.players.map((p: any) => ({
            id: p.id,
            username: p.name,
            avatar: null,
            elo: p.rating || 1000,
          })) || [];
        const teamB =
          neatqueueTeams[1]?.players.map((p: any) => ({
            id: p.id,
            username: p.name,
            avatar: null,
            elo: p.rating || 1000,
          })) || [];

        console.log(`🔍 Team A Players: ${teamA.length}`, teamA);
        console.log(`🔍 Team B Players: ${teamB.length}`, teamB);

        const neatqueueMatchData = {
          lobby: {
            id: lastMessage.data?.game_number || "unknown",
            teamA,
            teamB,
            mapBanState: {
              selectedMap: lastMessage.data?.map || "Unknown",
            },
          },
          matchData: {
            serverInfo: lastMessage.data?.serverInfo,
          },
        };

        setMatchData(neatqueueMatchData);
        setActiveLobbyId(String(lastMessage.data?.game_number || "unknown"));

        // Auto-navigate to match lobby
        if (!userNavigatedAway) {
          setCurrentPage("matchgame");
        }
      }

      // Handle match completion - clean up state
      if (
        lastMessage.type === "NEATQUEUE_MATCH_COMPLETED" ||
        lastMessage.type === "MATCH_COMPLETED"
      ) {
        console.log("Match completed, cleaning up state:", lastMessage);

        // Clear match-related state
        setActiveLobbyId(undefined);
        setMatchData(null);
        setLobbyPartyMembers([]);
        setSelectedMap(undefined);
        setUserNavigatedAway(false);

        // Navigate to home page
        setCurrentPage("home");

        // Show match results if available
        if (lastMessage.winner || lastMessage.tie) {
          console.log("Match results:", {
            winner: lastMessage.winner,
            tie: lastMessage.tie,
            teams: lastMessage.teams || lastMessage.data?.teams,
          });
          // TODO: Show match results modal/page
        }
      }
      if (lobby && lobby.id) {
        // Only update if this is the current active lobby to prevent wrong lobby bug
        if (activeLobbyId && lobby.id !== activeLobbyId) {
          console.warn(
            "Received LOBBY_UPDATE for different lobby, ignoring:",
            lobby.id,
            "current:",
            activeLobbyId
          );
          return;
        }

        setActiveLobbyId(lobby.id);

        // Update matchData for matchgame page - store the full lobby object
        if (lastMessage.type === "LOBBY_UPDATE") {
          setMatchData({
            type: "LOBBY_UPDATE",
            lobby: lobby,
            matchData: lobby,
          });
        }

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

        // Check if ready phase is active
        if (lobby.readyPhaseState?.phaseActive) {
          if (lobby.mapBanState?.selectedMap) {
            setSelectedMap(lobby.mapBanState.selectedMap);
          }
        }
      }
    }

    // 5. Handle Match Cancelled
    if (lastMessage.type === "MATCH_CANCELLED") {
      console.log("Match Cancelled:", lastMessage);
      // Clear lobby state
      setActiveLobbyId(undefined);
      setLobbyPartyMembers([]);
      setSelectedMap(undefined);
      setMatchData(null); // Clear match data
      // Navigate back to matchmaking or home
      if (
        currentPage === "mapban" ||
        currentPage === "ready" ||
        currentPage === "matchgame"
      ) {
        setCurrentPage("matchmaking");
      }
    }

    // 6. Handle SERVER_READY (Async Server Allocation)
    if (lastMessage.type === "SERVER_READY") {
      console.log("Server Ready Update:", lastMessage);
      if (lastMessage.serverInfo) {
        // Update matchData with server info
        if (matchData) {
          const updatedMatchData = {
            ...matchData,
            matchData: {
              ...matchData.matchData,
              serverInfo: lastMessage.serverInfo,
            },
            serverInfo: lastMessage.serverInfo,
          };
          setMatchData(updatedMatchData);
        }
        // Also update current lobby if we're in a match
        if (activeLobbyId && lastMessage.lobbyId === activeLobbyId) {
          // Server info will be included in next LOBBY_UPDATE
        }
      }
    }

    // 7. Handle Match State Error (match not found or user not in match)
    if (lastMessage.type === "MATCH_STATE_ERROR") {
      console.log("Match State Error:", lastMessage);
      // Clear invalid lobby state
      setActiveLobbyId(undefined);
      setLobbyPartyMembers([]);
      // Navigate back to matchmaking or home if on match pages
      if (
        currentPage === "mapban" ||
        currentPage === "ready" ||
        currentPage === "matchgame"
      ) {
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

  // Navigation handler that always works, regardless of current page
  const handleNavigate = (page: string) => {
    // If user navigates away from matchgame, mark that they explicitly left
    if (currentPage === "matchgame" && page !== "matchgame") {
      setUserNavigatedAway(true);
    }
    // If user navigates back to matchgame, reset the flag
    if (page === "matchgame") {
      setUserNavigatedAway(false);
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
    "ready",
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
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        activeLobbyId={activeLobbyId}
        onReturnToMatch={() => {
          if (activeLobbyId) {
            // Reset the flag when user explicitly returns to match
            setUserNavigatedAway(false);
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
            onCancel={() => {
              // Handle cancel (e.g., leave queue)
            }}
            onStartLobby={() => {
              // Handle starting lobby/queue
            }}
            activeLobbyId={activeLobbyId}
            lobbyState={matchData?.lobby || matchData?.matchData || matchData}
          />
        )}
        {currentPage === "mapban" && (
          <MapBanPage
            partyMembers={lobbyPartyMembers}
            onCancel={() => setCurrentPage("home")}
            activeLobbyId={activeLobbyId}
            onReadyPhaseStart={() => setCurrentPage("ready")}
          />
        )}
        {currentPage === "ready" && (
          <ReadyPage
            partyMembers={lobbyPartyMembers}
            activeLobbyId={activeLobbyId}
            selectedMap={selectedMap}
            onMatchStart={() => {
              // Match started, navigate to matchgame
              // The matchData will be set by the MATCH_START handler
              setCurrentPage("matchgame");
            }}
          />
        )}
        {currentPage === "matchgame" && (
          <MatchLobbyPage
            lobby={matchData?.lobby || matchData?.matchData || matchData}
            serverInfo={
              matchData?.matchData?.serverInfo || matchData?.serverInfo
            }
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
