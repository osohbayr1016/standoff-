import { useState, useEffect } from 'react';
import { useWebSocket } from './WebSocketContext';
import './ModeratorPage.css';

interface PendingMatch {
    id: string;
    lobby_url: string;
    host_id: string;
    host_username?: string;
    host_avatar?: string;
    status: string;
    player_count: number;
    result_screenshot_url?: string;
    winner_team?: string;
    alpha_score?: number;
    bravo_score?: number;
    created_at: string;
    updated_at: string;
}

interface MatchPlayer {
    player_id: string;
    team: string;
    discord_username: string;
    discord_avatar?: string;
    standoff_nickname?: string;
    elo: number;
}

interface User {
    id: string;
    discord_username: string;
    discord_avatar: string | null;
    role: string;
    elo: number;
    mmr?: number;
    wins: number;
    losses: number;
    banned: number;
}

interface EloHistoryEntry {
    id: number;
    match_id: string;
    elo_before: number;
    elo_after: number;
    elo_change: number;
    reason: string;
    created_at: string;
    result_screenshot_url?: string;
}

interface ModeratorStats {
    totalPlayers: number;
    waitingMatches: number;
    activeMatches: number;
    pendingReviews: number;
    completedMatches: number;
    bannedPlayers: number;
}

interface ModeratorPageProps {
    user: { id: string } | null;
    backendUrl: string;
}

export default function ModeratorPage({ user, backendUrl }: ModeratorPageProps) {
    const { } = useWebSocket(); // WebSocket available for future realtime updates
    const [activeTab, setActiveTab] = useState<'pending' | 'players' | 'stats' | 'active'>('pending');
    const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState<ModeratorStats | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [, setTotalUsers] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMatch, setSelectedMatch] = useState<PendingMatch | null>(null);
    const [matchPlayers, setMatchPlayers] = useState<MatchPlayer[]>([]);
    const [reviewWinner, setReviewWinner] = useState<'alpha' | 'bravo'>('alpha');
    const [eloChange, setEloChange] = useState(25);
    const [reviewNotes, setReviewNotes] = useState('');
    const [processing, setProcessing] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<User | null>(null);
    const [playerHistory, setPlayerHistory] = useState<EloHistoryEntry[]>([]);
    const [manualEloChange, setManualEloChange] = useState(0);
    const [manualReason, setManualReason] = useState('');

    // Fetch stats
    const fetchStats = async () => {
        try {
            const response = await fetch(`${backendUrl}/api/moderator/stats`, {
                headers: { 'X-User-Id': user?.id || '' }
            });
            const data = await response.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    // Fetch pending reviews
    const fetchPendingReviews = async () => {
        try {
            const response = await fetch(`${backendUrl}/api/moderator/pending-reviews`, {
                headers: { 'X-User-Id': user?.id || '' }
            });
            const data = await response.json();
            if (data.success) {
                setPendingMatches(data.matches);
            }
        } catch (err) {
            console.error('Error fetching pending reviews:', err);
        }
    };

    // Fetch players
    const fetchPlayers = async (page: number, search?: string) => {
        try {
            let url = `${backendUrl}/api/moderator/players?page=${page}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;

            const response = await fetch(url, {
                headers: { 'X-User-Id': user?.id || '' }
            });
            const data = await response.json();
            if (data.success) {
                setUsers(data.players);
                setTotalUsers(data.total);
            }
        } catch (err) {
            console.error('Error fetching players:', err);
        }
    };

    // Fetch match details for review
    const fetchMatchDetails = async (matchId: string) => {
        try {
            const response = await fetch(`${backendUrl}/api/moderator/matches/${matchId}`, {
                headers: { 'X-User-Id': user?.id || '' }
            });
            const data = await response.json();
            if (data.success) {
                setSelectedMatch(data.match);
                setMatchPlayers(data.players);
                setReviewWinner(data.match.winner_team || 'alpha');
            }
        } catch (err) {
            console.error('Error fetching match details:', err);
        }
    };

    // Fetch player history
    const fetchPlayerHistory = async (playerId: string) => {
        try {
            const response = await fetch(`${backendUrl}/api/moderator/players/${playerId}/history`, {
                headers: { 'X-User-Id': user?.id || '' }
            });
            const data = await response.json();
            if (data.success) {
                setSelectedPlayer(data.player);
                setPlayerHistory(data.eloHistory);
            }
        } catch (err) {
            console.error('Error fetching player history:', err);
        }
    };

    useEffect(() => {
        fetchStats();
        fetchPendingReviews();
    }, [backendUrl, user]);

    // Review match
    const handleReviewMatch = async (approved: boolean) => {
        if (!selectedMatch) return;
        setProcessing(true);

        try {
            const response = await fetch(`${backendUrl}/api/moderator/matches/${selectedMatch.id}/review`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user?.id || ''
                },
                body: JSON.stringify({
                    approved,
                    winner_team: reviewWinner,
                    elo_change: eloChange,
                    notes: reviewNotes
                })
            });

            const data = await response.json();
            if (data.success) {
                setSelectedMatch(null);
                setMatchPlayers([]);
                fetchPendingReviews();
                fetchStats();
            } else {
                alert(data.error || 'Failed to review match');
            }
        } catch (err) {
            alert('Network error');
        } finally {
            setProcessing(false);
        }
    };

    // Manual ELO adjustment
    const handleManualEloAdjust = async () => {
        if (!selectedPlayer || manualEloChange === 0 || !manualReason) return;
        setProcessing(true);

        try {
            const response = await fetch(`${backendUrl}/api/moderator/players/${selectedPlayer.id}/elo-adjust`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user?.id || ''
                },
                body: JSON.stringify({
                    elo_change: manualEloChange,
                    reason: manualReason
                })
            });

            const data = await response.json();
            if (data.success) {
                alert(`ELO adjusted: ${data.previousElo} → ${data.newElo}`);
                setManualEloChange(0);
                setManualReason('');
                fetchPlayerHistory(selectedPlayer.id);
            } else {
                alert(data.error || 'Failed to adjust ELO');
            }
        } catch (err) {
            alert('Network error');
        } finally {
            setProcessing(false);
        }
    };

    // Ban/Unban
    const handleBanToggle = async (playerId: string, ban: boolean) => {
        try {
            const endpoint = ban ? 'ban' : 'unban';
            const response = await fetch(`${backendUrl}/api/moderator/players/${playerId}/${endpoint}`, {
                method: 'POST',
                headers: { 'X-User-Id': user?.id || '' }
            });
            const data = await response.json();
            if (data.success) {
                fetchPlayers(currentPage, searchQuery);
            }
        } catch (err) {
            alert('Network error');
        }
    };

    const alphaPlayers = matchPlayers.filter(p => p.team === 'alpha');
    const bravoPlayers = matchPlayers.filter(p => p.team === 'bravo');

    return (
        <div className="moderator-container">
            <div className="moderator-header">
                <h1 className="moderator-title">🛡️ MODERATOR DASHBOARD</h1>
            </div>

            <div className="tab-nav">
                <button
                    className={activeTab === 'pending' ? 'tab-active' : ''}
                    onClick={() => { setActiveTab('pending'); fetchPendingReviews(); }}
                >
                    📋 Pending Reviews ({stats?.pendingReviews || 0})
                </button>
                <button
                    className={activeTab === 'active' ? 'tab-active' : ''}
                    onClick={() => setActiveTab('active')}
                >
                    🎮 Active Matches ({stats?.activeMatches || 0})
                </button>
                <button
                    className={activeTab === 'players' ? 'tab-active' : ''}
                    onClick={() => { setActiveTab('players'); fetchPlayers(1); }}
                >
                    👥 Players ({stats?.totalPlayers || 0})
                </button>
                <button
                    className={activeTab === 'stats' ? 'tab-active' : ''}
                    onClick={() => { setActiveTab('stats'); fetchStats(); }}
                >
                    📊 Statistics
                </button>
            </div>

            <div className="tab-content">
                {/* Pending Reviews Tab */}
                {activeTab === 'pending' && (
                    <div className="pending-section">
                        {pendingMatches.length === 0 ? (
                            <p className="empty-message">✅ No matches pending review</p>
                        ) : (
                            <div className="pending-grid">
                                {pendingMatches.map(match => (
                                    <div key={match.id} className="pending-card" onClick={() => fetchMatchDetails(match.id)}>
                                        <div className="pending-header">
                                            <span className="match-id">#{match.id.slice(0, 8)}</span>
                                            <span className="player-count">{match.player_count} players</span>
                                        </div>
                                        {match.result_screenshot_url && (
                                            <img
                                                src={match.result_screenshot_url}
                                                alt="Result"
                                                className="pending-screenshot"
                                            />
                                        )}
                                        <div className="pending-info">
                                            <p>Host: {match.host_username || 'Unknown'}</p>
                                            <p>Submitted: {new Date(match.updated_at).toLocaleString()}</p>
                                        </div>
                                        <button className="review-btn">Review →</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Stats Tab */}
                {activeTab === 'stats' && stats && (
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-value">{stats.totalPlayers}</div>
                            <div className="stat-label">Total Players</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.waitingMatches}</div>
                            <div className="stat-label">Waiting Lobbies</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.activeMatches}</div>
                            <div className="stat-label">Active Matches</div>
                        </div>
                        <div className="stat-card warning">
                            <div className="stat-value">{stats.pendingReviews}</div>
                            <div className="stat-label">Pending Reviews</div>
                        </div>
                        <div className="stat-card success">
                            <div className="stat-value">{stats.completedMatches}</div>
                            <div className="stat-label">Completed Matches</div>
                        </div>
                        <div className="stat-card danger">
                            <div className="stat-value">{stats.bannedPlayers}</div>
                            <div className="stat-label">Banned Players</div>
                        </div>
                    </div>
                )}

                {/* Players Tab */}
                {activeTab === 'players' && (
                    <div className="players-section">
                        <div className="search-bar">
                            <input
                                type="text"
                                placeholder="Search by username..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchPlayers(1, searchQuery)}
                            />
                            <button onClick={() => fetchPlayers(1, searchQuery)}>Search</button>
                        </div>

                        <table className="moderator-table">
                            <thead>
                                <tr>
                                    <th>Player</th>
                                    <th>ELO</th>
                                    <th>W/L</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => (
                                    <tr key={user.id} className={user.banned === 1 ? 'banned-row' : ''}>
                                        <td className="user-cell">
                                            {user.discord_avatar && (
                                                <img
                                                    src={`https://cdn.discordapp.com/avatars/${user.id}/${user.discord_avatar}.png`}
                                                    alt=""
                                                    className="user-avatar-small"
                                                />
                                            )}
                                            {user.discord_username}
                                        </td>
                                        <td>{user.elo || user.mmr || 1000}</td>
                                        <td>{user.wins}/{user.losses}</td>
                                        <td><span className={`role-badge ${user.role}`}>{user.role}</span></td>
                                        <td>{user.banned === 1 ? <span className="banned-badge">BANNED</span> : <span className="active-badge">Active</span>}</td>
                                        <td>
                                            <button className="info-btn-small" onClick={() => fetchPlayerHistory(user.id)}>History</button>
                                            {user.banned === 1 ? (
                                                <button className="success-btn-small" onClick={() => handleBanToggle(user.id, false)}>Unban</button>
                                            ) : (
                                                <button className="danger-btn-small" onClick={() => handleBanToggle(user.id, true)}>Ban</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="pagination">
                            <button disabled={currentPage === 1} onClick={() => { setCurrentPage(p => p - 1); fetchPlayers(currentPage - 1, searchQuery); }}>Previous</button>
                            <span>Page {currentPage}</span>
                            <button disabled={users.length < 50} onClick={() => { setCurrentPage(p => p + 1); fetchPlayers(currentPage + 1, searchQuery); }}>Next</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Match Review Modal */}
            {selectedMatch && (
                <div className="modal-overlay" onClick={() => setSelectedMatch(null)}>
                    <div className="review-modal" onClick={e => e.stopPropagation()}>
                        <h2>Review Match #{selectedMatch.id.slice(0, 8)}</h2>

                        {selectedMatch.result_screenshot_url && (
                            <div className="screenshot-preview">
                                <img src={selectedMatch.result_screenshot_url} alt="Match Result" />
                            </div>
                        )}

                        <div className="teams-preview">
                            <div className="team-column alpha">
                                <h3>Team Alpha</h3>
                                {alphaPlayers.map(p => (
                                    <div key={p.player_id} className="player-row">
                                        <span>{p.discord_username}</span>
                                        <span className="elo">{p.elo}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="team-column bravo">
                                <h3>Team Bravo</h3>
                                {bravoPlayers.map(p => (
                                    <div key={p.player_id} className="player-row">
                                        <span>{p.discord_username}</span>
                                        <span className="elo">{p.elo}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="review-form">
                            <div className="form-row">
                                <label>Winner Team:</label>
                                <select value={reviewWinner} onChange={e => setReviewWinner(e.target.value as 'alpha' | 'bravo')}>
                                    <option value="alpha">Team Alpha</option>
                                    <option value="bravo">Team Bravo</option>
                                </select>
                            </div>

                            <div className="form-row">
                                <label>ELO Change:</label>
                                <input
                                    type="number"
                                    value={eloChange}
                                    onChange={e => setEloChange(parseInt(e.target.value) || 0)}
                                    min="1"
                                    max="100"
                                />
                            </div>

                            <div className="form-row">
                                <label>Notes:</label>
                                <textarea
                                    value={reviewNotes}
                                    onChange={e => setReviewNotes(e.target.value)}
                                    placeholder="Optional notes..."
                                />
                            </div>
                        </div>

                        <div className="review-actions">
                            <button className="reject-btn" onClick={() => handleReviewMatch(false)} disabled={processing}>
                                ❌ Reject
                            </button>
                            <button className="approve-btn" onClick={() => handleReviewMatch(true)} disabled={processing}>
                                ✅ Approve & Apply ELO
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Player History Modal */}
            {selectedPlayer && (
                <div className="modal-overlay" onClick={() => setSelectedPlayer(null)}>
                    <div className="history-modal" onClick={e => e.stopPropagation()}>
                        <h2>Player: {selectedPlayer.discord_username}</h2>
                        <p>Current ELO: <strong>{selectedPlayer.elo || selectedPlayer.mmr || 1000}</strong></p>

                        <div className="manual-adjust">
                            <h3>Manual ELO Adjustment</h3>
                            <div className="adjust-form">
                                <input
                                    type="number"
                                    value={manualEloChange}
                                    onChange={e => setManualEloChange(parseInt(e.target.value) || 0)}
                                    placeholder="Amount (+/-)"
                                />
                                <input
                                    type="text"
                                    value={manualReason}
                                    onChange={e => setManualReason(e.target.value)}
                                    placeholder="Reason"
                                />
                                <button onClick={handleManualEloAdjust} disabled={processing || !manualReason}>
                                    Apply
                                </button>
                            </div>
                        </div>

                        <h3>ELO History</h3>
                        <div className="history-list">
                            {playerHistory.length === 0 ? (
                                <p>No history available</p>
                            ) : (
                                playerHistory.map(entry => (
                                    <div key={entry.id} className={`history-entry ${entry.elo_change >= 0 ? 'positive' : 'negative'}`}>
                                        <span className="change">{entry.elo_change >= 0 ? '+' : ''}{entry.elo_change}</span>
                                        <span className="reason">{entry.reason}</span>
                                        <span className="date">{new Date(entry.created_at).toLocaleDateString()}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        <button className="close-btn" onClick={() => setSelectedPlayer(null)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}
