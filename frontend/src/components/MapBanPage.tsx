import { useState, useEffect, useRef } from 'react';
import './MapBanPage.css';
import MapBanView from './MapBanView';
import { useWebSocket } from './WebSocketContext'; // Import Hook
import DebugConsole from './DebugConsole';

interface PartyMember {
  id: string;
  username: string;
  avatar?: string;
}

interface MapBanPageProps {
  partyMembers: PartyMember[];
  onCancel: () => void;
  onMapSelected?: (selectedMap: string) => void;
  activeLobbyId?: string; // Add prop to know when we should request state
  onReadyPhaseStart?: () => void; // Callback when ready phase should start
}

const ALL_MAPS = ['Hanami', 'Rust', 'Zone 7', 'Dune', 'Breeze', 'Province', 'Sandstone'];
const BAN_TIMEOUT = 15; // seconds

export default function MapBanPage({ partyMembers, onCancel: _onCancel, onMapSelected, activeLobbyId, onReadyPhaseStart }: MapBanPageProps) {
  const [bannedMaps, setBannedMaps] = useState<string[]>([]);
  const [selectedMap, setSelectedMap] = useState<string | undefined>();
  const [currentBanTeam, setCurrentBanTeam] = useState<'alpha' | 'bravo'>('alpha');
  const [banHistory, setBanHistory] = useState<Array<{ team: string; map: string; timestamp: Date }>>([]);
  const [mapBanPhase, setMapBanPhase] = useState(true);
  const [serverInfo, setServerInfo] = useState<{ ip?: string; password?: string } | undefined>();
  const [timeLeft, setTimeLeft] = useState(BAN_TIMEOUT);
  // Initialize as true if we have party members (coming from matchmaking)
  const [stateInitialized, setStateInitialized] = useState(partyMembers.length > 0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoBanInProgressRef = useRef<boolean>(false);

  const { lastMessage, sendMessage, requestMatchState } = useWebSocket(); // Hook

  // Track if we've requested state to avoid showing default state
  const [hasRequestedState, setHasRequestedState] = useState(false);

  // Request match state on mount or when activeLobbyId changes
  useEffect(() => {
    const savedLobbyId = activeLobbyId || localStorage.getItem('activeLobbyId');
    if (savedLobbyId && !stateInitialized && !hasRequestedState) {
      // Request match state from server
      setHasRequestedState(true);
      requestMatchState(savedLobbyId);

      // Fallback: if we don't receive LOBBY_UPDATE within 3 seconds, initialize with defaults
      const timeout = setTimeout(() => {
        setStateInitialized((prev) => {
          if (!prev) {
            console.warn('Timeout waiting for LOBBY_UPDATE, initializing with defaults');
            setHasRequestedState(false);
            return true;
          }
          return prev;
        });
      }, 3000);

      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLobbyId]); // Run when activeLobbyId changes or on mount

  // Listen for both MATCH_READY and LOBBY_UPDATE to sync state
  useEffect(() => {
    if (!lastMessage) return;

    // Handle MATCH_READY - indicates we're in a lobby
    if (lastMessage.type === 'MATCH_READY') {
      // If we've requested state, wait for LOBBY_UPDATE
      // Otherwise, this is a new match, initialize with defaults
      if (!hasRequestedState) {
        // New match - initialize with default state
        setStateInitialized(true);
        setMapBanPhase(true);
        setCurrentBanTeam('alpha');
        setTimeLeft(BAN_TIMEOUT);
      }
      // If hasRequestedState is true, we'll wait for LOBBY_UPDATE
      return;
    }

    // Handle LOBBY_UPDATE - sync all state from server
    if (lastMessage.type === 'LOBBY_UPDATE') {
      const lobby = lastMessage.lobby;
      if (lobby && lobby.mapBanState) {
        const banState = lobby.mapBanState;

        // Sync banned maps
        setBannedMaps(banState.bannedMaps || []);

        // Sync current ban team
        if (banState.currentBanTeam) {
          setCurrentBanTeam(banState.currentBanTeam);
        }

        // Sync ban history
        if (banState.banHistory) {
          setBanHistory(banState.banHistory.map((entry: any) => ({
            team: entry.team,
            map: entry.map,
            timestamp: new Date(entry.timestamp)
          })));
        }

        // Sync selected map and phase status
        if (banState.selectedMap) {
          setSelectedMap(banState.selectedMap);
        }
        setMapBanPhase(banState.mapBanPhase !== false);

        // Sync server info if present
        if (lobby.serverInfo) {
          setServerInfo(lobby.serverInfo);
        }

        // Calculate timer from server timestamp - use currentTurnStartTimestamp if available
        if (banState.mapBanPhase) {
          const timestamp = banState.currentTurnStartTimestamp || banState.lastBanTimestamp;
          if (timestamp) {
            const elapsed = Date.now() - timestamp;
            const remaining = Math.max(0, BAN_TIMEOUT - Math.floor(elapsed / 1000));
            setTimeLeft(remaining);
          } else {
            // If no timestamp, use full timeout
            setTimeLeft(BAN_TIMEOUT);
          }
        } else {
          setTimeLeft(0);
        }

        // Mark state as initialized - this is the real state from server
        setStateInitialized(true);
        setHasRequestedState(false); // Reset flag after receiving state
      }
    }

    // Handle direct SERVER_READY message
    if (lastMessage.type === 'SERVER_READY') {
      if (lastMessage.serverInfo) {
        setServerInfo(lastMessage.serverInfo);
      }
    }

    // Handle READY_PHASE_STARTED - map ban complete, transition to ready phase
    if (lastMessage.type === 'READY_PHASE_STARTED') {
      console.log("MapBanPage: Received READY_PHASE_STARTED", lastMessage);

      if (lastMessage.selectedMap) {
        setSelectedMap(lastMessage.selectedMap);
      } else {
        console.warn("MapBanPage: READY_PHASE_STARTED missing selectedMap");
      }

      setMapBanPhase(false);
      setStateInitialized(true);

      // Trigger navigation to ready page
      if (onReadyPhaseStart) {
        console.log("MapBanPage: Calling onReadyPhaseStart()");
        onReadyPhaseStart();
      }
    }

    // Handle direct MATCH_START message (legacy, should not happen with ready phase)
    if (lastMessage.type === 'MATCH_START') {
      if (lastMessage.selectedMap) {
        setSelectedMap(lastMessage.selectedMap);
        setMapBanPhase(false);
        setStateInitialized(true);
      }
    }
  }, [lastMessage]);

  // Recalculate timer when currentBanTeam changes (team switch)
  useEffect(() => {
    if (!stateInitialized || !mapBanPhase) return;

    // When team changes, we need to get fresh state from server
    // The server should have already updated currentTurnStartTimestamp
    // This effect will trigger when LOBBY_UPDATE comes with new currentBanTeam
    // The timer calculation above will handle it
  }, [currentBanTeam, stateInitialized, mapBanPhase]);

  // Get current user
  const currentUserId = (() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        return userData.id || userData.username;
      } catch (e) {
        return '';
      }
    }
    return '';
  })();

  // Split into teams - first player is team alpha leader
  const teamAlpha = partyMembers.slice(0, 5);
  const teamBravo = partyMembers.slice(5, 10);
  const teamAlphaLeader = teamAlpha[0];
  const teamBravoLeader = teamBravo[0];

  // Check if current user is a team leader
  const isTeamLeader = teamAlphaLeader?.id === currentUserId || teamBravoLeader?.id === currentUserId;
  const userTeam: 'alpha' | 'bravo' | null =
    teamAlpha.some(p => p.id === currentUserId) ? 'alpha' :
      teamBravo.some(p => p.id === currentUserId) ? 'bravo' : null;

  // Remove banMapRef - state is now managed by server via LOBBY_UPDATE

  const handleBanMap = (mapName: string) => {
    // Prevent banning if auto-ban is in progress
    if (autoBanInProgressRef.current) {
      return;
    }
    // Prevent banning if already banned
    if (bannedMaps.includes(mapName)) {
      return;
    }
    // Prevent banning if not in ban phase
    if (!mapBanPhase) {
      return;
    }

    // Strict permission check: Only the current team leader can ban
    if (userTeam !== currentBanTeam) {
      console.warn("Not your turn to ban!");
      return;
    }

    // Send ban message to server
    sendMessage({
      type: 'BAN_MAP',
      map: mapName,
      team: userTeam
    });

    // Don't update local state - wait for server confirmation via LOBBY_UPDATE
  };

  // Team switching is now handled by server - removed local team switch logic

  // Timer effect - syncs with server state and handles countdown
  useEffect(() => {
    // Don't start timer until state is initialized from server
    if (!stateInitialized) {
      return;
    }

    // Check if ban phase should end
    if (!mapBanPhase) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimeLeft(0);
      return;
    }

    // Clear any existing timer before starting a new one
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Start timer that counts down
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        // Don't count down if already at 0 or below
        if (prev <= 0) {
          return 0;
        }

        const newTime = prev - 1;

        if (newTime <= 0) {
          // Clear timer immediately to prevent multiple executions
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          // Prevent multiple auto-bans from triggering
          if (autoBanInProgressRef.current) {
            return 0;
          }

          // Time's up - auto ban random map for current team
          autoBanInProgressRef.current = true;
          const teamToBan = currentBanTeam;

          // Check if we should end ban phase
          if (bannedMaps.length >= 6) {
            autoBanInProgressRef.current = false;
            return 0;
          }

          const availableMaps = ALL_MAPS.filter(map => !bannedMaps.includes(map));
          // Only auto-ban if more than 1 map remains
          if (availableMaps.length > 1) {
            const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];
            // Send auto-ban to server
            sendMessage({
              type: 'BAN_MAP',
              map: randomMap,
              team: teamToBan
            });
            // Reset flag after a delay
            setTimeout(() => {
              autoBanInProgressRef.current = false;
            }, 1000);
          } else {
            autoBanInProgressRef.current = false;
          }
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentBanTeam, mapBanPhase, bannedMaps.length, sendMessage, stateInitialized]);

  // Check if map ban phase completed and trigger ready phase
  useEffect(() => {
    if (selectedMap && !mapBanPhase && onReadyPhaseStart) {
      // Map ban completed, trigger ready phase navigation
      onReadyPhaseStart();
    }
    if (selectedMap && !mapBanPhase && onMapSelected) {
      // We could call a callback if parent wants to know
      onMapSelected(selectedMap);
    }
  }, [selectedMap, mapBanPhase, onMapSelected, onReadyPhaseStart]);

  const mapBanData = {
    availableMaps: ALL_MAPS,
    bannedMaps,
    selectedMap,
    currentBanTeam,
    teamAlphaLeader: { name: teamAlphaLeader?.username },
    teamBravoLeader: { name: teamBravoLeader?.username },
    banHistory,
    mapBanPhase,
    timeLeft,
    serverInfo,
  };

  // Show loading state until server state is received
  if (!stateInitialized) {
    return (
      <div className="map-ban-page">
        <div className="cyber-grid-bg"></div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          color: '#fff',
          gap: '1rem'
        }}>
          <div className="cyber-spinner" style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(255, 255, 255, 0.1)',
            borderTop: '3px solid var(--primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <div style={{ fontFamily: 'monospace', letterSpacing: '2px', fontSize: '0.8rem' }}>
            СЕРВЕРТЭЙ СИНХРОНЧЛОЖ БАЙНА...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="map-ban-page">
      <div className="cyber-grid-bg"></div>
      <DebugConsole />
      <MapBanView
        lobbyId="current-lobby"
        currentUserId={currentUserId}
        mapBanData={mapBanData}
        onBanMap={handleBanMap}
        isTeamLeader={isTeamLeader}
        userTeam={userTeam}
        onCancel={_onCancel}
      />
    </div>
  );
}

