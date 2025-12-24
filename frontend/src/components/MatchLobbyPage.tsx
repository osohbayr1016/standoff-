import { useState, useEffect, useCallback } from 'react';
import './MatchLobbyPage.css';

interface PartyMember {
  id: string;
  username: string;
  avatar?: string;
}

interface MatchLobbyPageProps {
  partyMembers: PartyMember[];
  selectedMap?: string;
  onCancel: () => void;
}

export default function MatchLobbyPage({ partyMembers, selectedMap, onCancel }: MatchLobbyPageProps) {
  const [countdown, setCountdown] = useState(5);
  const [allReady, setAllReady] = useState(false);
  const [readyPlayers, setReadyPlayers] = useState<Set<string>>(new Set());
  const [countdownStarted, setCountdownStarted] = useState(false);

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

  // Auto-ready bots after a short delay
  useEffect(() => {
    const botReadyTimer = setTimeout(() => {
      setReadyPlayers((prev) => {
        const newReady = new Set(prev);
        partyMembers.forEach((player) => {
          // Auto-ready bots (players whose ID starts with 'bot-')
          if (player.id && player.id.startsWith('bot-')) {
            newReady.add(player.id);
          }
        });
        return newReady;
      });
    }, 1000);
    return () => clearTimeout(botReadyTimer);
  }, [partyMembers]);

  const handleLaunchGame = useCallback(() => {
    // TODO: Implement launch game logic
    console.log('Launching game...');
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
    setReadyPlayers((prev) => {
      const newReady = new Set(prev);
      newReady.add(playerId);
      return newReady;
    });
  };

  // Split players into two teams of 5
  const teamAlpha = partyMembers.slice(0, 5);
  const teamBravo = partyMembers.slice(5, 10);


  const generateRating = (playerId: string) => {
    // Generate stable rating based on player ID
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
      hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const whole = Math.abs(hash % 20) + 10;
    const decimal = Math.abs(hash % 100);
    return `${whole}.${String(decimal).padStart(2, '0')}`;
  };

  const renderPlayer = (player: PartyMember) => {
    const rating = generateRating(player.id || player.username);
    const playerId = player.id || player.username;
    const isPlayerReady = readyPlayers.has(playerId);
    const isCurrentUser = playerId === currentUserId;
    const isBot = playerId.startsWith('bot-');

    return (
      <div key={playerId} className="lobby-player">
        <div className="lobby-player-avatar">
          {player.avatar ? (
            <img src={player.avatar} alt={player.username} />
          ) : (
            <div className="lobby-player-avatar-placeholder">
              {isBot ? 'B' : player.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="lobby-player-info">
          <div className="lobby-player-name">{player.username}</div>
          <div className="lobby-player-rating">Delo {rating}</div>
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
      <h1 className="lobby-title">Match Lobby</h1>
      
      {selectedMap && (
        <div className="selected-map-display">
          <span className="selected-map-label">Selected Map:</span>
          <span className="selected-map-name">{selectedMap}</span>
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
          <div className="waiting-message">Waiting for players to be ready...</div>
        </div>
      )}
    </div>
  );
}

