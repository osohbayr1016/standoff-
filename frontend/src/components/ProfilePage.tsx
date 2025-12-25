import { useState, useEffect } from 'react';
import './ProfilePage.css';

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
  mmr: number;
  wins: number;
  losses: number;
}

interface ProfilePageProps {
  user: User | null;
  onFindMatch: () => void;
}

export default function ProfilePage({ user, onFindMatch }: ProfilePageProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787'}/api/profile/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setNewNickname(data.standoff_nickname || '');
      } else {
        console.error('Failed to fetch profile');
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
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
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787'}/api/profile/nickname`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, nickname: newNickname })
      });

      const data = await res.json();

      if (res.ok) {
        setProfile(prev => prev ? { ...prev, standoff_nickname: data.nickname } : null);
        setSuccessMsg('Nickname updated successfully!');
        setIsEditing(false);
      } else {
        if (data.details) {
          setError(data.details[0].message);
        } else {
          setError(data.error || 'Failed to update nickname');
        }
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return <div className="profile-page"><div className="loading">Please login to view profile</div></div>;
  }

  if (loading) {
    return <div className="profile-page"><div className="loading">Loading profile...</div></div>;
  }

  const winRate = profile ? (profile.wins + profile.losses > 0 ? ((profile.wins / (profile.wins + profile.losses)) * 100).toFixed(1) : '0.0') : '0.0';
  const totalMatches = profile ? profile.wins + profile.losses : 0;

  // Calculate Rank Progress (Example: Gold to Platinum)
  // Assuming 1000 MMR base, 100 MMR per rank level for visualization
  const currentMMR = profile?.mmr || 1000;
  const nextRankMMR = Math.ceil((currentMMR + 1) / 100) * 100;
  const prevRankMMR = nextRankMMR - 100;
  const progressPercent = Math.min(100, Math.max(0, ((currentMMR - prevRankMMR) / (nextRankMMR - prevRankMMR)) * 100));

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-info">
          <div className="profile-avatar-container">
            <div className="profile-avatar-large">
              {profile?.discord_avatar ?
                <img src={`https://cdn.discordapp.com/avatars/${profile.discord_id}/${profile.discord_avatar}.png`} alt="Avatar" /> :
                <div className="avatar-placeholder">{profile?.discord_username?.[0]}</div>
              }
              <div className="online-status-indicator"></div>
            </div>
            <div className="rank-border-glow"></div>
          </div>

          <div className="profile-details">
            <div className="nickname-label">OPERATOR PROFILE</div>

            {isEditing ? (
              <div className="nickname-edit-mode">
                <input
                  type="text"
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  placeholder="Enter nickname"
                  className="nickname-input"
                  autoFocus
                />
                <div className="edit-actions">
                  <button onClick={handleSaveNickname} disabled={saving} className="save-btn">
                    {saving ? '...' : 'SAVE'}
                  </button>
                  <button onClick={() => { setIsEditing(false); setNewNickname(profile?.standoff_nickname || ''); setError(null); }} className="cancel-btn">
                    CANCEL
                  </button>
                </div>
              </div>
            ) : (
              <div className="nickname-display">
                <span className="nickname">{profile?.standoff_nickname || 'UNKNOWN_USER'}</span>
                <span className="edit-icon" onClick={() => setIsEditing(true)}>✏️</span>
              </div>
            )}

            {error && <div className="error-msg">{error}</div>}
            {successMsg && <div className="success-msg">{successMsg}</div>}

            <div className="discord-handle">
              <span className="discord-icon"></span>
              @{profile?.discord_username || user.username}
            </div>
          </div>
        </div>

        <div className="header-stats-group">
          <div className="current-elo-box">
            <div className="elo-label">COMPETITIVE MMR</div>
            <div className="elo-value">{profile?.mmr || 1000}</div>
          </div>
          <button className="find-match-btn" onClick={onFindMatch}>
            <span className="btn-glitch-effect">INITIATE MATCH</span>
          </button>
        </div>
      </div>

      <div className="rank-progression-container">
        <div className="rank-labels">
          <span className="rank-name prev-rank">GOLD III</span>
          <span className="rank-name next-rank">PLATINUM I</span>
        </div>
        <div className="rank-progress-bar">
          <div className="rank-progress-fill" style={{ width: `${progressPercent}%` }}>
            <div className="progress-glow"></div>
          </div>
        </div>
        <div className="rank-xp-text">{currentMMR} / {nextRankMMR} MMR</div>
      </div>

      <div className="stats-grid">
        <div className="stat-card win-rate-card">
          <div className="stat-header">
            <span className="stat-title">WIN RATE</span>
          </div>
          <div className="circular-chart-container">
            <svg viewBox="0 0 36 36" className="circular-chart">
              <path className="circle-bg"
                d="M18 2.0845
                   a 15.9155 15.9155 0 0 1 0 31.831
                   a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path className="circle"
                strokeDasharray={`${winRate}, 100`}
                d="M18 2.0845
                   a 15.9155 15.9155 0 0 1 0 31.831
                   a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <text x="18" y="20.35" className="percentage">{winRate}%</text>
            </svg>
          </div>
        </div>

        <div className="stat-card kd-card">
          <div className="stat-title">TOTAL MATCHES</div>
          <div className="stat-value-large">{totalMatches}</div>
          <div className="stat-subtext">COMPLETED OPERATIONS</div>
        </div>

        <div className="stat-card matches-card">
          <div className="stat-title">K/D RATIO</div>
          <div className="stat-value-large highlight">1.52</div>
          <div className="stat-subtext">AVERAGE PERFORMANCE</div>
        </div>
      </div>

      <div className="profile-bottom-section">
        <div className="match-history-section">
          <h3 className="section-title">RECENT OPERATIONS</h3>
          <div className="match-history-table">
            <div className="table-header">
              <span>MAP</span>
              <span>RESULT</span>
              <span>SCORE</span>
              <span>DATE</span>
            </div>

            <div className="match-history-list">
              {/* Match history integration pending backend endpoint */}
              <div className="no-matches">
                NO OPERATIONS RECORDED
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

