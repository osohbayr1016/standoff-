import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Crosshair, Copy, Shield, Target, CheckCircle2 } from 'lucide-react';
import { useWebSocket } from './WebSocketContext';
import './MatchLobbyPage.css';

interface Player {
  id: string;
  username: string;
  avatar?: string;
  elo: number;
}

interface MatchLobbyPageProps {
  lobby: any;
  serverInfo?: any;
}

const MAP_IMAGES: Record<string, string> = {
  'Sandstone': 'https://raw.githubusercontent.com/osohbayr1016/standoff-/main/frontend/public/maps/sandstone.jpg',
  'Rust': 'https://raw.githubusercontent.com/osohbayr1016/standoff-/main/frontend/public/maps/rust.jpg',
  'Province': 'https://raw.githubusercontent.com/osohbayr1016/standoff-/main/frontend/public/maps/province.jpg',
  'Hanami': 'https://raw.githubusercontent.com/osohbayr1016/standoff-/main/frontend/public/maps/hanami.jpg',
  'Zone 7': 'https://raw.githubusercontent.com/osohbayr1016/standoff-/main/frontend/public/maps/zone7.jpg',
  'Dune': 'https://raw.githubusercontent.com/osohbayr1016/standoff-/main/frontend/public/maps/dune.jpg',
  'Breeze': 'https://raw.githubusercontent.com/osohbayr1016/standoff-/main/frontend/public/maps/breeze.jpg',
  'default': 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop'
};

const getLevelColor = (level: number) => {
  if (level <= 3) return '#94a3b8'; // Silver/Grey
  if (level <= 7) return '#f59e0b'; // Gold/Orange
  if (level <= 9) return '#ef4444'; // Red
  return '#10b981'; // Green (Level 10)
};

export default function MatchLobbyPage({ lobby, serverInfo: initialServerInfo }: MatchLobbyPageProps) {
  const [serverInfo, setServerInfo] = useState(initialServerInfo || lobby?.serverInfo);
  const isLive = !!(serverInfo?.ip && serverInfo?.password);
  const { leaveMatch } = useWebSocket();

  const teamA = lobby?.teamA || [];
  const teamB = lobby?.teamB || [];
  const selectedMap = lobby?.mapBanState?.selectedMap || 'Unknown';
  const bgImage = MAP_IMAGES[selectedMap] || MAP_IMAGES['default'];

  useEffect(() => {
    if (lobby?.serverInfo) {
      setServerInfo(lobby.serverInfo);
    }
  }, [lobby?.serverInfo]);

  const getLevel = (elo: number) => Math.min(10, Math.max(1, Math.floor(elo / 200)));

  const getAvatarUrl = (player: Player) => {
    if (!player.avatar) return null;
    if (player.avatar.startsWith('http')) return player.avatar;
    return `https://cdn.discordapp.com/avatars/${player.id}/${player.avatar}.png`;
  };

  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveMatch = () => {
    if (confirm('Are you sure you want to leave this match? You can requeue immediately after leaving.')) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.id) {
        leaveMatch(user.id, lobby?.id);
      }
    }
  };

  return (
    <div className="match-lobby-container">
      {/* Cinematic Overlays */}
      <div className="scanline" />
      <div className="vignette" />
      <div className="hud-corner top-left" />
      <div className="hud-corner top-right" />
      <div className="hud-corner bottom-left" />
      <div className="hud-corner bottom-right" />

      {/* Cinematic Background */}
      <motion.div
        className="lobby-background"
        style={{ backgroundImage: `url(${bgImage})` }}
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.5 }}
      >
        <div className="backdrop-blur" />
      </motion.div>

      <div className="lobby-content">
        {/* Header */}
        <motion.header
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="lobby-header"
        >
          <div className="live-badge">
            <div className="pulse-dot"></div>
            <span>LIVE MATCH ENGINE</span>
          </div>
          <h1 className="lobby-title">LOBBY ID: {lobby?.id?.slice(0, 8).toUpperCase() || 'READY'}</h1>
        </motion.header>

        <div className="teams-arena">
          {/* TEAM ALPHA */}
          <div className="team-column team-alpha animate-slide-left">
            <div className="team-header-info">
              <div className="team-label">COMBATANT SIDE</div>
              <div className="team-name-row">
                <Shield className="alpha-text" size={32} />
                <h2 className="team-title alpha-text">TEAM ALPHA</h2>
              </div>
            </div>

            <div className="player-list">
              {teamA.map((player: Player, i: number) => (
                <motion.div
                  key={player.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="player-card"
                >
                  <div className="player-avatar-wrapper">
                    {getAvatarUrl(player) ? (
                      <img src={getAvatarUrl(player)!} alt="avatar" className="player-avatar" />
                    ) : (
                      <div className="player-avatar-placeholder">{(player.username || '?')[0]}</div>
                    )}
                  </div>
                  <div className="player-info">
                    <div className="player-name">{player.username}</div>
                    <div className="player-stat-row">
                      <span>LEVEL {getLevel(player.elo || 1000)}</span>
                      <span style={{ color: getLevelColor(getLevel(player.elo || 1000)) }}>●</span>
                      <span>ELO {player.elo || 1000}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* CENTER DIVIDER (MAP & HUD) */}
          <div className="vs-divider">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="map-portal-container"
            >
              <img src={bgImage} alt="map" className="map-portal-image" />
              <div className="map-overlay">
                <div className="map-name-value">{selectedMap}</div>
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="match-control-panel-desktop"
            >
              <div className="server-details">
                {isLive ? (
                  <>
                    <div className="detail-card">
                      <span className="detail-label">SERVER GATEWAY</span>
                      <div className="detail-value">{serverInfo.ip}</div>
                    </div>
                    <div className="detail-card">
                      <span className="detail-label">SECURE PASSWORD</span>
                      <div className="detail-value">{serverInfo.password}</div>
                    </div>
                    <div className="match-actions">
                      <a
                        href={serverInfo.matchLink || `standoff://connect/${serverInfo.ip}/${serverInfo.password}`}
                        className="play-btn"
                      >
                        <Crosshair size={20} /> LAUNCH STANDOFF 2
                      </a>
                      <button className="copy-btn" onClick={() => handleCopy(`connect ${serverInfo.ip}; password ${serverInfo.password}`)}>
                        {copied ? <CheckCircle2 size={16} color="#22c55e" /> : <Copy size={16} />}
                        {copied ? 'COPIED!' : 'COPY COMMAND'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="detail-card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      style={{ marginBottom: '1rem', display: 'inline-block' }}
                    >
                      <Target size={40} className="alpha-text" />
                    </motion.div>
                    <div className="detail-label">ALLOCATING RESOURCES</div>
                    <div className="detail-value" style={{ color: 'white', fontSize: '0.9rem' }}>
                      PLEASE STAND BY...
                    </div>
                  </div>
                )}

                {/* Leave Match Button */}
                <button
                  className="copy-btn"
                  style={{
                    background: '#ef4444',
                    borderColor: '#ef4444',
                    marginTop: '1rem',
                    width: '100%'
                  }}
                  onClick={handleLeaveMatch}
                >
                  LEAVE MATCH
                </button>
              </div >
            </motion.div >
          </div >

          {/* TEAM BRAVO */}
          < div className="team-column team-bravo animate-slide-right" >
            <div className="team-header-info">
              <div className="team-label">HOSTILE SIDE</div>
              <div className="team-name-row">
                <Target className="bravo-text" size={32} />
                <h2 className="team-title bravo-text">TEAM BRAVO</h2>
              </div>
            </div>

            <div className="player-list">
              {teamB.map((player: Player, i: number) => (
                <motion.div
                  key={player.id}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="player-card"
                >
                  <div className="player-avatar-wrapper">
                    {getAvatarUrl(player) ? (
                      <img src={getAvatarUrl(player)!} alt="avatar" className="player-avatar" />
                    ) : (
                      <div className="player-avatar-placeholder">{(player.username || '?')[0]}</div>
                    )}
                  </div>
                  <div className="player-info">
                    <div className="player-name">{player.username}</div>
                    <div className="player-stat-row">
                      <span>LEVEL {getLevel(player.elo || 1000)}</span>
                      <span style={{ color: getLevelColor(getLevel(player.elo || 1000)) }}>●</span>
                      <span>ELO {player.elo || 1000}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div >
        </div >
      </div >
    </div >
  );
}
