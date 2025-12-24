import { useState, useEffect } from 'react';
import './MatchmakingPage.css';

interface PartyMember {
  id: string;
  username: string;
  avatar?: string;
}

interface MatchmakingPageProps {
  onCancel: () => void;
  onStartLobby?: (partyMembers: PartyMember[]) => void;
}

export default function MatchmakingPage({ onCancel, onStartLobby }: MatchmakingPageProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [timer, setTimer] = useState(0);
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([]);
  const estimatedTime = '01:30';

  useEffect(() => {
    // Load current user into party
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setPartyMembers([userData]);
      } catch (e) {
        // Invalid data
      }
    }
  }, []);

  useEffect(() => {
    if (!isSearching) return;

    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isSearching]);

  useEffect(() => {
    // Navigate to lobby when party reaches 10 players
    if (partyMembers.length === 10 && onStartLobby) {
      onStartLobby(partyMembers);
    }
  }, [partyMembers, onStartLobby]);

  const handleFindMatch = () => {
    setIsSearching(true);
    setTimer(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleCancel = () => {
    setIsSearching(false);
    setTimer(0);
  };

  const handleInviteFriend = (slotIndex: number) => {
    // TODO: Implement friend invitation logic
    console.log('Invite friend to slot', slotIndex);
    // This could open a friend selection modal or trigger an invite system
  };

  const handleFillBots = () => {
    const botNames = [
      'BotAlpha', 'BotBeta', 'BotGamma', 'BotDelta', 'BotEpsilon',
      'BotZeta', 'BotEta', 'BotTheta', 'BotIota'
    ];
    
    // Get current user from party or localStorage
    let currentUser = partyMembers.find(m => m.id && !m.id.startsWith('bot-'));
    if (!currentUser) {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          currentUser = JSON.parse(savedUser);
        } catch (e) {
          // Invalid data
        }
      }
    }
    
    // Generate exactly 9 bots to fill to 10 total
    const botsNeeded = currentUser ? 9 : 10;
    const bots: PartyMember[] = botNames.slice(0, botsNeeded).map((name, index) => ({
      id: `bot-${index + 1}`,
      username: name,
    }));
    
    // Set party with user first (if exists), then bots (exactly 10 total)
    const filledParty = currentUser ? [currentUser, ...bots] : bots;
    setPartyMembers(filledParty);
    
    // Auto-start matchmaking when filled
    setTimeout(() => {
      setIsSearching(true);
      setTimer(0);
    }, 500);
  };

  const renderPartySlot = (index: number) => {
    // Only show first 5 slots in UI, but party can have up to 10 members
    const member = index < 5 ? partyMembers[index] : undefined;
    
    if (member) {
      return (
        <div key={index} className="party-slot filled">
          <div className="party-slot-avatar">
            {member.avatar ? (
              <img src={member.avatar} alt={member.username} />
            ) : (
              <div className="party-slot-avatar-placeholder">
                {member.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="party-slot-info">
            <div className="party-slot-username">{member.username}</div>
          </div>
        </div>
      );
    }

    return (
      <div key={index} className="party-slot empty" onClick={() => handleInviteFriend(index)}>
        <div className="party-slot-add-icon">+</div>
      </div>
    );
  };

  return (
    <div className="matchmaking-page">
      <div className="matchmaking-content">
        {!isSearching ? (
          <>
            <h1 className="matchmaking-title">Find Match</h1>
          </>
        ) : (
          <>
            <h1 className="matchmaking-title">Searching for Match...</h1>

            <div className="radar-container">
          <div className="radar-circle">
            <div className="radar-grid">
              <div className="radar-line horizontal"></div>
              <div className="radar-line vertical"></div>
              <div className="radar-line diagonal1"></div>
              <div className="radar-line diagonal2"></div>
              <div className="radar-rings">
                <div className="ring ring-1"></div>
                <div className="ring ring-2"></div>
                <div className="ring ring-3"></div>
              </div>
              <div className="radar-scanner"></div>
              <div className="radar-dots">
                <div className="dot dot-1"></div>
                <div className="dot dot-2"></div>
                <div className="dot dot-3"></div>
                <div className="dot dot-4"></div>
              </div>
            </div>
          </div>
          
          <div className="map-icon">
            <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
              <path d="M5 15L18 8L32 15L45 8V35L32 42L18 35L5 42V15Z" 
                    stroke="#ff6b35" strokeWidth="3" fill="rgba(255, 107, 53, 0.2)"/>
              <line x1="18" y1="8" x2="18" y2="35" stroke="#ff6b35" strokeWidth="2"/>
              <line x1="32" y1="15" x2="32" y2="42" stroke="#ff6b35" strokeWidth="2"/>
            </svg>
          </div>
        </div>

            <div className="timer-section">
              <div className="timer-display">{formatTime(timer)}</div>
              <div className="player-count">
                {partyMembers.length}/10
              </div>
            </div>

            <button className="cancel-button" onClick={handleCancel}>
              Cancel Matchmaking
            </button>
          </>
        )}
      </div>

      <div className="party-slots">
        <div className="party-slots-top-row">
          {[0, 1, 2].map((index) => renderPartySlot(index))}
        </div>
        <div className="party-slots-bottom-row">
          {[3, 4].map((index) => renderPartySlot(index))}
        </div>
      </div>

      {!isSearching && (
        <div className="matchmaking-actions">
          <button className="fill-bots-btn" onClick={handleFillBots}>
            Fill Bots
          </button>
          <button className="find-match-btn-large" onClick={handleFindMatch}>
            Find Match
          </button>
        </div>
      )}
    </div>
  );
}

