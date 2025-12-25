import './TeamLeaderCard.css';

interface TeamLeaderCardProps {
  teamName: string;
  leaderName?: string;
  isCurrentTurn: boolean;
  teamColor: 'alpha' | 'bravo';
}

export default function TeamLeaderCard({
  teamName,
  leaderName,
  isCurrentTurn,
  teamColor,
}: TeamLeaderCardProps) {
  return (
    <div className={`team-leader-card ${teamColor} ${isCurrentTurn ? 'current-turn' : ''}`}>
      <div className="team-leader-header">
        <h3 className="team-leader-name">{teamName}</h3>
        {isCurrentTurn && <span className="turn-indicator">👑 Таны ээлж</span>}
      </div>
      {leaderName && (
        <div className="team-leader-info">
          <span className="leader-label">Удирдагч:</span>
          <span className="leader-name">{leaderName}</span>
        </div>
      )}
    </div>
  );
}

