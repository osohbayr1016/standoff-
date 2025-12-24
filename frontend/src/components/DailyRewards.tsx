import './DailyRewards.css';

const rewardProgress = [
  { icon: '✓', label: 'Day', completed: true },
  { icon: '✓', label: 'Day', completed: true },
  { icon: '🎁', label: 'Proox', completed: false },
  { icon: '🎁', label: 'Days', completed: false },
  { icon: '🎁', label: 'ИИΞИ', completed: false },
];

export default function DailyRewards() {
  return (
    <div className="rewards-card">
      <h3 className="card-title">Daily Rewards Progress</h3>
      
      <div className="rewards-progress">
        {rewardProgress.map((reward, index) => (
          <div key={index} className="reward-item">
            <div className={`reward-icon ${reward.completed ? 'completed' : ''}`}>
              {reward.icon}
            </div>
            <span className="reward-label">{reward.label}</span>
            {index < rewardProgress.length - 1 && <div className="progress-connector"></div>}
          </div>
        ))}
      </div>

      <div className="rewards-section">
        <div className="rewards-header">
          <span className="rewards-icon">🎁</span>
          <span className="rewards-title">Daily Rewards</span>
        </div>
        <div className="rewards-counter">4 / 10</div>
      </div>

      <button className="find-match-btn-secondary">Find Match</button>
    </div>
  );
}

