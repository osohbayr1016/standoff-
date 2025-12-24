import { useState } from 'react';
import './Header.css';

interface HeaderProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

export default function Header({ currentPage, onNavigate, onLogout }: HeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <header className="header">
      <div className="header-container">
        <div className="logo" onClick={() => onNavigate('home')}>
          <span className="logo-text">STAN</span>
          <span className="logo-highlight">D</span>
          <span className="logo-text">OFF 2</span>
        </div>
        
        <nav className="nav">
          <button 
            className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}
            onClick={() => onNavigate('home')}
          >
            Home
          </button>
          <button 
            className={`nav-link ${currentPage === 'matchmaking' ? 'active' : ''}`}
            onClick={() => onNavigate('matchmaking')}
          >
            Matchmaking
          </button>
          <button 
            className={`nav-link ${currentPage === 'leaderboard' ? 'active' : ''}`}
            onClick={() => onNavigate('leaderboard')}
          >
            Leaderboard
          </button>
          <button 
            className={`nav-link ${currentPage === 'rewards' ? 'active' : ''}`}
            onClick={() => onNavigate('rewards')}
          >
            Rewards
          </button>
          <button 
            className={`nav-link ${currentPage === 'friends' ? 'active' : ''}`}
            onClick={() => onNavigate('friends')}
          >
            Friends
          </button>
        </nav>

        <div className="user-info" onClick={() => setShowDropdown(!showDropdown)}>
          <div className="user-avatar"></div>
          <span className="user-elo">ELO: 1250</span>
          <span className="dropdown-arrow">▼</span>
          
          {showDropdown && (
            <div className="user-dropdown">
              <button 
                className="dropdown-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate('profile');
                  setShowDropdown(false);
                }}
              >
                👤 Profile
              </button>
              <button 
                className="dropdown-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate('settings');
                  setShowDropdown(false);
                }}
              >
                ⚙️ Settings
              </button>
              <button 
                className="dropdown-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onLogout();
                  setShowDropdown(false);
                }}
              >
                🚪 Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
