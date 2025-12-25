import { useState, useEffect } from 'react';
import './Leaderboard.css';

interface LeaderboardPlayer {
  rank: number;
  id: string;
  discord_id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  elo: number;
  wins: number;
  losses: number;
}

const RANK_EMOJIS = ['🏆', '⚔️', '🎯', '🔫', '⚡'];

export default function Leaderboard() {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787';
        const response = await fetch(`${backendUrl}/api/leaderboard`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard');
        }
        
        const data = await response.json();
        // Get top 5 players
        const top5 = data.slice(0, 5).map((player: any, index: number) => ({
          rank: index + 1,
          ...player
        }));
        setLeaderboardData(top5);
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setError('Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const getAvatarUrl = (player: LeaderboardPlayer) => {
    if (player.avatar) {
      return `https://cdn.discordapp.com/avatars/${player.discord_id}/${player.avatar}.png`;
    }
    return null;
  };

  const getDisplayName = (player: LeaderboardPlayer) => {
    return player.nickname || player.username || 'Unknown';
  };

  if (loading) {
    return (
      <div className="leaderboard-card">
        <h3 className="card-title">Live Leaderboard Top 5</h3>
        <div className="leaderboard-list">
          <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  if (error || leaderboardData.length === 0) {
    return (
      <div className="leaderboard-card">
        <h3 className="card-title">Live Leaderboard Top 5</h3>
        <div className="leaderboard-list">
          <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>
            {error || 'No players found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="leaderboard-card">
      <h3 className="card-title">Live Leaderboard Top 5</h3>
      <div className="leaderboard-list">
        {leaderboardData.map((player) => (
          <div key={player.id} className={`leaderboard-item rank-${player.rank}`}>
            <div className="player-info">
              <span className="rank-badge">{player.rank}</span>
              <span className="player-avatar">
                {getAvatarUrl(player) ? (
                  <img 
                    src={getAvatarUrl(player)!} 
                    alt={getDisplayName(player)}
                    style={{ width: '24px', height: '24px', borderRadius: '50%' }}
                  />
                ) : (
                  RANK_EMOJIS[player.rank - 1] || '👤'
                )}
              </span>
              <span className="player-name">{getDisplayName(player)}</span>
            </div>
            <span className="player-points">{player.elo} ELO</span>
          </div>
        ))}
      </div>
    </div>
  );
}

