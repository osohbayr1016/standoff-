import { useState, useEffect, useRef } from 'react';
import './MapBanPage.css';
import MapBanView from './MapBanView';
import { useWebSocket } from './WebSocketContext'; // Import Hook

interface PartyMember {
  id: string;
  username: string;
  avatar?: string;
}

interface MapBanPageProps {
  partyMembers: PartyMember[];
  onCancel: () => void;
  onMapSelected?: (selectedMap: string) => void;
}

const ALL_MAPS = ['Hanami', 'Rust', 'Zone 7', 'Dune', 'Breeze', 'Province', 'Sandstone'];
const BAN_TIMEOUT = 15; // seconds

export default function MapBanPage({ partyMembers, onCancel: _onCancel, onMapSelected }: MapBanPageProps) {
  const [bannedMaps, setBannedMaps] = useState<string[]>([]);
  const [selectedMap, setSelectedMap] = useState<string | undefined>();
  const [currentBanTeam, setCurrentBanTeam] = useState<'alpha' | 'bravo'>('alpha');
  const [banHistory, setBanHistory] = useState<Array<{ team: string; map: string; timestamp: Date }>>([]);
  const [mapBanPhase, setMapBanPhase] = useState(true);
  const [timeLeft, setTimeLeft] = useState(BAN_TIMEOUT);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoBanInProgressRef = useRef<boolean>(false);
  const pendingTeamSwitchRef = useRef<boolean>(false);

  const { sendMessage, lastMessage } = useWebSocket(); // Hook

  // Listen for LOBBY_UPDATE from server
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'LOBBY_UPDATE') {
      const lobby = lastMessage.lobby;
      if (lobby && lobby.mapBanState) {
        const serverBanned = lobby.mapBanState.bannedMaps || [];
        setBannedMaps(serverBanned);

        // Check if ban phase is complete
        if (serverBanned.length >= 6) {
          const remaining = ALL_MAPS.find(m => !serverBanned.includes(m));
          if (remaining) {
            setSelectedMap(remaining);
            setMapBanPhase(false);
          }
        }
      }
    }
  }, [lastMessage]);

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

  const banMapRef = useRef<((mapName: string, team: 'alpha' | 'bravo') => void) | null>(null);

  banMapRef.current = (mapName: string, team: 'alpha' | 'bravo') => {
    setBannedMaps((prevBanned) => {
      // Prevent duplicate bans
      if (prevBanned.includes(mapName)) return prevBanned;

      const newBanned = [...prevBanned, mapName];

      // Update ban history separately
      setBanHistory((prevHistory) => {
        // Check if this map was already added to history (prevent duplicates)
        const alreadyInHistory = prevHistory.some(entry => entry.map === mapName);
        if (alreadyInHistory) return prevHistory;

        return [
          ...prevHistory,
          { team: team, map: mapName, timestamp: new Date() },
        ];
      });

      // Clear timer and reset auto-ban flag
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      autoBanInProgressRef.current = false;

      // When only 1 map remains (6 maps banned), end ban phase
      if (newBanned.length >= 6) {
        const remainingMap = ALL_MAPS.find(map => !newBanned.includes(map));
        if (remainingMap) {
          // Set the remaining map as selected (last one standing)
          setTimeout(() => {
            setSelectedMap(remainingMap);
            setMapBanPhase(false);
            setTimeLeft(0);
          }, 100);
        }
      } else {
        // Mark that we need to switch teams after this state update completes
        pendingTeamSwitchRef.current = true;
      }

      return newBanned;
    });
  };

  const handleBanMap = (mapName: string) => {
    // Prevent banning if auto-ban is in progress
    if (autoBanInProgressRef.current) {
      return;
    }
    // Prevent banning if already banned
    if (bannedMaps.includes(mapName)) {
      return;
    }
    if (banMapRef.current) {
      banMapRef.current(mapName, currentBanTeam);
    }
  };

  // Handle team switching after a ban completes
  useEffect(() => {
    if (pendingTeamSwitchRef.current && bannedMaps.length < 6 && mapBanPhase) {
      pendingTeamSwitchRef.current = false;
      // Clear any running timer before switching teams
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Switch teams for next ban
      setCurrentBanTeam((prevTeam) => {
        return prevTeam === 'alpha' ? 'bravo' : 'alpha';
      });
    }
  }, [bannedMaps.length, mapBanPhase]);

  // Timer effect - resets when team changes or ban phase starts
  useEffect(() => {
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

    // Reset timer to full time when team changes
    setTimeLeft(BAN_TIMEOUT);

    // Start new timer
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

          setBannedMaps((currentBanned) => {
            // Check if we should end ban phase
            if (currentBanned.length >= 6) {
              autoBanInProgressRef.current = false;
              return currentBanned; // Don't ban if already at 6
            }

            const availableMaps = ALL_MAPS.filter(map => !currentBanned.includes(map));
            // Only auto-ban if more than 1 map remains
            if (availableMaps.length > 1 && banMapRef.current) {
              const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];
              // Use captured team value to ban for the correct team
              // Small delay to ensure state updates properly
              setTimeout(() => {
                if (banMapRef.current && autoBanInProgressRef.current) {
                  banMapRef.current(randomMap, teamToBan);
                }
              }, 50);
            } else {
              autoBanInProgressRef.current = false;
            }
            return currentBanned;
          });
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
  }, [currentBanTeam, mapBanPhase]);

  // Navigate to match lobby when map is selected and ban phase ends
  useEffect(() => {
    if (selectedMap && !mapBanPhase && onMapSelected) {
      const timer = setTimeout(() => {
        onMapSelected(selectedMap);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [selectedMap, mapBanPhase, onMapSelected]);

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
  };

  return (
    <div className="map-ban-page">
      <MapBanView
        lobbyId="current-lobby"
        currentUserId={currentUserId}
        mapBanData={mapBanData}
        onBanMap={handleBanMap}
        isTeamLeader={isTeamLeader}
        userTeam={userTeam}
      />
    </div>
  );
}

