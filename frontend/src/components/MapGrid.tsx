import './MapGrid.css';

interface MapGridProps {
  allMaps: string[];
  bannedMaps: string[];
  selectedMap?: string;
  isBanning: string | null;
  canBan: boolean;
  onMapClick: (mapName: string) => void;
  mapImages: Record<string, string>;
}

export default function MapGrid({
  allMaps,
  bannedMaps,
  selectedMap,
  isBanning,
  canBan,
  onMapClick,
  mapImages,
}: MapGridProps) {
  return (
    <div className="map-grid">
      {allMaps.map((mapName) => {
        const isBanned = bannedMaps.includes(mapName);
        const isBanningNow = isBanning === mapName;
        const isSelected = selectedMap === mapName;
        const isAvailable = !isBanned && !isSelected;

        return (
          <div
            key={mapName}
            className={`map-grid-item ${isBanned || isBanningNow
              ? 'banned'
              : isSelected
                ? 'selected'
                : canBan && isAvailable
                  ? 'available'
                  : 'disabled'
              }`}
            onClick={() => onMapClick(mapName)}
            style={{
              backgroundImage: mapImages[mapName]
                ? `url(${mapImages[mapName]})`
                : undefined,
            }}
          >
            <div
              className={`map-overlay ${isBanned || isBanningNow
                ? 'overlay-banned'
                : isSelected
                  ? 'overlay-selected'
                  : 'overlay-default'
                }`}
            />

            <div className="map-name-container">
              <p
                className={`map-name ${isBanned || isBanningNow ? 'name-banned' : 'name-normal'
                  }`}
              >
                {mapName}
              </p>
            </div>

            {(isBanned || isBanningNow) && (
              <div className="map-banned-overlay">
                <div className="banned-icon">🚫</div>
                <p className="banned-text">BANNED</p>
              </div>
            )}

            {isSelected && (
              <div className="map-selected-overlay">
                <p className="selected-text">SELECTED</p>
              </div>
            )}

            {canBan && isAvailable && (
              <div className="click-to-ban-indicator">Click to Ban</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

