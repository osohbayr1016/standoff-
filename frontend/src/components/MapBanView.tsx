import { useState, useEffect } from 'react';
import './MapBanView.css';
import TeamLeaderCard from './TeamLeaderCard';
import MapGrid from './MapGrid';
import MapBanHeader from './MapBanHeader';
import MapBanHistory from './MapBanHistory';

interface MapBanViewProps {
  lobbyId: string;
  currentUserId: string;
  mapBanData: {
    availableMaps: string[];
    bannedMaps: string[];
    selectedMap?: string;
    currentBanTeam?: 'alpha' | 'bravo';
    teamAlphaLeader?: any;
    teamBravoLeader?: any;
    banHistory: Array<{ team: string; map: string; timestamp: Date }>;
    mapBanPhase: boolean;
    timeLeft?: number;
  };
  onBanMap: (mapName: string) => void;
  isTeamLeader: boolean;
  userTeam: 'alpha' | 'bravo' | null;
}

const allMaps = [
  'Hanami',
  'Rust',
  'Zone 7',
  'Dune',
  'Breeze',
  'Province',
  'Sandstone',
];
const mapImages: Record<string, string> = {
  Hanami: '/1200px-Hanami_Map.png',
  Rust: '/1200px-Rust_Map.png',
  'Zone 7': '/1200px-Zone_7_Map.jpg',
  Dune: '/1200px-Dune_Map.png',
  Breeze: '/1200px-Breeze_Standoff_2_Map.jpg',
  Province: '/1200px-Province_Map.jpg',
  Sandstone: '/1200px-Sandstone_Map.jpg',
};

export default function MapBanView({
  mapBanData,
  onBanMap,
  isTeamLeader,
  userTeam,
}: MapBanViewProps) {
  const [isBanning, setIsBanning] = useState<string | null>(null);

  useEffect(() => {
    if (isBanning && mapBanData.bannedMaps.includes(isBanning)) {
      const timer = setTimeout(() => setIsBanning(null), 300);
      return () => clearTimeout(timer);
    }
  }, [mapBanData.bannedMaps, isBanning]);

  const isMyTurn =
    isTeamLeader && mapBanData.currentBanTeam === userTeam;
  const canBan = isMyTurn && mapBanData.mapBanPhase;

  const alphaTeamName = mapBanData.teamAlphaLeader?.name
    ? `Team ${mapBanData.teamAlphaLeader.name}`
    : 'Team Alpha';
  const bravoTeamName = mapBanData.teamBravoLeader?.name
    ? `Team ${mapBanData.teamBravoLeader.name}`
    : 'Team Bravo';
  const currentTeamName =
    mapBanData.currentBanTeam === 'alpha' ? alphaTeamName : bravoTeamName;

  const handleMapClick = (mapName: string) => {
    if (
      canBan &&
      !mapBanData.bannedMaps.includes(mapName) &&
      !isBanning
    ) {
      setIsBanning(mapName);
      onBanMap(mapName);
    }
  };

  return (
    <div className="map-ban-view">
      <MapBanHeader
        mapBanPhase={mapBanData.mapBanPhase}
        currentTeamName={currentTeamName}
        selectedMap={mapBanData.selectedMap}
        timeLeft={mapBanData.timeLeft}
      />

      <div className="team-leaders-grid">
        <TeamLeaderCard
          teamName={alphaTeamName}
          leaderName={mapBanData.teamAlphaLeader?.name}
          isCurrentTurn={mapBanData.currentBanTeam === 'alpha'}
          teamColor="alpha"
        />
        <TeamLeaderCard
          teamName={bravoTeamName}
          leaderName={mapBanData.teamBravoLeader?.name}
          isCurrentTurn={mapBanData.currentBanTeam === 'bravo'}
          teamColor="bravo"
        />
      </div>

      <MapGrid
        allMaps={allMaps}
        bannedMaps={mapBanData.bannedMaps}
        selectedMap={mapBanData.selectedMap}
        isBanning={isBanning}
        canBan={canBan}
        onMapClick={handleMapClick}
        mapImages={mapImages}
      />

      <MapBanHistory
        banHistory={mapBanData.banHistory}
        alphaTeamName={alphaTeamName}
        bravoTeamName={bravoTeamName}
      />

      {isTeamLeader && !isMyTurn && mapBanData.mapBanPhase && (
        <div className="wait-turn-message">
          <p>👑 You are the team leader. Wait for your turn to ban.</p>
        </div>
      )}

      {!isTeamLeader && mapBanData.mapBanPhase && (
        <div className="watch-ban-message">
          <p>
            Only team leaders can ban maps. Watch the ban phase.
          </p>
        </div>
      )}
    </div>
  );
}

