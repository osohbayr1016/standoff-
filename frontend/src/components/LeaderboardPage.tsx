
import { useState, useEffect } from 'react';
import './LeaderboardPage.css';

interface LeaderboardEntry {
  rank: number;
  id: string;
  discord_id: string;
  username: string;
  avatar?: string;
  nickname?: string;
  mmr: number;
  wins: number;
  losses: number;
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787'}/api/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="leaderboard-page">
        <div className="loading-container">
          <div className="cyber-spinner"></div>
          <div className="loading-text">ACCESSING RANKING DATABASE...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-header">
        <h1 className="cyber-title">TOP 500 OPERATORS</h1>
        <div className="cyber-subtitle">GLOBAL RANKINGS</div>
      </div>

      <div className="leaderboard-container">
        <div className="leaderboard-table-header">
          <div className="header-rank">RANK</div>
          <div className="header-player">OPERATOR</div>
          <div className="header-mmr">MMR</div>
          <div className="header-stats mobile-hide">W / L</div>
          <div className="header-winrate mobile-hide">WIN RATE</div>
        </div>

        <div className="leaderboard-list">
          {leaderboard.map((player) => {
            const winRate = (player.wins + player.losses) > 0
              ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)
              : '0.0';

            return (
              <div key={player.id} className={`leaderboard-row rank-${player.rank <= 3 ? player.rank : 'other'}`}>
                <div className="rank-cell">
                  {player.rank === 1 && <span className="rank-icon gold">🥇</span>}
                  {player.rank === 2 && <span className="rank-icon silver">🥈</span>}
                  {player.rank === 3 && <span className="rank-icon bronze">🥉</span>}
                  <span className="rank-number">#{player.rank}</span>
                </div>

                <div className="player-cell">
                  <div className="player-avatar">
                    {player.avatar ?
                      <img src={`https://cdn.discordapp.com/avatars/${player.discord_id}/${player.avatar}.png`} alt="" /> :
                      <div className="avatar-placeholder">{player.username?.[0]}</div>
                    }
                  </div>
                  <div className="player-info">
                    <div className="player-nickname">{player.nickname || player.username}</div>
                    {player.nickname && <div className="player-discord">@{player.username}</div>}
                  </div>
                </div>

                <div className="mmr-cell">
                  <span className="mmr-value">{player.mmr}</span>
                </div>

                <div className="stats-cell mobile-hide">
                  <span className="wins">{player.wins}</span> / <span className="losses">{player.losses}</span>
                </div>

                <div className="winrate-cell mobile-hide">
                  <div className="winrate-bar-bg">
                    <div className="winrate-bar-fill" style={{ width: `${winRate}%` }}></div>
                  </div>
                  <span className="winrate-text">{winRate}%</span>
                </div>
              </div>
            );
          })}

          {leaderboard.length === 0 && (
            <div className="no-data">NO RANKING DATA AVAILABLE</div>
          )}
        </div>
      </div>
    </div>
  );
}
