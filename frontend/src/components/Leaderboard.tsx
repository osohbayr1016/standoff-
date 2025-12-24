import './Leaderboard.css';

const leaderboardData = [
  { rank: 1, name: 'Mondy', avatar: '🏆', points: 'Points' },
  { rank: 2, name: 'Marks199', avatar: '⚔️', points: 'Points' },
  { rank: 3, name: 'Rairmon', avatar: '🎯', points: 'Points' },
  { rank: 4, name: 'Mornania', avatar: '🔫', points: 'Points' },
  { rank: 5, name: 'Jayertf', avatar: '⚡', points: 'Points' },
];

export default function Leaderboard() {
  return (
    <div className="leaderboard-card">
      <h3 className="card-title">Live Leaderboard Top 5</h3>
      <div className="leaderboard-list">
        {leaderboardData.map((player) => (
          <div key={player.rank} className={`leaderboard-item rank-${player.rank}`}>
            <div className="player-info">
              <span className="rank-badge">{player.rank}</span>
              <span className="player-avatar">{player.avatar}</span>
              <span className="player-name">{player.name}</span>
            </div>
            <span className="player-points">{player.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

