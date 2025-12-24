import { useState, useEffect } from 'react';
import './MatchmakingPage.css';

export default function MatchmakingPage({ onCancel }: { onCancel: () => void }) {
  const [isSearching, setIsSearching] = useState(false);
  const [timer, setTimer] = useState(0);
  const estimatedTime = '01:30';

  useEffect(() => {
    if (!isSearching) return;

    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isSearching]);

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

  return (
    <div className="matchmaking-page">
      <div className="matchmaking-content">
        {!isSearching ? (
          <>
            <h1 className="matchmaking-title">Find Match</h1>
            <p className="matchmaking-subtitle">Click below to start searching for opponents</p>
            <button className="find-match-btn-large" onClick={handleFindMatch}>
              Find Match
            </button>
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
              <div className="estimated-time">
                Estimated Time: <span className="time-value">{estimatedTime}</span>
              </div>
            </div>

            <button className="cancel-button" onClick={handleCancel}>
              Cancel Matchmaking
            </button>
          </>
        )}
      </div>

      <div className="party-status">
        <h3 className="party-title">Party Status</h3>
        <div className="party-member">
          <div className="member-avatar"></div>
          <div className="member-info">
            <span className="member-icon">👥</span>
            <span className="member-status">Solo Queue</span>
          </div>
        </div>
      </div>
    </div>
  );
}

