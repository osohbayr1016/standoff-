import './MapBanHistory.css';

interface BanHistoryItem {
  team: string;
  map: string;
  timestamp: Date;
}

interface MapBanHistoryProps {
  banHistory: BanHistoryItem[];
  alphaTeamName: string;
  bravoTeamName: string;
}

export default function MapBanHistory({
  banHistory,
  alphaTeamName,
  bravoTeamName,
}: MapBanHistoryProps) {
  if (banHistory.length === 0) return null;

  return (
    <div className="map-ban-history">
      <h3 className="ban-history-title">Хориглолтын түүх</h3>
      <div className="ban-history-list">
        {banHistory.map((ban, index) => {
          const banTeamName = ban.team === 'alpha' ? alphaTeamName : bravoTeamName;
          return (
            <div key={index} className="ban-history-item">
              <div
                className={`ban-team-indicator ${
                  ban.team === 'alpha' ? 'team-alpha' : 'team-bravo'
                }`}
              />
              <span className="ban-history-text">
                {banTeamName} хориглосон{' '}
                <span className="ban-map-name">{ban.map}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

