import { useState } from "react";
import "./Header.css";

interface User {
  id: string;
  username: string;
  avatar: string;
  standoff_nickname?: string;
  elo?: number;
}

interface HeaderProps {
  currentPage: string;
  user?: User | null;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  activeLobbyId?: string; // New Prop
  onReturnToMatch?: () => void; // Callback to request match state
}

export default function Header({
  currentPage,
  user,
  onNavigate,
  onLogout,
  activeLobbyId,
  onReturnToMatch,
}: HeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const getAvatarUrl = () => {
    if (user?.avatar) {
      return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
    }
    return null;
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="logo" onClick={() => onNavigate("home")}>
          <span className="logo-text">STAN</span>
          <span className="logo-highlight">D</span>
          <span className="logo-text">OFF 2</span>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          className="hamburger-btn"
          onClick={() => setShowDropdown(!showDropdown)} // Re-using showDropdown state for mobile menu toggle to keep simple, or better add new state
        >
          <div
            className={`hamburger-line ${showDropdown ? "active" : ""}`}
          ></div>
          <div
            className={`hamburger-line ${showDropdown ? "active" : ""}`}
          ></div>
          <div
            className={`hamburger-line ${showDropdown ? "active" : ""}`}
          ></div>
        </button>

        {/* Desktop Nav */}
        <nav className="nav desktop-nav">
          {activeLobbyId && !["mapban", "matchlobby"].includes(currentPage) && (
            <button
              className="nav-link return-match-btn"
              onClick={() => {
                if (onReturnToMatch) {
                  onReturnToMatch();
                }
                onNavigate("mapban");
              }}
            >
              <span className="pulse-dot"></span> Тоглолт-руу буцах
            </button>
          )}
          <button
            className={`nav-link ${currentPage === "home" ? "active" : ""}`}
            onClick={() => onNavigate("home")}
          >
            Нүүр
          </button>
          <button
            className={`nav-link ${
              currentPage === "matchmaking" ? "active" : ""
            }`}
            onClick={() => onNavigate("matchmaking")}
          >
            Тоглох
          </button>
          <button
            className={`nav-link ${
              currentPage === "leaderboard" ? "active" : ""
            }`}
            onClick={() => onNavigate("leaderboard")}
          >
            Чансаа
          </button>
          <button
            className={`nav-link ${currentPage === "rewards" ? "active" : ""}`}
            onClick={() => onNavigate("rewards")}
          >
            Урамшуулал
          </button>
          <button
            className={`nav-link ${currentPage === "friends" ? "active" : ""}`}
            onClick={() => onNavigate("friends")}
          >
            Найзууд
          </button>
        </nav>

        {/* Mobile Side Drawer */}
        <div
          className={`mobile-nav-overlay ${showDropdown ? "active" : ""}`}
          onClick={() => setShowDropdown(false)}
        ></div>
        <nav className={`mobile-nav-drawer ${showDropdown ? "active" : ""}`}>
          <div className="mobile-nav-header">
            <span className="mobile-nav-title">ЦЭС</span>
            <button
              className="close-nav-btn"
              onClick={() => setShowDropdown(false)}
            >
              ✕
            </button>
          </div>

          <div className="mobile-nav-links">
            {activeLobbyId &&
              !["mapban", "matchlobby"].includes(currentPage) && (
                <button
                  className="mobile-nav-link return-match-btn-mobile"
                  onClick={() => {
                    if (onReturnToMatch) {
                      onReturnToMatch();
                    }
                    onNavigate("mapban");
                    setShowDropdown(false);
                  }}
                >
                  <span className="pulse-dot"></span> Тоглолт-руу буцах
                </button>
              )}
            <button
              className={`mobile-nav-link ${
                currentPage === "home" ? "active" : ""
              }`}
              onClick={() => {
                onNavigate("home");
                setShowDropdown(false);
              }}
            >
              Нүүр
            </button>
            <button
              className={`mobile-nav-link ${
                currentPage === "matchmaking" ? "active" : ""
              }`}
              onClick={() => {
                onNavigate("matchmaking");
                setShowDropdown(false);
              }}
            >
              Тоглолт олох
            </button>
            <button
              className={`mobile-nav-link ${
                currentPage === "leaderboard" ? "active" : ""
              }`}
              onClick={() => {
                onNavigate("leaderboard");
                setShowDropdown(false);
              }}
            >
              Чансаа
            </button>
            <button
              className={`mobile-nav-link ${
                currentPage === "rewards" ? "active" : ""
              }`}
              onClick={() => {
                onNavigate("rewards");
                setShowDropdown(false);
              }}
            >
              Урамшуулал
            </button>
            <button
              className={`mobile-nav-link ${
                currentPage === "friends" ? "active" : ""
              }`}
              onClick={() => {
                onNavigate("friends");
                setShowDropdown(false);
              }}
            >
              Найзууд
            </button>
          </div>

          {user && (
            <div className="mobile-user-section">
              <div
                className="mobile-user-info"
                onClick={() => {
                  onNavigate("profile");
                  setShowDropdown(false);
                }}
              >
                <div className="user-avatar-frame-header">
                  {getAvatarUrl() ? (
                    <img src={getAvatarUrl()!} alt="avatar" />
                  ) : (
                    <div className="avatar-fallback-header">
                      {user.username[0]}
                    </div>
                  )}
                </div>
                <div className="mobile-user-details">
                  <span className="mobile-username">
                    {user.standoff_nickname || user.username}
                  </span>
                  <span className="mobile-elo">ELO: {user.elo || 1000}</span>
                </div>
              </div>
              <button
                className="mobile-logout-btn"
                onClick={() => {
                  onLogout();
                  setShowDropdown(false);
                }}
              >
                Гарах
              </button>
            </div>
          )}
        </nav>

        {/* Desktop User Info (Hidden on Mobile if Drawer is used for user info too, or keep concise) */}
        {user && (
          <div
            className="user-info desktop-user-info"
            onClick={() => onNavigate("profile")}
            style={{ cursor: "pointer" }}
          >
            <div className="user-avatar-frame-header">
              {getAvatarUrl() ? (
                <img src={getAvatarUrl()!} alt="avatar" />
              ) : (
                <div className="avatar-fallback-header">{user.username[0]}</div>
              )}
            </div>
            <span className="user-elo">ELO: {user.elo || 1000}</span>
          </div>
        )}
      </div>
    </header>
  );
}
