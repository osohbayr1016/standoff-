import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Hexagon, Crosshair, Copy } from 'lucide-react';
import './MatchLobbyPage.css';

interface Player {
  id: string;
  username: string;
  avatar?: string;
  elo: number; // 0-3000?
  // level will be calculated from ELO
}

interface MatchLobbyPageProps {
  lobby: any; // The full lobby object
  onMatchStart?: (matchData: any) => void; // Parent handler to switch page
  serverInfo?: any; // If already present
}

const MAP_IMAGES: Record<string, string> = {
  'Sandstone': 'https://raw.githubusercontent.com/osohbayr1016/standoff-/main/frontend/public/maps/sandstone.jpg',
  'Rust': 'https://raw.githubusercontent.com/osohbayr1016/standoff-/main/frontend/public/maps/rust.jpg',
  'Province': 'https://raw.githubusercontent.com/osohbayr1016/standoff-/main/frontend/public/maps/province.jpg',
  'Zone 9': 'https://raw.githubusercontent.com/osohbayr1016/standoff-/main/frontend/public/maps/zone9.jpg',
  // Fallbacks
  'default': 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop'
};

const getLevelColor = (level: number) => {
  if (level <= 3) return '#9ca3af'; // Grey
  if (level <= 7) return '#f97316'; // Orange
  if (level <= 9) return '#ef4444'; // Red
  return '#a855f7'; // Purple
};

export default function MatchLobbyPage({ lobby, serverInfo: initialServerInfo }: MatchLobbyPageProps) {
  const [matchState, setMatchState] = useState<'LOBBY' | 'Readey' | 'LIVE'>('LOBBY');
  const [serverInfo, setServerInfo] = useState(initialServerInfo || lobby?.serverInfo);
  const isLive = !!(serverInfo?.ip && serverInfo?.password);

  const teamA = lobby?.teamA || [];
  const teamB = lobby?.teamB || [];
  const selectedMap = lobby?.mapBanState?.selectedMap || 'Unknown';
  const bgImage = MAP_IMAGES[selectedMap] || MAP_IMAGES['default'];

  useEffect(() => {
    if (isLive) {
      setMatchState('LIVE');
    }
  }, [isLive]);

  // Update serverInfo from lobby if it changes
  useEffect(() => {
    if (lobby?.serverInfo) {
      setServerInfo(lobby.serverInfo);
    }
  }, [lobby?.serverInfo]);

  // Calculate level (mock 1-10 based on ELO)
  const getLevel = (elo: number) => Math.min(10, Math.max(1, Math.floor(elo / 200)));

  // Get Discord avatar URL
  const getAvatarUrl = (player: Player) => {
    if (!player.avatar) return null;
    // If already a full URL, return as is
    if (player.avatar.startsWith('http')) return player.avatar;
    // Otherwise, format as Discord CDN URL
    return `https://cdn.discordapp.com/avatars/${player.id}/${player.avatar}.png`;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    // Toast logic here
  };

  return (
    <div className="match-lobby-container">
      {/* Background Layer */}
      <div className="lobby-background" style={{ backgroundImage: `url(${bgImage})` }}>
        <div className="backdrop-blur" />
      </div>

      <div className="lobby-content">
        {/* Header */}
        <motion.header
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="lobby-header"
        >
          <div className="match-status">
            {matchState === 'LIVE' ? (
              <span className="live-badge"><div className="pulse-dot"></div> MATCH LIVE</span>
            ) : (
              <span className="preparing-badge">PREPARING SERVER...</span>
            )}
          </div>
          <h1 className="lobby-title">MATCH ROOM #{lobby?.id?.slice(0, 4) || '0000'}</h1>
        </motion.header>

        <div className="teams-arena">
          {/* TEAM ALPHA */}
          <div className="team-column team-alpha">
            <motion.h2
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="team-title alpha-text"
            >
              TEAM ALPHA
            </motion.h2>
            <div className="player-list">
              {teamA.map((player: Player, i: number) => (
                <motion.div
                  key={player.id}
                  initial={{ x: -100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="player-card"
                >
                  <div className="level-badge" style={{ borderColor: getLevelColor(getLevel(player.elo)) }}>
                    <Hexagon size={28} fill="#1e293b" stroke={getLevelColor(getLevel(player.elo))} strokeWidth={2} />
                    <span className="level-num">{getLevel(player.elo)}</span>
                  </div>
                  <div className="player-info">

                    <div className="player-name">{player.username}</div>
                    <div className="player-status ready">READY</div>
                  </div>
                  {getAvatarUrl(player) ? (
                    <img src={getAvatarUrl(player)!} alt="avatar" className="player-avatar" />
                  ) : (
                    <div className="player-avatar-placeholder">{player.username[0]}</div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* CENTER DIVIDER / CONTROL PANEL */}
          <div className="vs-divider">
            {/* VS Circle at top */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="vs-circle"
            >
              VS
            </motion.div>
            {/* Desktop: Show control panel in center */}
            <div className="match-control-panel-desktop">
              <div className="map-info">
                <div className="map-name-label">CURRENT MAP</div>
                <div className="map-name-value">{selectedMap}</div>
              </div>

              <div className="server-actions">
                {isLive && serverInfo?.ip && serverInfo?.password ? (
                  <div className="live-actions">
                    <div className="button-group">
                      <a 
                        href={serverInfo.matchLink || `standoff://connect/${serverInfo.ip}/${serverInfo.password}`} 
                        className="play-btn"
                      >
                        <Crosshair className="icon" /> JOIN MATCH
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="waiting-state">
                    <div className="spinner"></div>
                    <span>ALLOCATING GAME SERVER...</span>
                  </div>
                )}
              </div>
            </div>
            {/* Mobile: Show divider line */}
            <div className="divider-line"></div>
          </div>

          {/* TEAM BRAVO */}
          <div className="team-column team-bravo">
            <motion.h2
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="team-title bravo-text"
            >
              TEAM BRAVO
            </motion.h2>
            <div className="player-list right-align">
              {teamB.map((player: Player, i: number) => (
                <motion.div
                  key={player.id}
                  initial={{ x: 100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="player-card reverse"
                >
                  {getAvatarUrl(player) ? (
                    <img src={getAvatarUrl(player)!} alt="avatar" className="player-avatar" />
                  ) : (
                    <div className="player-avatar-placeholder">{player.username[0]}</div>
                  )}
                  <div className="player-info">
                    <div className="player-name">{player.username}</div>
                    <div className="player-status ready">READY</div>
                  </div>
                  <div className="level-badge" style={{ borderColor: getLevelColor(getLevel(player.elo)) }}>
                    <Hexagon size={28} fill="#1e293b" stroke={getLevelColor(getLevel(player.elo))} strokeWidth={2} />
                    <span className="level-num">{getLevel(player.elo)}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* SERVER / MAP INFO CARD - Mobile Only */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="match-control-panel-mobile"
        >
          <div className="map-info">
            <div className="map-name-label">CURRENT MAP</div>
            <div className="map-name-value">{selectedMap}</div>
          </div>

          <div className="server-actions">
            {isLive && serverInfo?.ip && serverInfo?.password ? (
              <div className="live-actions">
                <div className="button-group">
                  <a 
                    href={serverInfo.matchLink || `standoff://connect/${serverInfo.ip}/${serverInfo.password}`} 
                    className="play-btn"
                  >
                    <Crosshair className="icon" /> JOIN MATCH
                  </a>
                </div>
              </div>
            ) : (
              <div className="waiting-state">
                <div className="spinner"></div>
                <span>ALLOCATING GAME SERVER...</span>
              </div>
            )}
          </div>
        </motion.div>
      </div >
    </div >
  );
}
