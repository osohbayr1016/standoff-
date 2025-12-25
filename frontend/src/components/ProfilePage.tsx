import { useState, useEffect } from "react";
import "./ProfilePage.css";

interface User {
  id: string;
  username: string;
  avatar: string;
}

interface ProfileData {
  id: string;
  discord_id: string;
  discord_username: string;
  discord_avatar?: string;
  standoff_nickname?: string;
  elo: number;
  wins: number;
  losses: number;
}

interface ProfilePageProps {
  user: User | null;
  onFindMatch: () => void;
  onLogout: () => void;
}

export default function ProfilePage({
  user,
  onFindMatch,
  onLogout,
}: ProfilePageProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newNickname, setNewNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
      setAvatarError(false); // Reset avatar error when user changes
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"
        }/api/profile/${user.id}`
      );
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setNewNickname(data.standoff_nickname || "");
        setAvatarError(false); // Reset avatar error when profile loads
      } else {
        console.error("Failed to fetch profile");
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNickname = async () => {
    if (!user?.id) return;
    setError(null);
    setSuccessMsg(null);
    setSaving(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"
        }/api/profile/nickname`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, nickname: newNickname }),
        }
      );

      const data = await res.json();

      if (res.ok) {
        setProfile((prev) =>
          prev ? { ...prev, standoff_nickname: data.nickname } : null
        );
        setSuccessMsg("Нэр амжилттай шинэчлэгдлээ!");
        setIsEditing(false);
      } else {
        if (data.details) {
          setError(data.details[0].message);
        } else {
          setError(data.error || "Нэр шинэчлэхэд алдаа гарлаа");
        }
      }
    } catch (err) {
      setError("Сүлжээний алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="profile-page">
        <div className="loading">Профайл харахын тулд нэвтэрнэ үү</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading">Профайл ачааллаж байна...</div>
      </div>
    );
  }

  const winRate = profile
    ? profile.wins + profile.losses > 0
      ? ((profile.wins / (profile.wins + profile.losses)) * 100).toFixed(1)
      : "0.0"
    : "0.0";
  const totalMatches = profile ? profile.wins + profile.losses : 0;

  // Calculate Rank Progress (Example: Gold to Platinum)
  // Assuming 1000 ELO base, 100 ELO per rank level for visualization
  const currentELO = profile?.elo || 1000;
  const nextRankELO = Math.ceil((currentELO + 1) / 100) * 100;
  const prevRankELO = nextRankELO - 100;
  const progressPercent = Math.min(
    100,
    Math.max(
      0,
      ((currentELO - prevRankELO) / (nextRankELO - prevRankELO)) * 100
    )
  );

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-info">
          <div className="profile-avatar-container">
            <div className="profile-avatar-large">
              {(() => {
                const avatarHash = profile?.discord_avatar || user?.avatar;
                const discordId = profile?.discord_id || user?.id;
                const displayName = profile?.discord_username || user?.username;
                if (avatarHash && discordId && !avatarError) {
                  return (
                    <img
                      src={`https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png`}
                      alt="Avatar"
                      onError={() => setAvatarError(true)}
                    />
                  );
                }
                return (
                  <div className="avatar-placeholder">
                    {displayName?.[0]?.toUpperCase() || "?"}
                  </div>
                );
              })()}
              <div className="online-status-indicator"></div>
            </div>
            <div className="rank-border-glow"></div>
          </div>

          <div className="profile-details">
            <div className="nickname-label">ТОГЛОГЧИЙН ПРОФАЙЛ</div>

            {isEditing ? (
              <div className="nickname-edit-mode">
                <input
                  type="text"
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  placeholder="Нэр оруулах"
                  className="nickname-input"
                  autoFocus
                />
                <div className="edit-actions">
                  <button
                    onClick={handleSaveNickname}
                    disabled={saving}
                    className="save-btn"
                  >
                    {saving ? "..." : "ХАДГАЛАХ"}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setNewNickname(profile?.standoff_nickname || "");
                      setError(null);
                    }}
                    className="cancel-btn"
                  >
                    ЦУЦЛАХ
                  </button>
                </div>
              </div>
            ) : (
              <div className="nickname-display">
                <span className="nickname">
                  {profile?.standoff_nickname ||
                    profile?.discord_username ||
                    user?.username ||
                    "Player"}
                </span>
                <span className="edit-icon" onClick={() => setIsEditing(true)}>
                  ✏️
                </span>
              </div>
            )}

            {error && <div className="error-msg">{error}</div>}
            {successMsg && <div className="success-msg">{successMsg}</div>}

            <div className="discord-handle">
              <span className="discord-icon"></span>@
              {profile?.discord_username || user.username}
            </div>
          </div>
        </div>

        <div className="header-stats-group">
          <div className="current-elo-box">
            <div className="elo-label">ELO Оноо </div>
            <div className="elo-value">{profile?.elo || 1000}</div>
          </div >
          <div className="header-buttons-group">
            <button className="find-match-btn" onClick={onFindMatch}>
              <span className="btn-glitch-effect">ТОГЛОЛТ ЭХЛҮҮЛЭХ</span>
            </button>
            <button
              className="logout-btn"
              onClick={() => setShowLogoutConfirm(true)}
            >
              ГАРАХ
            </button>
          </div>
        </div >
      </div >

      <div className="rank-progression-container">
        <div className="rank-labels">
          <span className="rank-name prev-rank">АЛТ III</span>
          <span className="rank-name next-rank">ЦАГАН АЛТ I</span>
        </div>
        <div className="rank-progress-bar">
          <div
            className="rank-progress-fill"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="progress-glow"></div>
          </div>
        </div>
        <div className="rank-xp-text">
          {currentELO} / {nextRankELO} ELO
        </div>
      </div >

      <div className="stats-grid">
        <div className="stat-card win-rate-card">
          <div className="stat-header">
            <span className="stat-title">ХОЖЛЫН ХУВЬ</span>
          </div>
          <div className="circular-chart-container">
            <svg viewBox="0 0 36 36" className="circular-chart">
              <path
                className="circle-bg"
                d="M18 2.0845
                   a 15.9155 15.9155 0 0 1 0 31.831
                   a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="circle"
                strokeDasharray={`${winRate}, 100`}
                d="M18 2.0845
                   a 15.9155 15.9155 0 0 1 0 31.831
                   a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <text x="18" y="20.35" className="percentage">
                {winRate}%
              </text>
            </svg>
          </div>
        </div>

        <div className="stat-card kd-card">
          <div className="stat-title">НИЙТ ТОГЛОЛТ</div>
          <div className="stat-value-large">{totalMatches}</div>
          <div className="stat-subtext">ДУУСГАСАН АЖИЛЛАГАА</div>
        </div>
      </div>

      <div className="profile-bottom-section">
        <div className="match-history-section">
          <h3 className="section-title">СҮҮЛИЙН АЖИЛЛАГААНУУД</h3>
          <div className="match-history-table">
            <div className="table-header">
              <span>ГАЗАР ЗУРАГ</span>
              <span>ҮР ДҮН</span>
              <span>ОНОО</span>
              <span>ОГНОО</span>
            </div>

            <div className="match-history-list">
              {/* Match history integration pending backend endpoint */}
              <div className="no-matches">БИЧИГДСЭН АЖИЛЛАГАА БАЙХГҮЙ</div>
            </div>
          </div>
        </div>
      </div>

      {
        showLogoutConfirm && (
          <div
            className="logout-confirm-overlay"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <div
              className="logout-confirm-dialog"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="confirm-title">Та итгэлтэй байна уу?</h3>
              <p className="confirm-message">Та гарахыг хүсч байна уу?</p>
              <div className="confirm-actions">
                <button
                  className="confirm-btn confirm-yes"
                  onClick={() => {
                    onLogout();
                    setShowLogoutConfirm(false);
                  }}
                >
                  ТИЙМ
                </button>
                <button
                  className="confirm-btn confirm-no"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  ҮГҮЙ
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
