import './ProfilePage.css';

interface ProfilePageProps {
  onFindMatch: () => void;
}

export default function ProfilePage({ onFindMatch }: ProfilePageProps) {
  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-info">
          <div className="profile-avatar-large"></div>
          <div className="profile-details">
            <div className="nickname-label">Nickname:</div>
            <div className="nickname-display">
              <span className="nickname">Mondy</span>
              <span className="edit-icon">✏️</span>
            </div>
            <div className="last-edited">Last edited: 1 years ago</div>
          </div>
        </div>

        <div className="current-elo-box">
          <div className="elo-label">Current ELO:</div>
          <div className="elo-value">1250</div>
        </div>

        <button className="find-match-btn" onClick={onFindMatch}>Find Match</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card win-rate-card">
          <div className="stat-header">
            <span className="stat-title">Win Rate</span>
            <span className="stat-percentage">75.68%</span>
          </div>
          <div className="win-rate-chart">
            <svg viewBox="0 0 300 150" className="chart-svg">
              <defs>
                <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ff6b35" stopOpacity="0.4"/>
                  <stop offset="100%" stopColor="#ff6b35" stopOpacity="0.05"/>
                </linearGradient>
              </defs>
              <path
                d="M 0 120 Q 30 100, 60 95 T 120 80 T 180 70 T 240 50 T 300 30 L 300 150 L 0 150 Z"
                fill="url(#chartGradient)"
                stroke="#ff6b35"
                strokeWidth="2"
              />
            </svg>
            <div className="chart-labels">
              <span>Low</span>
              <span>Low</span>
              <span>Migh</span>
              <span>Hgh</span>
              <span>High</span>
            </div>
          </div>
        </div>

        <div className="stat-card kd-card">
          <div className="stat-title">K/D Ratio</div>
          <div className="stat-value-large">1.70</div>
        </div>

        <div className="stat-card matches-card">
          <div className="stat-title">Total Matches Played</div>
          <div className="stat-value-large">100</div>
        </div>
      </div>

      <div className="profile-bottom-section">
        <div className="achievements-section">
          <h3 className="section-title">Achievement Rewards</h3>
          <div className="badges-container">
            <div className="badges-earned">
              <div className="badges-label">You Earned Badges</div>
              <div className="badges-grid">
                <div className="badge-item">
                  <div className="badge-icon gold">⭐</div>
                  <div className="badge-name">Badge 1</div>
                </div>
                <div className="badge-item">
                  <div className="badge-icon bronze">🏆</div>
                  <div className="badge-name">Badge 2</div>
                </div>
                <div className="badge-item">
                  <div className="badge-icon gold">🏆</div>
                  <div className="badge-name">Badge 3</div>
                </div>
                <div className="badge-item">
                  <div className="badge-icon silver">🏆</div>
                  <div className="badge-name">Badge 4</div>
                </div>
              </div>
            </div>

            <div className="rewards-upcoming">
              <div className="badges-label">Upcoming Rewards</div>
              <div className="upcoming-grid">
                <div className="upcoming-item">
                  <div className="reward-icon">🎁</div>
                  <div className="reward-name">Daily Rewards</div>
                </div>
                <span className="arrow-next">›</span>
                <div className="upcoming-item">
                  <div className="reward-icon">🎁</div>
                  <div className="reward-name">Daily Rewards</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="match-history-section">
          <h3 className="section-title">Recent Match History</h3>
          <div className="match-history-table">
            <div className="table-header">
              <span>Match</span>
              <span>Map Played</span>
              <span>ELO</span>
            </div>
            <div className="match-history-list">
              {matchHistoryData.map((match, index) => (
                <div key={index} className="match-row">
                  <div className="match-player">
                    <span className="player-avatar">{match.avatar}</span>
                    <div className="player-info">
                      <span className="player-name">{match.name}</span>
                      <span className="player-status">{match.status}</span>
                    </div>
                  </div>
                  <span className="map-played">{match.map}</span>
                  <span className={`elo-change ${match.elo > 0 ? 'positive' : 'negative'}`}>
                    {match.elo > 0 ? '+' : ''}{match.elo}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const matchHistoryData = [
  { name: 'Dviun', status: 'Gamed', avatar: '🎮', map: '1st Played', elo: 1250 },
  { name: 'Marks199', status: 'Gamed', avatar: '⚔️', map: '1st Played', elo: -150 },
  { name: 'Dviun', status: 'Gamed', avatar: '🎮', map: '1st Played', elo: 1250 },
  { name: 'Shory', status: 'Gamed', avatar: '🔫', map: '1st Played', elo: -1250 },
  { name: 'Raovind', status: 'Gamed', avatar: '⚡', map: '1st Played', elo: 1250 },
  { name: 'Rannny', status: 'Galaxy', avatar: '🏆', map: '2nd Played', elo: -1250 },
  { name: 'Javettl', status: 'Gamed', avatar: '🎯', map: '1st Played', elo: 1250 },
];

