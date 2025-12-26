import React, { useState, useEffect } from 'react';
import { useWebSocket } from './WebSocketContext';
import './LobbyDetailPage.css';

interface MatchPlayer {
    player_id: string;
    team: string;
    discord_username?: string;
    discord_avatar?: string;
    elo?: number;
    standoff_nickname?: string;
    role?: string;
}

interface Match {
    id: string;
    lobby_url: string;
    host_id: string;
    host_username?: string;
    host_avatar?: string;
    status: string;
    player_count: number;
    max_players: number;
    map_name?: string;
    created_at: string;
}

interface LobbyDetailPageProps {
    matchId: string;
    user: {
        id: string;
        username: string;
        avatar?: string;
    } | null;
    backendUrl: string;
    onBack: () => void;
}

const LobbyDetailPage: React.FC<LobbyDetailPageProps> = ({ matchId, user, backendUrl, onBack }) => {
    const { lastMessage } = useWebSocket();
    const [match, setMatch] = useState<Match | null>(null);
    const [players, setPlayers] = useState<MatchPlayer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submittingResult, setSubmittingResult] = useState(false);
    // Screenshot handling TODO: Add R2 upload
    const [winnerTeam, setWinnerTeam] = useState<'alpha' | 'bravo'>('alpha');

    // Fetch match details
    const fetchMatchDetails = async () => {
        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}`);
            const data = await response.json();
            if (data.success) {
                setMatch(data.match);
                setPlayers(data.players || []);
            } else {
                setError(data.error || 'Failed to load match');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMatchDetails();
        const interval = setInterval(fetchMatchDetails, 5000);
        return () => clearInterval(interval);
    }, [matchId, backendUrl]);

    // Handle WebSocket updates
    useEffect(() => {
        if (lastMessage) {
            try {
                const msg = JSON.parse(lastMessage);
                if (msg.type === 'LOBBY_UPDATED' && msg.matchId === matchId) {
                    fetchMatchDetails();
                }
            } catch (e) { }
        }
    }, [lastMessage]);

    // Leave lobby
    const handleLeaveLobby = async () => {
        if (!user) return;

        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}/leave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: user.id })
            });

            const data = await response.json();
            if (data.success) {
                onBack();
            } else {
                alert(data.error || 'Failed to leave');
            }
        } catch (err) {
            alert('Network error');
        }
    };

    // Start match (host only)
    const handleStartMatch = async () => {
        if (!user || !match) return;

        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host_id: user.id,
                    status: 'in_progress'
                })
            });

            const data = await response.json();
            if (data.success) {
                fetchMatchDetails();
            } else {
                alert(data.error || 'Failed to start match');
            }
        } catch (err) {
            alert('Network error');
        }
    };

    // Submit result
    const handleSubmitResult = async () => {
        if (!user || !match) return;
        setSubmittingResult(true);

        try {
            // For now, just update status to pending_review
            // Screenshot upload would need R2 integration
            const response = await fetch(`${backendUrl}/api/matches/${matchId}/result`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    submitter_id: user.id,
                    winner_team: winnerTeam,
                    screenshot_url: '' // TODO: Upload to R2
                })
            });

            const data = await response.json();
            if (data.success) {
                alert('Result submitted! Waiting for moderator review.');
                fetchMatchDetails();
            } else {
                alert(data.error || 'Failed to submit result');
            }
        } catch (err) {
            alert('Network error');
        } finally {
            setSubmittingResult(false);
        }
    };

    if (loading) {
        return (
            <div className="lobby-detail-page">
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Loading lobby...</p>
                </div>
            </div>
        );
    }

    if (error || !match) {
        return (
            <div className="lobby-detail-page">
                <div className="error-container">
                    <h2>❌ Error</h2>
                    <p>{error || 'Match not found'}</p>
                    <button onClick={onBack} className="back-btn">← Back to Lobbies</button>
                </div>
            </div>
        );
    }

    const isHost = user?.id === match.host_id;
    const isInMatch = players.some(p => p.player_id === user?.id);
    const alphaPlayers = players.filter(p => p.team === 'alpha');
    const bravoPlayers = players.filter(p => p.team === 'bravo');

    return (
        <div className="lobby-detail-page">
            <div className="lobby-detail-container">
                <div className="lobby-header">
                    <button onClick={onBack} className="back-btn">← Back</button>
                    <div className="lobby-title">
                        <h1>Lobby #{match.id.slice(0, 8)}</h1>
                        <span className={`status-badge ${match.status}`}>{match.status.replace('_', ' ')}</span>
                    </div>
                </div>

                {/* Host Info */}
                <div className="host-section">
                    <div className="host-info">
                        {match.host_avatar && (
                            <img
                                src={`https://cdn.discordapp.com/avatars/${match.host_id}/${match.host_avatar}.png`}
                                alt=""
                                className="host-avatar"
                            />
                        )}
                        <div>
                            <span className="host-label">Host</span>
                            <span className="host-name">{match.host_username || 'Unknown'}</span>
                        </div>
                    </div>
                    {match.map_name && (
                        <div className="map-info">
                            <span className="map-label">Map</span>
                            <span className="map-name">{match.map_name}</span>
                        </div>
                    )}
                </div>

                {/* Open in Standoff 2 Button */}
                {isInMatch && (
                    <a
                        href={match.lobby_url}
                        className="standoff-btn"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        🎮 Open in Standoff 2
                    </a>
                )}

                {/* Teams */}
                <div className="teams-section">
                    <div className="team alpha-team">
                        <h3>Team Alpha ({alphaPlayers.length}/5)</h3>
                        <div className="players-list">
                            {alphaPlayers.map(player => (
                                <div key={player.player_id} className="player-item">
                                    {player.discord_avatar && (
                                        <img
                                            src={`https://cdn.discordapp.com/avatars/${player.player_id}/${player.discord_avatar}.png`}
                                            alt=""
                                            className="player-avatar"
                                        />
                                    )}
                                    <div className="player-details">
                                        <div className="player-name-row">
                                            <span className="player-name">
                                                {player.standoff_nickname || player.discord_username || 'Player'}
                                            </span>
                                            {player.role === 'admin' && <span className="role-badge admin">ADMIN</span>}
                                            {player.role === 'moderator' && <span className="role-badge mod">MOD</span>}
                                        </div>
                                        <div className="player-elo">{player.elo || 1000} ELO</div>
                                    </div>
                                </div>
                            ))}
                            {Array(5 - alphaPlayers.length).fill(0).map((_, i) => (
                                <div key={`empty-alpha-${i}`} className="player-item empty">
                                    <span>Empty Slot</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="vs-divider">VS</div>

                    <div className="team bravo-team">
                        <h3>Team Bravo ({bravoPlayers.length}/5)</h3>
                        <div className="players-list">
                            {bravoPlayers.map(player => (
                                <div key={player.player_id} className="player-item">
                                    {player.discord_avatar && (
                                        <img
                                            src={`https://cdn.discordapp.com/avatars/${player.player_id}/${player.discord_avatar}.png`}
                                            alt=""
                                            className="player-avatar"
                                        />
                                    )}
                                    <div className="player-details">
                                        <div className="player-name-row">
                                            <span className="player-name">
                                                {player.standoff_nickname || player.discord_username || 'Player'}
                                            </span>
                                            {player.role === 'admin' && <span className="role-badge admin">ADMIN</span>}
                                            {player.role === 'moderator' && <span className="role-badge mod">MOD</span>}
                                        </div>
                                        <div className="player-elo">{player.elo || 1000} ELO</div>
                                    </div>
                                </div>
                            ))}
                            {Array(5 - bravoPlayers.length).fill(0).map((_, i) => (
                                <div key={`empty-bravo-${i}`} className="player-item empty">
                                    <span>Empty Slot</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="actions-section">
                    {match.status === 'waiting' && (
                        <>
                            {isHost && (
                                <button
                                    className="action-btn start"
                                    onClick={handleStartMatch}
                                    disabled={players.length < 2}
                                >
                                    🚀 Start Match
                                </button>
                            )}
                            {isInMatch && (
                                <button className="action-btn leave" onClick={handleLeaveLobby}>
                                    Leave Lobby
                                </button>
                            )}
                        </>
                    )}

                    {match.status === 'in_progress' && isInMatch && (
                        <div className="result-form">
                            <h3>Submit Match Result</h3>
                            <div className="form-group">
                                <label>Winner Team:</label>
                                <select value={winnerTeam} onChange={e => setWinnerTeam(e.target.value as 'alpha' | 'bravo')}>
                                    <option value="alpha">Team Alpha</option>
                                    <option value="bravo">Team Bravo</option>
                                </select>
                            </div>
                            <button
                                className="action-btn submit"
                                onClick={handleSubmitResult}
                                disabled={submittingResult}
                            >
                                {submittingResult ? 'Submitting...' : '📤 Submit Result'}
                            </button>
                        </div>
                    )}

                    {match.status === 'pending_review' && (
                        <div className="pending-notice">
                            <p>⏳ Waiting for moderator review...</p>
                        </div>
                    )}

                    {match.status === 'completed' && (
                        <div className="completed-notice">
                            <p>✅ Match completed!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LobbyDetailPage;
