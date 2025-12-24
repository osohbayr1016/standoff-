import { useState } from 'react';
import './SettingsPage.css';

export default function SettingsPage() {
  const [nickname, setNickname] = useState('Mondy');
  const [serverRegion, setServerRegion] = useState('North East');
  const [crossPlay, setCrossPlay] = useState(false);
  const [matchFound, setMatchFound] = useState(true);
  const [dailyRewards, setDailyRewards] = useState(true);
  const [friendRequests, setFriendRequests] = useState(true);

  return (
    <div className="settings-page">
      <h1 className="settings-title">Settings.</h1>

      <div className="settings-grid">
        <div className="settings-section profile-settings-left">
          <h2 className="section-title">Profile Settings</h2>
          
          <div className="form-group">
            <label className="form-label">Nickname</label>
            <input 
              type="text" 
              className="form-input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

          <button className="change-avatar-btn">Change Avatar</button>
        </div>

        <div className="settings-section profile-settings-right">
          <h2 className="section-title">Profile Settings</h2>
          
          <div className="profile-display">
            <span className="profile-nickname">{nickname}</span>
            <div className="profile-avatar-display"></div>
          </div>

          <button className="edit-profile-btn">Edit Prolo</button>
        </div>
      </div>

      <div className="settings-section game-settings">
        <h2 className="section-title">Game Settings</h2>
        
        <div className="game-settings-content">
          <div className="form-group">
            <label className="form-label-inline">Server Region</label>
            <select 
              className="form-select"
              value={serverRegion}
              onChange={(e) => setServerRegion(e.target.value)}
            >
              <option>North East</option>
              <option>North West</option>
              <option>South East</option>
              <option>South West</option>
            </select>
          </div>

          <div className="toggle-group">
            <span className="toggle-label">Cross-play</span>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={crossPlay}
                onChange={(e) => setCrossPlay(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div className="settings-section notification-settings">
        <h2 className="section-title">Notification Settings</h2>
        
        <div className="notifications-list">
          <div className="notification-item">
            <span className="notification-label">Match Found</span>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={matchFound}
                onChange={(e) => setMatchFound(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="notification-item">
            <span className="notification-label">Daily Rewards</span>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={dailyRewards}
                onChange={(e) => setDailyRewards(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="notification-item">
            <span className="notification-label">Friend Requests</span>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={friendRequests}
                onChange={(e) => setFriendRequests(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

