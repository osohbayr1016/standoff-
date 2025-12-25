import { useState, useEffect } from 'react';
import './DailyRewards.css';

interface RewardDay {
  icon: string;
  label: string;
  completed: boolean;
}

export default function DailyRewards() {
  const [rewardProgress, setRewardProgress] = useState<RewardDay[]>([]);
  const [completedDays, setCompletedDays] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch daily rewards progress from backend
    // For now, use placeholder data since daily rewards API doesn't exist yet
    const fetchDailyRewards = async () => {
      try {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {


          // TODO: Create /api/rewards endpoint in backend
          // For now, show placeholder with 0 completed days
          const completed = 0;
          const totalDays = 10;

          const progress: RewardDay[] = Array.from({ length: totalDays }, (_, index) => ({
            icon: index < completed ? '✓' : '🎁',
            label: `Day ${index + 1}`,
            completed: index < completed
          }));

          setRewardProgress(progress);
          setCompletedDays(completed);
        }
      } catch (err) {
        console.error('Error fetching daily rewards:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDailyRewards();
  }, []);

  if (loading) {
    return (
      <div className="rewards-card">
        <h3 className="card-title">Daily Rewards Progress</h3>
        <div className="rewards-progress">
          <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rewards-card">
      <h3 className="card-title">Өдөр тутмын урамшууллын явц</h3>

      <div className="rewards-progress">
        {rewardProgress.length > 0 ? (
          rewardProgress.map((reward, index) => (
            <div key={index} className="reward-item">
              <div className={`reward-icon ${reward.completed ? 'completed' : ''}`}>
                {reward.icon}
              </div>
              <span className="reward-label">{reward.label}</span>
              {index < rewardProgress.length - 1 && <div className="progress-connector"></div>}
            </div>
          ))
        ) : (
          <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>
            No rewards available
          </div>
        )}
      </div>

      <div className="rewards-section">
        <div className="rewards-header">
          <span className="rewards-icon">🎁</span>
          <span className="rewards-title">Өдөр тутмын урамшуулал</span>
        </div>
        <div className="rewards-counter">{completedDays} / {rewardProgress.length || 10}</div>
      </div>

      <button className="find-match-btn-secondary">УРАМШУУЛАЛ АВАХ</button>
    </div>
  );
}

