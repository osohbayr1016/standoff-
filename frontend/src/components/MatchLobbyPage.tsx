import { useState, useEffect, useCallback } from 'react';
import './MatchLobbyPage.css';
import { useWebSocket } from './WebSocketContext'; // Import Hook

interface PartyMember {
  id: string;
  username: string;
  avatar?: string;
  mmr?: number;
}

interface MatchLobbyPageProps {
  partyMembers: PartyMember[];
  selectedMap?: string;
  onCancel: () => void;
}

const mapImages: Record<string, string> = {
  Hanami: '/1200px-Hanami_Map.png',
  Rust: '/1200px-Rust_Map.png',
  'Zone 7': '/1200px-Zone_7_Map.jpg',
  Dune: '/1200px-Dune_Map.png',
  Breeze: '/1200px-Breeze_Standoff_2_Map.jpg',
  Province: '/1200px-Province_Map.jpg',
  Sandstone: '/1200px-Sandstone_Map.jpg',
};

export default function MatchLobbyPage({ partyMembers, selectedMap, onCancel: _onCancel }: MatchLobbyPageProps) {
  const [countdown, setCountdown] = useState(5);
  const [allReady, setAllReady] = useState(false);
  const [readyPlayers, setReadyPlayers] = useState<Set<string>>(new Set());
  const [countdownStarted, setCountdownStarted] = useState(false);

  const { sendMessage, lastMessage } = useWebSocket(); // Hook

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

  const [readyPhaseTimeLeft, setReadyPhaseTimeLeft] = useState(60);

  // Listen for LOBBY_UPDATE from server
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'LOBBY_UPDATE') {
      const lobby = lastMessage.lobby;
      
      // Sync ready players from readyPhaseState
      if (lobby && lobby.readyPhaseState) {
        const readyState = lobby.readyPhaseState;
        setReadyPlayers(new Set(readyState.readyPlayers || []));
        
        // Calculate ready phase timer
        if (readyState.phaseActive && readyState.readyPhaseStartTimestamp) {
          const elapsed = Date.now() - readyState.readyPhaseStartTimestamp;
          const remaining = Math.max(0, readyState.readyPhaseTimeout - Math.floor(elapsed / 1000));
          setReadyPhaseTimeLeft(remaining);
        }
      } else if (lobby && lobby.readyPlayers) {
        // Fallback to old format
        setReadyPlayers(new Set(lobby.readyPlayers));
      }
    }
    
    // Handle MATCH_CANCELLED
    if (lastMessage && lastMessage.type === 'MATCH_CANCELLED') {
      alert('Match cancelled: ' + (lastMessage.reason || 'Not all players ready in time'));
      // Navigate back will be handled by parent component
      if (onCancel) {
        onCancel();
      }
    }
  }, [lastMessage, onCancel]);

  // Auto-ready bots after a short delay - send to server
  useEffect(() => {
    const botReadyTimer = setTimeout(() => {
      partyMembers.forEach((player) => {
        // Auto-ready bots (players whose ID starts with 'bot-')
        if (player.id && player.id.startsWith('bot-')) {
          sendMessage({ type: 'PLAYER_READY', userId: player.id });
        }
      });
    }, 1000);
    return () => clearTimeout(botReadyTimer);
  }, [partyMembers, sendMessage]);

  const handleLaunchGame = useCallback(() => {
    // TODO: Implement launch game logic - could connect to Discord or open game client
    console.log('Launching game...');
    alert('Match Started! This is where you would launch the game.');
  }, []);

  // Check if all players are ready and start countdown
  useEffect(() => {
    if (readyPlayers.size === 10 && !countdownStarted) {
      setAllReady(true);
      setCountdownStarted(true);
      setCountdown(5);
    }
  }, [readyPlayers, countdownStarted]);

  // Countdown timer
  useEffect(() => {
    if (!countdownStarted) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleLaunchGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdownStarted, handleLaunchGame]);

  const handleReadyClick = (playerId: string) => {
    // Send ready status to server
    sendMessage({ type: 'PLAYER_READY', userId: playerId });
    // Don't update local state - wait for server confirmation via LOBBY_UPDATE
  };
  
  // Ready phase timer countdown
  useEffect(() => {
    if (readyPhaseTimeLeft > 0) {
      const timer = setInterval(() => {
        setReadyPhaseTimeLeft((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [readyPhaseTimeLeft]);

  // Split players into two teams of 5
  const teamAlpha = partyMembers.slice(0, 5);
  const teamBravo = partyMembers.slice(5, 10);

  // Helper to construct avatar URL (same logic as MatchmakingPage)
  const getAvatarUrl = (player: PartyMember) => {
    if (player.avatar) {
      if (player.avatar.startsWith('http')) return player.avatar;
      if (!player.id.startsWith('bot-')) {
        return `https://cdn.discordapp.com/avatars/${player.id}/${player.avatar}.png`;
      }
    }
    return null;
  };

  const renderPlayer = (player: PartyMember) => {
    const playerId = player.id || player.username;
    const isPlayerReady = readyPlayers.has(playerId);
    const isCurrentUser = playerId === currentUserId;
    const isBot = playerId.startsWith('bot-');
    const avatarUrl = getAvatarUrl(player);

    return (
      <div key={playerId} className="lobby-player">
        <div className="lobby-player-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={player.username} />
          ) : (
            <div className="lobby-player-avatar-placeholder">
              {isBot ? 'B' : player.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="lobby-player-info">
          <div className="lobby-player-name">{player.username}</div>
          <div className="lobby-player-rating">{player.mmr || 1000} MMR</div>
        </div>
        <div className="lobby-player-ready">
          {isPlayerReady ? (
            <>
              <button className="ready-btn" disabled>READY</button>
              <span className="ready-checkmark">✓</span>
            </>
          ) : isCurrentUser ? (
            <button className="ready-btn clickable" onClick={() => handleReadyClick(playerId)}>
              READY
            </button>
          ) : (
            <button className="ready-btn" disabled>READY</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="match-lobby-page">
      <div className="cyber-grid-bg"></div>
      <h1 className="lobby-title">Match Lobby</h1>

      {selectedMap && (
        <div className="selected-map-display">
          {mapImages[selectedMap] && (
            <div 
              className="selected-map-image"
              style={{
                backgroundImage: `url(${mapImages[selectedMap]})`
              }}
            />
          )}
          <div className="selected-map-text">
            <span className="selected-map-label">Selected Map:</span>
            <span className="selected-map-name">{selectedMap}</span>
          </div>
        </div>
      )}

      <div className="lobby-teams">
        <div className="lobby-team team-alpha">
          <div className="team-header">Team Alpha</div>
          <div className="team-players">
            {teamAlpha.map((player) => renderPlayer(player))}
          </div>
        </div>

        <div className="lobby-team team-bravo">
          <div className="team-header">Team Bravo</div>
          <div className="team-players">
            {teamBravo.map((player) => renderPlayer(player))}
          </div>
        </div>
      </div>

      {allReady ? (
        <div className="lobby-status">
          <div className="match-starting">
            Match Starting in: <span className="countdown-time">00:{String(countdown).padStart(2, '0')}</span>
          </div>
          <div className="all-ready-message">All players are ready!</div>
        </div>
      ) : (
        <div className="lobby-status">
          <div className="waiting-message">
            Waiting for players to be ready... ({readyPlayers.size}/10)
          </div>
          {readyPhaseTimeLeft > 0 && (
            <div className="ready-phase-timer">
              Time remaining: <span className="timer-value">{String(Math.floor(readyPhaseTimeLeft / 60)).padStart(2, '0')}:{String(readyPhaseTimeLeft % 60).padStart(2, '0')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
