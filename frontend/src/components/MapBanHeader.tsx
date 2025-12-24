import './MapBanHeader.css';

interface MapBanHeaderProps {
  mapBanPhase: boolean;
  currentTeamName: string;
  selectedMap?: string;
  timeLeft?: number;
}

export default function MapBanHeader({
  mapBanPhase,
  currentTeamName,
  selectedMap,
  timeLeft,
}: MapBanHeaderProps) {
  const formatTime = (seconds: number) => {
    return `${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div className="map-ban-header">
      <h1 className="map-ban-title">Map Ban Phase</h1>
      <p className="map-ban-subtitle">
        {mapBanPhase
          ? `${currentTeamName}'s turn to ban`
          : `Selected Map: ${selectedMap || 'None'}`}
      </p>
      {mapBanPhase && timeLeft !== undefined && (
        <div className="ban-timer">
          <span className="timer-label">Time remaining:</span>
          <span className={`timer-value ${timeLeft <= 5 ? 'timer-warning' : ''}`}>
            {formatTime(timeLeft)}s
          </span>
        </div>
      )}
    </div>
  );
}

