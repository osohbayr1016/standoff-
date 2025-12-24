import { useState, useMemo } from 'react';
import './LeaderboardPage.css';

const leaderboardData = [
  { rank: 1, name: 'Mondy', avatar: '👤', elo: 1250, wins: 126, winRate: '75.32%', badge: '🥇' },
  { rank: 2, name: 'Mondy', avatar: '👤', elo: 1250, wins: 163, winRate: '75.68%', badge: '🥈' },
  { rank: 3, name: 'Marks199', avatar: '👤', elo: 1250, wins: 100, winRate: '75.67%', badge: '🥉' },
  { rank: 4, name: 'Mornania', avatar: '👤', elo: 1250, wins: 88, winRate: '60.35%', badge: '' },
  { rank: 5, name: 'Javettl', avatar: '👤', elo: 1250, wins: 74, winRate: '43.09%', badge: '' },
  { rank: 6, name: 'Marks199', avatar: '👤', elo: 1250, wins: 71, winRate: '50.32%', badge: '' },
  { rank: 7, name: 'Shory', avatar: '👤', elo: 1250, wins: 66, winRate: '42.87%', badge: '' },
  { rank: 8, name: 'Raov0nd', avatar: '👤', elo: 1250, wins: 59, winRate: '40.26%', badge: '' },
  { rank: 9, name: 'Rannny', avatar: '👤', elo: 1250, wins: 33, winRate: '30.53%', badge: '' },
  { rank: 10, name: 'Javettl', avatar: '👤', elo: 1250, wins: 12, winRate: '24.44%', badge: '' },
];

export default function LeaderboardPage() {
  const [sortBy, setSortBy] = useState('elo');

  const sortedData = useMemo(() => {
    const data = [...leaderboardData];
    
    switch (sortBy) {
      case 'elo':
        return data.sort((a, b) => b.elo - a.elo);
      case 'matches':
        return data.sort((a, b) => b.wins - a.wins);
      case 'winrate':
        return data.sort((a, b) => {
          const aRate = parseFloat(a.winRate);
          const bRate = parseFloat(b.winRate);
          return bRate - aRate;
        });
      default:
        return data;
    }
  }, [sortBy]);

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-header">
        <div className="leaderboard-title-section">
          <h1 className="leaderboard-title">Leaderboard</h1>
          <p className="leaderboard-subtitle">Ranking column to Leaderboard</p>
        </div>

        <div className="leaderboard-filters">
          <button
            className={`filter-button ${sortBy === 'elo' ? 'active' : ''}`}
            onClick={() => setSortBy('elo')}
          >
            Highest ELO
          </button>
          <button
            className={`filter-button ${sortBy === 'matches' ? 'active' : ''}`}
            onClick={() => setSortBy('matches')}
          >
            Highest Matches
          </button>
          <button
            className={`filter-button ${sortBy === 'winrate' ? 'active' : ''}`}
            onClick={() => setSortBy('winrate')}
          >
            Highest Winrate
          </button>
        </div>
      </div>

      <div className="leaderboard-table">
        <div className="table-header-row">
          <span className="header-rank">Rank</span>
          <span className="header-player">Player</span>
          <span className="header-elo">ELO</span>
          <span className="header-wins">Wins</span>
          <span className="header-winrate">Win Rate</span>
        </div>

        <div className="leaderboard-rows">
          {sortedData.map((player, index) => {
            const badges = ['🥇', '🥈', '🥉'];
            return (
            <div key={`${player.name}-${index}`} className={`leaderboard-row rank-${index + 1}`}>
              <div className="rank-cell">
                {index < 3 && (
                  <div className="rank-badge-special">{badges[index]}</div>
                )}
                <span className="rank-number">{index + 1}</span>
              </div>

              <div className="player-cell">
                <div className="player-avatar-small">{player.avatar}</div>
                <span className="player-name-text">{player.name}</span>
              </div>

              <span className="elo-cell">{player.elo}</span>
              <span className="wins-cell">{player.wins}</span>
              <span className="winrate-cell">{player.winRate}</span>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

