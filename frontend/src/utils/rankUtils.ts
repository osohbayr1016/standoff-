/**
 * ELO Rank Utility Functions
 * Based on FACEIT MONGOLIA Profile Ranks (ELO) system
 */

/**
 * Get rank number (1-10) based on ELO score
 * @param elo - Player's ELO score
 * @returns Rank number from 1 to 10
 */
export function getRankFromElo(elo: number): number {
  if (elo <= 0) return 1;
  if (elo <= 800) return 1;
  if (elo <= 950) return 2;
  if (elo <= 1100) return 3;
  if (elo <= 1250) return 4;
  if (elo <= 1400) return 5;
  if (elo <= 1550) return 6;
  if (elo <= 1700) return 7;
  if (elo <= 1850) return 8;
  if (elo <= 2000) return 9;
  return 10; // 2001+
}

/**
 * Get the image path for a rank
 * @param rank - Rank number (1-10)
 * @returns Path to the rank image
 */
export function getRankImagePath(rank: number): string {
  const validRank = Math.max(1, Math.min(10, Math.floor(rank)));
  return `/rank-${validRank}.png`;
}

/**
 * Get rank image path directly from ELO
 * @param elo - Player's ELO score
 * @returns Path to the rank image
 */
export function getRankImagePathFromElo(elo: number): string {
  const rank = getRankFromElo(elo);
  return getRankImagePath(rank);
}



