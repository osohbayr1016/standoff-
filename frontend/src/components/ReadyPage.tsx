import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clock, Target, Zap } from 'lucide-react';
import './ReadyPage.css';
import { useWebSocket } from './WebSocketContext';

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
  onMatchStart?: () => void;
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
  if (level <= 3) return '#94a3b8';
  if (level <= 7) return '#f97316';
  if (level <= 9) return '#ef4444';
  return '#a855f7';
};

export default function ReadyPage({ partyMembers, activeLobbyId, selectedMap: initialSelectedMap, onMatchStart }: ReadyPageProps) {
  const [selectedMap, setSelectedMap] = useState<string>(initialSelectedMap || 'Unknown');
  const [readyPlayers, setReadyPlayers] = useState<string[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const [allReady, setAllReady] = useState<boolean>(false);
  const [serverInfo, setServerInfo] = useState<{ ip?: string; password?: string; matchLink?: string } | undefined>();
  const [readyPhaseStartTime, setReadyPhaseStartTime] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { lastMessage, sendMessage } = useWebSocket();

  const currentUserId = (() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        return userData.id || userData.username;
      } catch (e) { return ''; }
    }
    return '';
  })();

  const teamAlpha = partyMembers.slice(0, 5);
  const teamBravo = partyMembers.slice(5, 10);
  const isCurrentUserReady = readyPlayers.includes(currentUserId);

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'READY_PHASE_STARTED') {
      if (lastMessage.selectedMap) setSelectedMap(lastMessage.selectedMap);
      setReadyPhaseStartTime(Date.now());
      setTimeRemaining(lastMessage.readyPhaseTimeout || 30);
      setReadyPlayers([]);
      setAllReady(false);
    }

    if (lastMessage.type === 'LOBBY_UPDATE') {
      const lobby = lastMessage.lobby;
      if (lobby) {
        if (lobby.mapBanState?.selectedMap) setSelectedMap(lobby.mapBanState.selectedMap);
        if (lobby.readyPhaseState && lobby.readyPhaseState.phaseActive) {
          setReadyPlayers(lobby.readyPhaseState.readyPlayers || []);
          if (lobby.readyPhaseState.readyPhaseStartTimestamp) {
            const elapsed = (Date.now() - lobby.readyPhaseState.readyPhaseStartTimestamp) / 1000;
            setTimeRemaining(Math.max(0, Math.floor(lobby.readyPhaseState.readyPhaseTimeout - elapsed)));
            if (readyPhaseStartTime === null) setReadyPhaseStartTime(lobby.readyPhaseState.readyPhaseStartTimestamp);
          }
          if (lobby.readyPhaseState.readyPlayers.length >= (lobby.players?.length || 10)) setAllReady(true);
        }
        if (lobby.serverInfo) setServerInfo(lobby.serverInfo);
      }
    }

    if (lastMessage.type === 'ALL_PLAYERS_READY') setAllReady(true);
    if (lastMessage.type === 'SERVER_READY' && lastMessage.serverInfo) setServerInfo(lastMessage.serverInfo);
    if (lastMessage.type === 'MATCH_START') {
      if (lastMessage.serverInfo) setServerInfo(lastMessage.serverInfo);
      if (onMatchStart) onMatchStart();
    }
  }, [lastMessage]);

  useEffect(() => {
    if (readyPhaseStartTime === null || allReady) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - readyPhaseStartTime) / 1000;
      const remaining = Math.max(0, 30 - elapsed);
      setTimeRemaining(Math.floor(remaining));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [readyPhaseStartTime, allReady]);

  const isPlayerReady = (playerId: string) => readyPlayers.includes(playerId);
  const handleReady = () => {
    if (!isCurrentUserReady) {
      sendMessage({ type: 'PLAYER_READY', userId: currentUserId });
    }
  };

  const bgImage = MAP_IMAGES[selectedMap] || MAP_IMAGES['default'];

  return (
    <div className="ready-page-premium">
      {/* Dynamic Background */}
      <div className="premium-bg-container">
        <motion.div
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 2 }}
          className="premium-bg-image"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
        <div className="premium-overlay" />
        <div className="scanlines" />
      </div>

      <div className="ready-interface">
        {/* Top Bar */}
        <motion.div initial={{ y: -100 }} animate={{ y: 0 }} className="top-status-bar">
          <div className="status-indicator">
            <div className={`status-dot ${allReady ? 'active' : 'pulsing'}`} />
            <span className="status-text">{allReady ? 'SYSTEMS GO' : 'INITIALIZING MATCH...'}</span>
          </div>
          <div className="match-id">MATCH_ID: {activeLobbyId?.slice(0, 8).toUpperCase() || 'SEARCHING...'}</div>
          <div className="timer-display">
            <Clock className="timer-icon" size={18} />
            <span className={timeRemaining < 10 ? 'critical' : ''}>
              {String(Math.floor(timeRemaining / 60)).padStart(2, '0')}:{String(timeRemaining % 60).padStart(2, '0')}
            </span>
          </div>
        </motion.div>

        <div className="main-arena">
          {/* Team Alpha Side */}
          <div className="arena-side alpha">
            <h2 className="team-header alpha">ALPHA FORCE</h2>
            <div className="player-grid">
              {teamAlpha.map((player, i) => (
                <PlayerFrame key={player.id} player={player} index={i} isReady={isPlayerReady(player.id)} side="left" />
              ))}
            </div>
          </div>

          {/* Centerpiece */}
          <div className="arena-center">
            <div className="map-portal">
              <motion.div
                initial={{ rotateY: 90 }}
                animate={{ rotateY: 0 }}
                transition={{ duration: 0.8, type: 'spring' }}
                className="map-frame"
              >
                <img src={bgImage} alt={selectedMap} className="map-view" />
                <div className="map-info-overlay">
                  <Target className="map-icon" size={24} />
                  <div className="map-details">
                    <span className="label">OBJECTIVE LOCATION</span>
                    <span className="value">{selectedMap.toUpperCase()}</span>
                  </div>
                </div>
                {/* HUD Elements */}
                <div className="hud-corners top-left" />
                <div className="hud-corners top-right" />
                <div className="hud-corners bottom-left" />
                <div className="hud-corners bottom-right" />
              </motion.div>

              <div className="central-vs">
                <div className="vs-glow" />
                <span>VS</span>
              </div>

              {/* Ready Button for Current User */}
              <AnimatePresence>
                {!allReady && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    transition={{ type: 'spring', damping: 15 }}
                    className="action-container"
                  >
                    {!isCurrentUserReady ? (
                      <button className="mega-ready-btn" onClick={handleReady}>
                        <Zap size={24} className="bolt" />
                        READY UP
                        <div className="btn-glow" />
                      </button>
                    ) : (
                      <div className="user-ready-status">
                        <CheckCircle2 size={32} className="success-icon" />
                        <span>STAND BY</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {allReady && serverInfo?.ip && (
                <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="launch-container">
                  <a href={serverInfo.matchLink || `standoff://connect/${serverInfo.ip}/${serverInfo.password}`} className="launch-btn">
                    ENGAGE MATCH
                  </a>
                </motion.div>
              )}
            </div>
          </div>

          {/* Team Bravo Side */}
          <div className="arena-side bravo">
            <h2 className="team-header bravo">BRAVO SQUAD</h2>
            <div className="player-grid">
              {teamBravo.map((player, i) => (
                <PlayerFrame key={player.id} player={player} index={i} isReady={isPlayerReady(player.id)} side="right" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerFrame({ player, index, isReady, side }: { player: PartyMember, index: number, isReady: boolean, side: 'left' | 'right' }) {
  const level = Math.min(10, Math.max(1, Math.floor((player.elo || 1000) / 200)));
  const color = getLevelColor(level);
  const avatarUrl = player.avatar ? (player.avatar.startsWith('http') ? player.avatar : `https://cdn.discordapp.com/avatars/${player.id}/${player.avatar}.png`) : null;

  return (
    <motion.div
      initial={{ x: side === 'left' ? -100 : 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: index * 0.1 }}
      className={`premium-player-card ${isReady ? 'is-ready' : ''} ${side}`}
    >
      <div className="card-inner">
        <div className="avatar-wrapper" style={{ boxShadow: `0 0 15px ${isReady ? '#22c55e' : 'transparent'}` }}>
          {avatarUrl ? <img src={avatarUrl} alt="" className="avatar-img" /> : <div className="avatar-placeholder">{player.username[0]}</div>}
          <div className="status-ring" />
        </div>

        <div className="player-details">
          <div className="name-row">
            <span className="username">{player.username}</span>
            {isReady && <CheckCircle2 className="ready-icon" size={14} />}
          </div>
          <div className="rank-row">
            <div className="level-box" style={{ background: color }}>LVL {level}</div>
            <span className="elo-text">{player.elo || 1000} MMR</span>
          </div>
        </div>

        <div className="ready-indicator-bar" />
      </div>
    </motion.div>
  );
}
