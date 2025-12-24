import { useState } from 'react';
import './FriendsPage.css';

const activeFriends = [
  { id: 1, name: 'Marks99', avatar: '👤', status: 'online', elo: '2510' },
  { id: 2, name: 'Beavind Lare', avatar: '👤', status: 'online', elo: 'SL0 410' },
  { id: 3, name: 'Mollcaniues', avatar: '👤', status: 'online', elo: 'T 248 110' },
  { id: 4, name: 'Salnus', avatar: '👤', status: 'offline', elo: 'SL0 110', eloRank: '210 Miod' },
  { id: 5, name: 'Uasoind', avatar: '🏆', status: 'offline', elo: '5Я0Я 14' },
  { id: 6, name: 'Shons', avatar: '👤', status: 'offline', elo: 'ELO 84Я', eloValue: '21 БИ0' },
  { id: 7, name: 'Shory', avatar: '👤', status: 'offline', elo: 'S116я 11', eloRank: 'Gamed' },
  { id: 8, name: 'Ceenrors', avatar: '👤', status: 'offline', elo: '20 2 11', eloValue: '29 tri0' },
  { id: 9, name: 'Bieliolita', avatar: '🏆', status: 'offline', elo: 'S60 44' },
];

const searchResults = [
  { id: 1, name: 'Driun', team: 'Gamed', score: '3 - 4', opponent: 'Beavind', opponentTeam: 'Lanre', avatar: '🎮' },
  { id: 2, name: 'Momajn', team: 'Gamed', score: '0 - 5', opponent: 'Atlok', opponentTeam: 'Gamed', avatar: '👤' },
  { id: 3, name: 'Noosstlnnd', elo: '1 8Sή 10', avatar: '👤' },
];

const pendingRequests = [
  { id: 1, name: 'Uincharielo', status: 'onllira', elo: 'ELO', additional: 'Emd Playe', avatar: '👤' },
  { id: 2, name: 'Seffr Ceck', elo: '311 Л 118', avatar: '👤' },
];

export default function FriendsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="friends-page">
      <h1 className="friends-page-title">Friends</h1>

      <div className="friends-content">
        <div className="active-friends-section">
          <h2 className="section-title">Active Friends</h2>
          
          <div className="friends-list">
            {activeFriends.map((friend) => (
              <div key={friend.id} className="friend-item">
                <div className="friend-info">
                  <div className="friend-avatar">{friend.avatar}</div>
                  <div className="friend-details">
                    <div className="friend-name-status">
                      <span className="friend-name">{friend.name}</span>
                      {friend.status === 'online' && (
                        <span className="status-indicator online">● online</span>
                      )}
                    </div>
                    {friend.status === 'online' && (
                      <span className="status-text">● online</span>
                    )}
                    <span className="friend-elo">{friend.elo}</span>
                  </div>
                </div>
                <div className="friend-actions">
                  {friend.eloRank && <span className="elo-rank">{friend.eloRank}</span>}
                  {friend.eloValue && <span className="elo-value">{friend.eloValue}</span>}
                  {friend.status === 'online' && (
                    <button className="message-btn">Message</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="right-column">
          <div className="add-friend-section">
            <h2 className="section-title">Add New Friend</h2>
            
            <div className="search-bar">
              <input
                type="text"
                placeholder="Search by Stanfoff 2 ID"
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className="search-btn">🔍</button>
            </div>

            <button className="find-player-btn">Find Player</button>

            <div className="search-results">
              {searchResults.map((result) => (
                <div key={result.id} className="result-item">
                  <div className="result-left">
                    <span className="result-avatar">{result.avatar}</span>
                    <div className="result-info">
                      <span className="result-name">{result.name}</span>
                      <span className="result-team">{result.team || result.elo}</span>
                    </div>
                  </div>
                  <div className="result-right">
                    {result.score ? (
                      <>
                        <span className="match-score">{result.score}</span>
                        <div className="opponent-info">
                          <span className="opponent-name">{result.opponent}</span>
                          <span className="opponent-team">{result.opponentTeam}</span>
                        </div>
                      </>
                    ) : (
                      <button className="send-request-btn">Send Request</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pending-requests-section">
            <h2 className="section-title">Pending Requests</h2>
            
            <div className="requests-list">
              {pendingRequests.map((request) => (
                <div key={request.id} className="request-item">
                  <div className="request-left">
                    <span className="request-avatar">{request.avatar}</span>
                    <div className="request-info">
                      <span className="request-name">{request.name}</span>
                      {request.status && (
                        <span className="request-status">● {request.status}</span>
                      )}
                    </div>
                  </div>
                  <div className="request-right">
                    <div className="request-elo">
                      <span className="elo-label">{request.elo}</span>
                      {request.additional && (
                        <span className="elo-additional">{request.additional}</span>
                      )}
                      {!request.additional && (
                        <span className="elo-value-req">{request.elo}</span>
                      )}
                    </div>
                    <div className="request-actions">
                      <button className="accept-btn">Accept</button>
                      <button className="decline-btn">Decline</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

