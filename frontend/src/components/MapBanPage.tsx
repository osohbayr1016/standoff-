import { useState, useEffect, useRef } from 'react';
import './MapBanPage.css';
import MapBanView from './MapBanView';

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

export default function MapBanPage({ partyMembers, onCancel, onMapSelected }: MapBanPageProps) {
  const [bannedMaps, setBannedMaps] = useState<string[]>([]);
  const [selectedMap, setSelectedMap] = useState<string | undefined>();
  const [currentBanTeam, setCurrentBanTeam] = useState<'alpha' | 'bravo'>('alpha');
  const [banHistory, setBanHistory] = useState<Array<{ team: string; map: string; timestamp: Date }>>([]);
  const [mapBanPhase, setMapBanPhase] = useState(true);
  const [timeLeft, setTimeLeft] = useState(BAN_TIMEOUT);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  const banMapRef = useRef<(mapName: string, team: 'alpha' | 'bravo') => void>();

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

      // Clear timer before switching teams
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // When only 1 map remains (6 maps banned), end ban phase
      if (newBanned.length >= 6) {
        const remainingMap = ALL_MAPS.find(map => !newBanned.includes(map));
        if (remainingMap) {
          // Set the remaining map as selected (last one standing)
          setTimeout(() => {
            setSelectedMap(remainingMap);
            setMapBanPhase(false);
          }, 100);
        }
      } else {
        // Switch teams for next ban (only if more than 1 map remains)
        // Use setTimeout to ensure state update happens after bannedMaps update
        setTimeout(() => {
          setCurrentBanTeam((prevTeam) => {
            return prevTeam === 'alpha' ? 'bravo' : 'alpha';
          });
        }, 150);
      }

      return newBanned;
    });
  };

  const handleBanMap = (mapName: string) => {
    if (banMapRef.current) {
      banMapRef.current(mapName, currentBanTeam);
    }
  };

  useEffect(() => {
    if (!mapBanPhase || bannedMaps.length >= 6) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Reset timer when team changes
    setTimeLeft(BAN_TIMEOUT);

    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Start new timer
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1;
        
        if (newTime <= 0) {
          // Clear timer immediately to prevent multiple executions
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          
          // Time's up - auto ban random map for current team
          // Capture currentBanTeam value before state update
          const teamToBan = currentBanTeam;
          
          setBannedMaps((currentBanned) => {
            if (currentBanned.length >= 6) {
              return currentBanned; // Don't ban if already at 6
            }
            
            const availableMaps = ALL_MAPS.filter(map => !currentBanned.includes(map));
            // Only auto-ban if more than 1 map remains
            if (availableMaps.length > 1 && banMapRef.current) {
              const randomMap = availableMaps[Math.floor(Math.random() * availableMaps.length)];
              // Use captured team value to ban for the correct team
              setTimeout(() => {
                if (banMapRef.current) {
                  banMapRef.current(randomMap, teamToBan);
                }
              }, 100);
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

