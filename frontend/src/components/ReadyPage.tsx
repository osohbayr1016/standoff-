import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Hexagon, CheckCircle2, Clock } from 'lucide-react';
import './ReadyPage.css';
import { useWebSocket } from './WebSocketContext';

interface Player {
  id: string;
  username: string;
  avatar?: string;
  elo: number;
}

interface PartyMember {
  id: string;
  username: string;
  avatar?: string;
  elo?: number;
}

interface ReadyPageProps {
  partyMembers: PartyMember[];
  activeLobbyId?: string;
  selectedMap?: string;
  onMatchStart?: () => void; // Callback when match starts
}

const MAP_IMAGES: Record<string, string> = {
  'Hanami': '/1200px-Hanami_Map.png',
  'Rust': '/1200px-Rust_Map.png',
  'Zone 7': '/1200px-Zone_7_Map.jpg',
  'Dune': '/1200px-Dune_Map.png',
  'Breeze': '/1200px-Breeze_Standoff_2_Map.jpg',
  'Province': '/1200px-Province_Map.jpg',
  'Sandstone': '/1200px-Sandstone_Map.jpg',
  'default': 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop'
};

const getLevelColor = (level: number) => {
  if (level <= 3) return '#9ca3af';
  if (level <= 7) return '#f97316';
  if (level <= 9) return '#ef4444';
  return '#a855f7';
};

export default function ReadyPage({ partyMembers, activeLobbyId, selectedMap: initialSelectedMap, onMatchStart }: ReadyPageProps) {
  const [selectedMap, setSelectedMap] = useState<string>(initialSelectedMap || 'Unknown');
  const [readyPlayers, setReadyPlayers] = useState<string[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const [allReady, setAllReady] = useState<boolean>(false);
  const [serverInfo, setServerInfo] = useState<{ ip?: string; password?: string } | undefined>();
  const [readyPhaseStartTime, setReadyPhaseStartTime] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { lastMessage, sendMessage } = useWebSocket();

  // Get current user ID
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

  // Split into teams
  const teamAlpha = partyMembers.slice(0, 5);
  const teamBravo = partyMembers.slice(5, 10);
  const allPlayers = [...teamAlpha, ...teamBravo];

  // Check if current user is ready
  const isCurrentUserReady = readyPlayers.includes(currentUserId);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'READY_PHASE_STARTED') {
      if (lastMessage.selectedMap) {
        setSelectedMap(lastMessage.selectedMap);
      }
      setReadyPhaseStartTime(Date.now());
      setTimeRemaining(lastMessage.readyPhaseTimeout || 30);
      setReadyPlayers([]);
      setAllReady(false);
    }

    if (lastMessage.type === 'LOBBY_UPDATE') {
      const lobby = lastMessage.lobby;
      if (lobby) {
        if (lobby.mapBanState?.selectedMap) {
          setSelectedMap(lobby.mapBanState.selectedMap);
        }
        if (lobby.readyPhaseState) {
          const readyState = lobby.readyPhaseState;
          if (readyState.phaseActive) {
            setReadyPlayers(readyState.readyPlayers || []);
            
            // Calculate time remaining
            if (readyState.readyPhaseStartTimestamp) {
              const elapsed = (Date.now() - readyState.readyPhaseStartTimestamp) / 1000;
              const remaining = Math.max(0, readyState.readyPhaseTimeout - elapsed);
              setTimeRemaining(Math.floor(remaining));
            }

            // Check if all ready
            const players = lobby.players || [];
            if (readyState.readyPlayers.length >= players.length) {
              setAllReady(true);
            }
          }
        }
        if (lobby.serverInfo) {
          setServerInfo(lobby.serverInfo);
        }
      }
    }

    if (lastMessage.type === 'ALL_PLAYERS_READY') {
      setAllReady(true);
    }

    if (lastMessage.type === 'SERVER_READY') {
      if (lastMessage.serverInfo) {
        setServerInfo(lastMessage.serverInfo);
      }
    }

    if (lastMessage.type === 'MATCH_START') {
      if (lastMessage.serverInfo) {
        setServerInfo(lastMessage.serverInfo);
      }
      // Navigate to match game page when match starts
      if (onMatchStart) {
        onMatchStart();
      }
    }

    if (lastMessage.type === 'MATCH_CANCELLED') {
      // Will be handled by App.tsx to navigate back
    }
  }, [lastMessage]);

  // Countdown timer
  useEffect(() => {
    if (readyPhaseStartTime === null || allReady) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - readyPhaseStartTime) / 1000;
      const remaining = Math.max(0, 30 - elapsed);
      setTimeRemaining(Math.floor(remaining));

      if (remaining <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [readyPhaseStartTime, allReady]);

  const handleReady = () => {
    if (!isCurrentUserReady) {
      sendMessage({
        type: 'PLAYER_READY',
        userId: currentUserId
      });
    }
  };

  const getLevel = (elo: number | undefined) => Math.min(10, Math.max(1, Math.floor((elo || 1000) / 200)));

  const isPlayerReady = (playerId: string) => readyPlayers.includes(playerId);

  const getAvatarUrl = (player: PartyMember) => {
    if (!player.avatar) return null;
    // If already a full URL, return as is
    if (player.avatar.startsWith('http')) {
      return player.avatar;
    }
    // Otherwise construct Discord CDN URL
    return `https://cdn.discordapp.com/avatars/${player.id}/${player.avatar}.png`;
  };

  const bgImage = MAP_IMAGES[selectedMap] || MAP_IMAGES['default'];

  return (
    <div className="ready-page-container">
      <div className="ready-background" style={{ backgroundImage: `url(${bgImage})` }}>
        <div className="backdrop-blur" />
      </div>

      <div className="ready-content">
        <motion.header
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="ready-header"
        >
          <div className="ready-status">
            {allReady ? (
              <span className="all-ready-badge">
                <CheckCircle2 size={16} /> ALL PLAYERS READY
              </span>
            ) : (
              <span className="waiting-badge">
                <Clock size={16} /> WAITING FOR PLAYERS
              </span>
            )}
          </div>
          <h1 className="ready-title">MATCH LOBBY</h1>
          {!allReady && (
            <div className="countdown-timer">
              Match Starting in: {String(Math.floor(timeRemaining / 60)).padStart(2, '0')}:{String(timeRemaining % 60).padStart(2, '0')}
            </div>
          )}
        </motion.header>

        <div className="teams-arena">
          <div className="team-column team-alpha">
            <motion.h2
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="team-title alpha-text"
            >
              TEAM ALPHA
            </motion.h2>
            <div className="player-list">
              {teamAlpha.map((player, i) => (
                <motion.div
                  key={player.id}
                  initial={{ x: -100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className={`player-card ${isPlayerReady(player.id) ? 'ready' : 'not-ready'}`}
                >
                  <div className="level-badge" style={{ borderColor: getLevelColor(getLevel(player.elo)) }}>
                    <Hexagon size={28} fill="#1e293b" stroke={getLevelColor(getLevel(player.elo))} strokeWidth={2} />
                    <span className="level-num">{getLevel(player.elo)}</span>
                  </div>
                  <div className="player-info">
                    <div className="player-name">{player.username}</div>
                    <div className={`player-status ${isPlayerReady(player.id) ? 'ready' : 'waiting'}`}>
                      {isPlayerReady(player.id) ? 'READY' : 'WAITING'}
                    </div>
                  </div>
                  {getAvatarUrl(player) ? (
                    <img src={getAvatarUrl(player)!} alt="avatar" className="player-avatar" />
                  ) : (
                    <div className="player-avatar-placeholder">{player.username[0]}</div>
                  )}
                  {isPlayerReady(player.id) && (
                    <div className="ready-checkmark">
                      <CheckCircle2 size={20} />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          <div className="vs-divider">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="vs-circle"
            >
              VS
            </motion.div>
            <div className="divider-line"></div>
          </div>

          <div className="team-column team-bravo">
            <motion.h2
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="team-title bravo-text"
            >
              TEAM BRAVO
            </motion.h2>
            <div className="player-list right-align">
              {teamBravo.map((player, i) => (
                <motion.div
                  key={player.id}
                  initial={{ x: 100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className={`player-card reverse ${isPlayerReady(player.id) ? 'ready' : 'not-ready'}`}
                >
                  {getAvatarUrl(player) ? (
                    <img src={getAvatarUrl(player)!} alt="avatar" className="player-avatar" />
                  ) : (
                    <div className="player-avatar-placeholder">{player.username[0]}</div>
                  )}
                  <div className="player-info">
                    <div className="player-name">{player.username}</div>
                    <div className={`player-status ${isPlayerReady(player.id) ? 'ready' : 'waiting'}`}>
                      {isPlayerReady(player.id) ? 'READY' : 'WAITING'}
                    </div>
                  </div>
                  <div className="level-badge" style={{ borderColor: getLevelColor(getLevel(player.elo)) }}>
                    <Hexagon size={28} fill="#1e293b" stroke={getLevelColor(getLevel(player.elo))} strokeWidth={2} />
                    <span className="level-num">{getLevel(player.elo)}</span>
                  </div>
                  {isPlayerReady(player.id) && (
                    <div className="ready-checkmark">
                      <CheckCircle2 size={20} />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="ready-control-panel"
        >
          <div className="map-info">
            <div className="map-name-label">SELECTED MAP</div>
            <div className="map-name-value">{selectedMap}</div>
          </div>

          <div className="ready-actions">
            {allReady && serverInfo?.ip && serverInfo?.password ? (
              <div className="match-ready-actions">
                <a 
                  href={serverInfo.matchLink || `standoff://connect/${serverInfo.ip}/${serverInfo.password}`} 
                  className="launch-game-btn"
                >
                  LAUNCH GAME
                </a>
              </div>
            ) : !isCurrentUserReady ? (
              <button className="ready-btn" onClick={handleReady}>
                READY
              </button>
            ) : (
              <div className="waiting-others">
                <div className="spinner"></div>
                <span>Waiting for other players...</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

