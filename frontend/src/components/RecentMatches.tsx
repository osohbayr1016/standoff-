import './RecentMatches.css';

const matchesData = [
  { player1: 'Dviun', player1Avatar: '🎮', score: '3 - 3', player2: 'Deavind', player2Avatar: '⚔️', status: 'Gamed' },
  { player1: 'Shory', player1Avatar: '🔫', score: '0 - 2', player2: 'Atlok', player2Avatar: '🎯', status: 'Gamed' },
  { player1: 'Raov0nd', player1Avatar: '⚡', score: '0 - 2', player2: 'Rannny', player2Avatar: '🏆', status: 'Gamed' },
];

export default function RecentMatches() {
  return (
    <div className="matches-card">
      <h3 className="card-title">Recent Matches</h3>
      <div className="matches-list">
        {matchesData.map((match, index) => (
          <div key={index} className="match-item">
            <div className="player">
              <span className="player-avatar">{match.player1Avatar}</span>
              <div className="player-details">
                <span className="player-name">{match.player1}</span>
                <span className="player-status">{match.status}</span>
              </div>
            </div>
            
            <div className="match-score">
              <span className="score-left">{match.score.split(' - ')[0]}</span>
              <span className="score-divider">-</span>
              <span className="score-right">{match.score.split(' - ')[1]}</span>
            </div>
            
            <div className="player player-right">
              <div className="player-details">
                <span className="player-name">{match.player2}</span>
                <span className="player-status">{match.status}</span>
              </div>
              <span className="player-avatar">{match.player2Avatar}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

