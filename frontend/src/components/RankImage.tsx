import { getRankImagePathFromElo } from '../utils/rankUtils';
import './RankImage.css';

interface RankImageProps {
  elo: number;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export default function RankImage({ elo, size = 'medium', className = '' }: RankImageProps) {
  const imagePath = getRankImagePathFromElo(elo);
  const sizeClass = `rank-image-${size}`;

  return (
    <img
      src={imagePath}
      alt={`Rank ${elo}`}
      className={`rank-image ${sizeClass} ${className}`}
      onError={(e) => {
        // Fallback to a placeholder or hide on error
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
      }}
    />
  );
}



