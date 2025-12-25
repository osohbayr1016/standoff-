import './RewardsPage.css';

const dailyLoginDays = [
  { day: 1, completed: true, type: 'check' },
  { day: 2, completed: true, type: 'check' },
  { day: 3, completed: true, type: 'check' },
  { day: 4, completed: true, type: 'check' },
  { day: 5, completed: false, type: 'gift' },
  { day: 6, completed: false, type: 'gift' },
  { day: 7, completed: false, type: 'gift' },
];

const achievementBadges = [
  { id: 1, name: 'Unlockend your badge 1', icon: '⭐', status: 'unlocked', progress: 60, type: 'gold' },
  { id: 2, name: 'Luexnited your badge 2', icon: '🏆', status: 'unlocked', progress: 45, type: 'bronze' },
  { id: 3, name: 'Lvouched your badge 3', icon: '🏆', status: 'partial', progress: 20, type: 'gold' },
  { id: 4, name: 'Comtment your badge 2', icon: '🏆', status: 'partial', progress: 15, type: 'gold' },
  { id: 5, name: 'Luxnnited your badge 3', icon: '🏆', status: 'partial', progress: 10, type: 'gold' },
  { id: 6, name: 'Ubrnntied your badge 4', icon: '🏆', status: 'partial', progress: 8, type: 'silver' },
  { id: 7, name: 'Lock aito your badge 1', icon: '🔒', status: 'locked', progress: 0, type: 'locked' },
  { id: 8, name: 'Lock atio your badge 2', icon: '🔒', status: 'locked', progress: 0, type: 'locked' },
  { id: 9, name: 'Lock atio your badge 3', icon: '🔒', status: 'locked', progress: 0, type: 'locked' },
];

export default function RewardsPage() {
  return (
    <div className="rewards-page">
      <div className="cyber-grid-bg"></div>
      <h1 className="rewards-page-title">Урамшуулал</h1>

      <div className="rewards-content">
        <div className="daily-login-section">
          <h2 className="section-title">Өдөр тутмын нэвтрэлтийн урамшуулал</h2>
          
          <div className="daily-days-grid">
            {dailyLoginDays.map((item) => (
              <div key={item.day} className="daily-day-item">
                <div className={`day-box ${item.completed ? 'completed' : 'locked'}`}>
                  {item.type === 'check' && item.completed && <span className="check-icon">✓</span>}
                  {item.type === 'gift' && <span className="gift-icon">🎁</span>}
                </div>
                <span className="day-label">
                  {item.day === 5 || item.day === 6 || item.day === 7 ? 'Өдөр' : 'Өдөр'}
                </span>
                <span className="day-number">{item.day}</span>
              </div>
            ))}
          </div>

          <div className="daily-progress-section">
            <div className="progress-info">
              <span className="progress-icon">🎁</span>
              <span className="progress-label">Өдөр тутмын урамшуулал</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: '40%' }}></div>
            </div>
            <span className="progress-text">4 / 10</span>
          </div>
        </div>

        <div className="achievement-rewards-section">
          <h2 className="section-title">Амжилтын урамшуулал</h2>
          
          <div className="achievement-grid">
            {achievementBadges.map((badge) => (
              <div key={badge.id} className={`achievement-card ${badge.status}`}>
                <div className={`badge-icon-large ${badge.type}`}>
                  {badge.icon}
                </div>
                <div className="achievement-progress">
                  <div 
                    className="achievement-progress-bar" 
                    style={{ width: `${badge.progress}%` }}
                  ></div>
                </div>
                <p className="achievement-name">{badge.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

