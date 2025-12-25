import { useState, useEffect } from "react";
import "./MatchmakingPage.css";
import InviteFriendModal from "./InviteFriendModal";
import { useWebSocket } from "./WebSocketContext"; // Import Hook
import DebugConsole from "./DebugConsole";

interface PartyMember {
  id: string;
  username: string;
  avatar?: string;
  elo?: number;
}

interface MatchmakingPageProps {
  onCancel: () => void;
  onStartLobby?: (partyMembers: PartyMember[]) => void;
  activeLobbyId?: string; // Add prop to check if user is in a lobby
}

<<<<<<< HEAD
export default function MatchmakingPage({
  onCancel: _onCancel,
  onStartLobby,
}: MatchmakingPageProps) {
=======
export default function MatchmakingPage({ onCancel: _onCancel, onStartLobby, activeLobbyId }: MatchmakingPageProps) {
>>>>>>> b37cefacd5935a9f26aa22491f4429ab5b1ef73e
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const { sendMessage, lastMessage } = useWebSocket(); // Use Real WS

  useEffect(() => {
    // Load current user into party
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setPartyMembers([userData]);
      } catch (e) {
        // Invalid data
      }
    }
    
    // Reset queue state when component mounts - user must explicitly join
    // This prevents automatic queue joining when visiting the page
    setIsInQueue(false);
    
    // If user was in queue from elsewhere (Discord bot, previous session), leave it
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.id) {
      sendMessage({ type: 'LEAVE_QUEUE', userId: user.id });
    }
  }, [sendMessage]);

  // Listen for WS Updates
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === "QUEUE_UPDATE") {
      // Logic for queue updates (count)
      if (lastMessage.players && Array.isArray(lastMessage.players)) {
        // Map NeatQueue players to our UI format
<<<<<<< HEAD
        const externalPlayers: PartyMember[] = lastMessage.players.map(
          (p: any) => ({
            id: p.id || p.discord_id || "unknown",
            username: p.username || p.name || "Unknown Player",
            avatar: p.avatar_url || p.avatar || undefined, // Adjust based on actual API response
            elo: p.elo || 1000,
          })
        );
=======
        const externalPlayers: PartyMember[] = lastMessage.players.map((p: any) => ({
          id: p.id || p.discord_id || 'unknown',
          username: p.username || p.name || 'Unknown Player',
          avatar: p.avatar_url || p.avatar || undefined, // Adjust based on actual API response
          elo: p.elo || 1000
        }));
>>>>>>> b37cefacd5935a9f26aa22491f4429ab5b1ef73e

        // Update local party view with these players
        // We only show them as filling slots
        setPartyMembers(externalPlayers);
        
        // Don't automatically sync isInQueue state from QUEUE_UPDATE
        // User must explicitly click JOIN QUEUE to join
        // This prevents automatic queue joining when visiting the page
      }
    }

<<<<<<< HEAD
    if (lastMessage.type === "MATCH_READY") {
      // Redirect to lobby!
      if (onStartLobby && lastMessage.players) {
        let players: PartyMember[] = [];

        // Handle if players are objects (New Backend) or strings (Old Logic)
        if (
          lastMessage.players.length > 0 &&
          typeof lastMessage.players[0] === "object"
        ) {
          players = lastMessage.players.map((p: any) => ({
            id: p.id || p.discord_id,
            username: p.username || p.name || "Unknown",
            avatar: p.avatar || p.avatar_url,
            elo: p.elo || 1000,
          }));
        } else {
          // Fallback for string IDs
          players = lastMessage.players.map((id: string) => ({
            id,
            username: "Player",
            elo: 1000,
          }));
        }

        console.log("Match Ready! Players:", players);
        onStartLobby(players);
      }
=======
    // Don't auto-navigate to lobby from matchmaking page
    // User should use "RETURN TO MATCH" button to go to lobby
    // This prevents wrong lobby bug and allows free navigation
    if (lastMessage.type === 'MATCH_READY') {
      // Just log that match is ready, but don't navigate
      // The global handler in App.tsx will set activeLobbyId
      // and show "RETURN TO MATCH" button
      console.log("Match Ready received on matchmaking page - staying on page");
>>>>>>> b37cefacd5935a9f26aa22491f4429ab5b1ef73e
    }
  }, [lastMessage, onStartLobby]);

  // Check if current user is in queue (only set when explicitly joining, not from QUEUE_UPDATE)
  const [isInQueue, setIsInQueue] = useState(false);

<<<<<<< HEAD
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.id && partyMembers.some((p) => p.id === user.id)) {
      setIsInQueue(true);
    } else {
      setIsInQueue(false);
    }
  }, [partyMembers]);

  const handleJoinQueue = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
=======
  const handleJoinQueue = () => {
    // Don't allow joining queue if user is already in a lobby
    if (activeLobbyId) {
      return;
    }
    const user = JSON.parse(localStorage.getItem('user') || '{}');
>>>>>>> b37cefacd5935a9f26aa22491f4429ab5b1ef73e
    if (user.id) {
      sendMessage({
        type: "JOIN_QUEUE",
        userId: user.id,
        username: user.username,
        avatar: user.avatar,
      });
      setIsInQueue(true);
    }
  };

  const handleLeaveQueue = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.id) {
      sendMessage({ type: "LEAVE_QUEUE", userId: user.id });
      setIsInQueue(false);
    }
  };

  const handleInviteFriend = (_slotIndex: number) => {
    setShowInviteModal(true);
  };

  const handleFriendInvited = (friend: any) => {
    // Send invite via WebSocket
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.id) {
      sendMessage({
        type: "SEND_INVITE",
        targetId: friend.id,
        fromUser: {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
        },
        lobbyId: "global", // Or specific lobby ID if we were using rooms
      });
      alert(`${friend.nickname || friend.username} хүнд урилга илгээлээ!`);
      setShowInviteModal(false);
    }
  };

  const handleFillBots = () => {
    // Send message to backend to fill with bots and start match
    sendMessage({
      type: "FILL_BOTS",
    });
  };

  // ... helper methods ...
  const getAvatarUrl = (member: PartyMember) => {
    if (member.avatar) {
      if (member.avatar.startsWith("http")) return member.avatar;
      return `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.png`;
    }
    return null;
  };

  const renderPartySlot = (index: number) => {
    const member =
      index < partyMembers.length ? partyMembers[index] : undefined;
    return (
      <div
        key={index}
        className={`party-slot ${member ? "filled" : "empty"}`}
        onClick={() => !member && handleInviteFriend(index)}
      >
        <div className="party-slot-border">
          <div className="slot-corner-tl"></div>
          <div className="slot-corner-tr"></div>
          <div className="slot-corner-bl"></div>
          <div className="slot-corner-br"></div>
        </div>
        {member ? (
          <>
            <div className="party-slot-avatar">
              {getAvatarUrl(member) ? (
                <img src={getAvatarUrl(member)!} alt={member.username} />
              ) : (
                <div className="party-slot-avatar-placeholder">
                  {member.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="party-slot-info">
              <div className="party-slot-username">{member.username}</div>
<<<<<<< HEAD
              <div className="party-slot-elo">{member.elo || 1000} ELO</div>
              <div className="party-slot-status">БЭЛЭН</div>
=======
              <div className="party-slot-mmr">{member.elo || 1000} ELO</div>
              <div className="party-slot-status">READY</div>
>>>>>>> b37cefacd5935a9f26aa22491f4429ab5b1ef73e
            </div>
          </>
        ) : (
          <div className="party-slot-add-icon"></div>
        )}
      </div>
    );
  };

  // If user is in a lobby, show active match info instead of queue
  if (activeLobbyId) {
    return (
      <div className="matchmaking-page">
        <div className="cyber-grid-bg"></div>
        <DebugConsole />

        <div className="matchmaking-content">
          <h1 className="matchmaking-title" data-text="ACTIVE MATCH">ACTIVE MATCH</h1>
          <div className="matchmaking-subtitle">You are currently in a match lobby</div>

          <div className="live-counter-large">
            <span className="live-count-number">#</span>
            <span className="live-count-text">LOBBY ACTIVE</span>
          </div>

          <div className="radar-container">
            <div className="radar-outer-ring"></div>
            <div className="radar-sweep"></div>
            <div className="radar-grid-lines"></div>

            <div className="map-hologram">
              <div style={{ color: '#00ff00', fontSize: '24px', textAlign: 'center', marginTop: '15px' }}>
                IN LOBBY
              </div>
            </div>
          </div>

          <div className="timer-section">
            <div className="player-count">
              <span className="count-label">LOBBY ID</span>
              <span className="count-val">{activeLobbyId.slice(0, 8).toUpperCase()}</span>
            </div>
          </div>

          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>
              Use the "RETURN TO MATCH" button in the header to view your lobby
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="matchmaking-page">
      <div className="cyber-grid-bg"></div>
      <DebugConsole />

      {showInviteModal && (
        <InviteFriendModal
          currentPartyIds={partyMembers.map((m) => m.id)}
          onInvite={handleFriendInvited}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      <div className="matchmaking-content">
        <>
          <h1 className="matchmaking-title" data-text="НЭГДСЭН ТОГЛОЛТ ОЛОХ">
            НЭГДСЭН ДАРААЛАЛ
          </h1>
          <div className="matchmaking-subtitle">Веб + Discord Синхрончлол</div>

          <div className="live-counter-large">
            <span className="live-count-number">{partyMembers.length}</span>
            <span className="live-count-text">ДАРААЛАЛД БАЙГАА ТОГЛОГЧИД</span>
          </div>

          <div className="radar-container">
            <div className="radar-outer-ring"></div>
            <div className="radar-sweep"></div>
            <div className="radar-grid-lines"></div>

            <div className="map-hologram">
              <div
                style={{
                  color: isInQueue ? "#00ff00" : "#ff6b35",
                  fontSize: "24px",
                  textAlign: "center",
                  marginTop: "15px",
                }}
              >
                {isInQueue ? "ХАЙЖ БАЙНА" : "ХООСОН"}
              </div>
            </div>
          </div>

          <div className="timer-section">
            <div className="player-count">
              <span className="count-label">ДАРААЛАЛД БАЙГАА ТОГЛОГЧИД</span>
              <span className="count-val">{partyMembers.length} / 10</span>
            </div>
          </div>
        </>
      </div>

      <div className="party-slots-container">
        <div className="party-slots-label">
          ЛОББИЙН ТӨЛӨВ //{" "}
          <span className="highlight">
            {isInQueue ? "ХАЙЖ БАЙНА..." : "ХУЛЭЭЖ БАЙНА"}
          </span>
        </div>
        <div className="party-slots">
          <div className="party-slots-row">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) =>
              renderPartySlot(index)
            )}
          </div>
        </div>
      </div>

      <div className="matchmaking-actions">
        {!isInQueue ? (
<<<<<<< HEAD
          <button
            className="find-match-btn-large cyber-button-primary"
            onClick={handleJoinQueue}
          >
            <span className="btn-content">ДАРААЛАЛД НЭГДЭХ</span>
=======
          <button 
            className="find-match-btn-large cyber-button-primary" 
            onClick={handleJoinQueue}
            disabled={!!activeLobbyId}
            style={{ 
              opacity: activeLobbyId ? 0.5 : 1, 
              cursor: activeLobbyId ? 'not-allowed' : 'pointer' 
            }}
            title={activeLobbyId ? 'You are already in a match lobby' : ''}
          >
            <span className="btn-content">{activeLobbyId ? 'IN LOBBY' : 'JOIN QUEUE'}</span>
>>>>>>> b37cefacd5935a9f26aa22491f4429ab5b1ef73e
            <div className="btn-glitch"></div>
          </button>
        ) : (
          <button
            className="cancel-button cyber-button-secondary"
            onClick={handleLeaveQueue}
          >
            <span className="btn-content">ДАРААЛАЛААС ГАРАХ</span>
          </button>
        )}
        {partyMembers.length < 10 &&
          (window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1") && (
            <button
              className="fill-bots-btn"
              onClick={handleFillBots}
              style={{ marginTop: "12px" }}
            >
              <span className="btn-content">
                БОТУУДААР ДҮҮРГЭХ ({partyMembers.length}/10)
              </span>
            </button>
          )}
      </div>
    </div>
  );
}
