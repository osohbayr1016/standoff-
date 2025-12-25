import { useState, useEffect } from 'react';
import './RecentMatches.css';

interface MatchData {
  player1: string;
  player1Avatar: string;
  score: string;
  player2: string;
  player2Avatar: string;
  status: string;
}

export default function RecentMatches() {
  const [matchesData, setMatchesData] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For now, check if user has any match history
    // Since match history is not stored in database yet, show empty state
    // In the future, this can fetch from a match history API
    const checkMatchHistory = async () => {
      try {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          const userData = JSON.parse(savedUser);
          const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787';
          const response = await fetch(`${backendUrl}/api/profile/${userData.id}`);
          
          if (response.ok) {
            const profile = await response.json();
            // If user has wins or losses, we could show placeholder matches
            // But for now, show empty state since we don't have match history
            if (profile.wins === 0 && profile.losses === 0) {
              setMatchesData([]);
            } else {
              // User has played matches but we don't have detailed history
              // Show empty state
              setMatchesData([]);
            }
          }
        }
      } catch (err) {
        console.error('Error checking match history:', err);
      } finally {
        setLoading(false);
      }
    };

    checkMatchHistory();
  }, []);

  if (loading) {
    return (
      <div className="matches-card">
        <h3 className="card-title">Recent Matches</h3>
        <div className="matches-list">
          <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  if (matchesData.length === 0) {
    return (
      <div className="matches-card">
        <h3 className="card-title">Recent Matches</h3>
        <div className="matches-list">
          <div style={{ 
            padding: '2rem 1rem', 
            textAlign: 'center', 
            color: '#94a3b8',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎮</div>
            <div style={{ fontSize: '0.9rem' }}>No recent matches</div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.7 }}>
              Play matches to see your history here
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="matches-card">
      <h3 className="card-title">Сүүлийн тоглолтууд</h3>
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

