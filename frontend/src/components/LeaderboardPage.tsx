import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "./WebSocketContext";
import "./LeaderboardPage.css";

interface LeaderboardEntry {
  rank: number;
  id: string;
  discord_id: string;
  username: string;
  avatar?: string;
  nickname?: string;
  elo: number;
  wins: number;
  losses: number;
}

type FilterType = "elo" | "winrate" | "matches";

const CACHE_KEY = "leaderboard_cache";
const CACHE_TIMESTAMP_KEY = "leaderboard_cache_timestamp";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [filteredLeaderboard, setFilteredLeaderboard] = useState<
    LeaderboardEntry[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("elo");
  const { lastMessage, sendMessage, isConnected } = useWebSocket();

  // Move applyFilter declaration up before it is used
  const applyFilter = useCallback((data: LeaderboardEntry[], filter: FilterType) => {
    let sorted = [...data];

    switch (filter) {
      case "elo":
        sorted.sort((a, b) => b.elo - a.elo);
        break;
      case "winrate":
        sorted.sort((a, b) => {
          const winrateA =
            a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
          const winrateB =
            b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
          return winrateB - winrateA;
        });
        break;
      case "matches":
        sorted.sort((a, b) => {
          const matchesA = a.wins + a.losses;
          const matchesB = b.wins + b.losses;
          return matchesB - matchesA;
        });
        break;
    }

    // Recalculate ranks after sorting
    const ranked = sorted.map((player, index) => ({
      ...player,
      rank: index + 1,
    }));

    setFilteredLeaderboard(ranked);
  }, []);

  // Load cached data immediately on mount
  useEffect(() => {
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cacheTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

    if (cachedData && cacheTimestamp) {
      const age = Date.now() - parseInt(cacheTimestamp);
      if (age < CACHE_DURATION) {
        const parsed = JSON.parse(cachedData);
        setLeaderboard(parsed);
        applyFilter(parsed, activeFilter);
        setLoading(false);
      }
    }

    // Fetch fresh data via HTTP
    fetchLeaderboard();

    // Request via WebSocket if connected
    if (isConnected) {
      sendMessage({ type: 'REQUEST_LEADERBOARD' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Request leaderboard when WebSocket connects
  useEffect(() => {
    if (isConnected) {
      sendMessage({ type: 'REQUEST_LEADERBOARD' });
    }
  }, [isConnected, sendMessage]);

  // Listen for real-time leaderboard updates via WebSocket
  useEffect(() => {
    if (lastMessage?.type === "LEADERBOARD_UPDATE") {
      console.log("Real-time leaderboard update received");
      const updatedData = lastMessage.data;
      setLeaderboard(updatedData);
      applyFilter(updatedData, activeFilter);

      // Update cache
      localStorage.setItem(CACHE_KEY, JSON.stringify(updatedData));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    }
  }, [lastMessage, activeFilter, applyFilter]);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"}/api/leaderboard`
      );
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
        applyFilter(data, activeFilter);

        // Cache the data
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
      }
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    if (leaderboard.length > 0) {
      applyFilter(leaderboard, activeFilter);
    }
  }, [activeFilter, leaderboard, applyFilter]);

  if (loading && filteredLeaderboard.length === 0) {
    return (
      <div className="leaderboard-page">
        <div className="loading-container">
          <div className="cyber-spinner"></div>
          <div className="loading-text">
            ЧАНСААНЫ МЭДЭЭЛЛИЙН САНД ХАНДАЖ БАЙНА...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-header">
        <h1 className="cyber-title">СЕРВЕРИЙН ТОП 500 ТОГЛОГЧ</h1>
        <div className="cyber-subtitle">СЕРВЕРИЙН ЧАНСАА</div>
      </div>

      <div className="leaderboard-filters">
        <button
          className={`filter-btn ${activeFilter === "elo" ? "active" : ""}`}
          onClick={() => setActiveFilter("elo")}
        >
          <span className="filter-icon">⚡</span>
          <span className="filter-text">ХАМГИЙН ӨНДӨР ELO</span>
        </button>
        <button
          className={`filter-btn ${activeFilter === "winrate" ? "active" : ""}`}
          onClick={() => setActiveFilter("winrate")}
        >
          <span className="filter-icon">📊</span>
          <span className="filter-text">ХАМГИЙН ӨНДӨР ХОЖЛЫН ХУВЬ</span>
        </button>
        <button
          className={`filter-btn ${activeFilter === "matches" ? "active" : ""}`}
          onClick={() => setActiveFilter("matches")}
        >
          <span className="filter-icon">🎯</span>
          <span className="filter-text">ХАМГИЙН ОЛОН ТОГЛОЛТ</span>
        </button>
      </div>

      <div className="leaderboard-container">
        <div className="leaderboard-table-header">
          <div className="header-rank">БАЙР</div>
          <div className="header-player">ТОГЛОГЧ</div>
          <div className="header-elo">ELO</div>
          <div className="header-stats mobile-hide">Х / Х</div>
          <div className="header-winrate mobile-hide">ХОЖЛЫН ХУВЬ</div>
        </div>

        <div className="leaderboard-list">
          {filteredLeaderboard.map((player) => {
            const winRate =
              player.wins + player.losses > 0
                ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)
                : "0.0";

            return (
              <div
                key={player.id}
                className={`leaderboard-row rank-${player.rank <= 3 ? player.rank : "other"}`}
              >
                <div className="rank-cell">
                  {player.rank === 1 && (
                    <span className="rank-icon gold">🥇</span>
                  )}
                  {player.rank === 2 && (
                    <span className="rank-icon silver">🥈</span>
                  )}
                  {player.rank === 3 && (
                    <span className="rank-icon bronze">🥉</span>
                  )}
                  <span className="rank-number">#{player.rank}</span>
                </div>

                <div className="player-cell">
                  <div className="player-avatar">
                    {player.avatar ? (
                      <img
                        src={`https://cdn.discordapp.com/avatars/${player.discord_id}/${player.avatar}.png`}
                        alt=""
                      />
                    ) : (
                      <div className="avatar-placeholder">
                        {player.username?.[0]}
                      </div>
                    )}
                  </div>
                  <div className="player-info">
                    <div className="player-nickname">
                      {player.nickname || player.username}
                    </div>
                    {player.nickname && (
                      <div className="player-discord">@{player.username}</div>
                    )}
                  </div>
                </div>

                <div className="elo-cell">
                  {player.elo}
                </div>

                <div className="stats-cell mobile-hide">
                  <span className="wins">{player.wins}</span> / <span className="losses">{player.losses}</span>
                </div>

                <div className="winrate-cell mobile-hide">
                  <div className="winrate-bar-bg">
                    <div
                      className="winrate-bar-fill"
                      style={{ width: `${winRate}%` }}
                    ></div>
                  </div>
                  <span className="winrate-text">{winRate}%</span>
                </div>
              </div>
            );
          })}

          {filteredLeaderboard.length === 0 && (
            <div className="no-data">ЧАНСААНЫ МЭДЭЭЛЭЛ БАЙХГҮЙ</div>
          )}
        </div>
      </div>
    </div>
  );
}
