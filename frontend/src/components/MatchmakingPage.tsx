import React, { useState, useEffect } from 'react';
import { useWebSocket } from './WebSocketContext';
import LobbyDetailPage from './LobbyDetailPage';
import './MatchmakingPage.css';

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
    current_players?: number;
    created_at: string;
}

interface MatchmakingPageProps {
    user: {
        id: string;
        username: string;
        avatar?: string;
    } | null;
    backendUrl: string;
}

const MatchmakingPage: React.FC<MatchmakingPageProps> = ({ user, backendUrl }) => {
    const { sendMessage: _sendMessage, lastMessage } = useWebSocket();
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [lobbyUrl, setLobbyUrl] = useState('');
    const [mapName, setMapName] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [, setUserMatch] = useState<Match | null>(null);
    const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

    // Fetch matches
    const fetchMatches = async () => {
        try {
            const response = await fetch(`${backendUrl}/api/matches?status=waiting`);
            const data = await response.json();
            if (data.success) {
                setMatches(data.matches);
            }
        } catch (err) {
            console.error('Error fetching matches:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMatches();
        // Refresh every 5 seconds
        const interval = setInterval(fetchMatches, 5000);
        return () => clearInterval(interval);
    }, [backendUrl]);

    // Handle WebSocket messages for real-time updates
    useEffect(() => {
        if (lastMessage) {
            try {
                const msg = JSON.parse(lastMessage);
                if (msg.type === 'LOBBY_CREATED' || msg.type === 'LOBBY_UPDATED' || msg.type === 'PLAYER_JOINED' || msg.type === 'PLAYER_LEFT') {
                    fetchMatches();
                }
            } catch (e) { }
        }
    }, [lastMessage]);

    // Create lobby
    const handleCreateLobby = async () => {
        if (!user || !lobbyUrl.trim()) return;

        setCreating(true);
        setError(null);

        try {
            const response = await fetch(`${backendUrl}/api/matches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lobby_url: lobbyUrl.trim(),
                    host_id: user.id,
                    map_name: mapName.trim() || undefined
                })
            });

            const data = await response.json();

            if (data.success) {
                setShowCreateModal(false);
                setLobbyUrl('');
                setMapName('');
                fetchMatches();
            } else {
                setError(data.error || 'Failed to create lobby');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setCreating(false);
        }
    };

    // Join lobby
    const handleJoinLobby = async (matchId: string) => {
        if (!user) return;

        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_id: user.id
                })
            });

            const data = await response.json();

            if (data.success) {
                fetchMatches();
            } else {
                alert(data.error || 'Failed to join lobby');
            }
        } catch (err) {
            alert('Network error');
        }
    };

    // Leave lobby
    const handleLeaveLobby = async (matchId: string) => {
        if (!user) return;

        try {
            const response = await fetch(`${backendUrl}/api/matches/${matchId}/leave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_id: user.id
                })
            });

            const data = await response.json();

            if (data.success) {
                setUserMatch(null);
                fetchMatches();
            } else {
                alert(data.error || 'Failed to leave lobby');
            }
        } catch (err) {
            alert('Network error');
        }
    };

    // Start match
    const handleStartMatch = async (matchId: string) => {
        if (!user) return;

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
                fetchMatches();
            } else {
                alert(data.error || 'Failed to start match');
            }
        } catch (err) {
            alert('Network error');
        }
    };

    if (!user) {
        return (
            <div className="matchmaking-page">
                <div className="matchmaking-container">
                    <h1>🎮 Matchmaking</h1>
                    <p className="login-prompt">Please login to access matchmaking</p>
                </div>
            </div>
        );
    }

    // Show lobby detail page if a match is selected
    if (selectedMatchId) {
        return (
            <LobbyDetailPage
                matchId={selectedMatchId}
                user={user}
                backendUrl={backendUrl}
                onBack={() => {
                    setSelectedMatchId(null);
                    fetchMatches();
                }}
            />
        );
    }

    return (
        <div className="matchmaking-page">
            <div className="matchmaking-container">
                <div className="matchmaking-header">
                    <h1>🎮 Active Lobbies</h1>
                    <button
                        className="create-lobby-btn"
                        onClick={() => setShowCreateModal(true)}
                    >
                        + Create Lobby
                    </button>
                </div>

                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading lobbies...</p>
                    </div>
                ) : matches.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🎯</div>
                        <h3>No Active Lobbies</h3>
                        <p>Be the first to create a lobby!</p>
                        <button
                            className="create-lobby-btn large"
                            onClick={() => setShowCreateModal(true)}
                        >
                            Create Lobby
                        </button>
                    </div>
                ) : (
                    <div className="lobbies-grid">
                        {matches.map((match) => (
                            <div key={match.id} className="lobby-card" onClick={() => setSelectedMatchId(match.id)} style={{ cursor: 'pointer' }}>
                                <div className="lobby-header">
                                    <div className="host-info">
                                        {match.host_avatar && (
                                            <img
                                                src={`https://cdn.discordapp.com/avatars/${match.host_id}/${match.host_avatar}.png`}
                                                alt=""
                                                className="host-avatar"
                                            />
                                        )}
                                        <span className="host-name">{match.host_username || 'Unknown Host'}</span>
                                    </div>
                                    <span className={`status-badge ${match.status}`}>
                                        {match.status}
                                    </span>
                                </div>

                                <div className="lobby-info">
                                    <div className="player-count">
                                        <span className="count">{match.current_players || match.player_count}</span>
                                        <span className="separator">/</span>
                                        <span className="max">{match.max_players}</span>
                                        <span className="label">players</span>
                                    </div>
                                    {match.map_name && (
                                        <div className="map-name">
                                            🗺️ {match.map_name}
                                        </div>
                                    )}
                                </div>

                                <div className="lobby-actions">
                                    {match.host_id === user.id ? (
                                        <>
                                            <button
                                                className="action-btn start"
                                                onClick={() => handleStartMatch(match.id)}
                                                disabled={(match.current_players || match.player_count) < 2}
                                            >
                                                Start Match
                                            </button>
                                            <button
                                                className="action-btn cancel"
                                                onClick={() => handleLeaveLobby(match.id)}
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            className="action-btn join"
                                            onClick={() => handleJoinLobby(match.id)}
                                            disabled={(match.current_players || match.player_count) >= match.max_players}
                                        >
                                            Join Lobby
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Lobby Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2>Create New Lobby</h2>

                        <div className="form-group">
                            <label>Lobby URL *</label>
                            <input
                                type="text"
                                value={lobbyUrl}
                                onChange={(e) => setLobbyUrl(e.target.value)}
                                placeholder="standoff2://lobby/..."
                                className="form-input"
                            />
                            <p className="form-hint">Paste your Standoff 2 custom lobby URL</p>
                        </div>

                        <div className="form-group">
                            <label>Map Name (optional)</label>
                            <input
                                type="text"
                                value={mapName}
                                onChange={(e) => setMapName(e.target.value)}
                                placeholder="e.g. Dust, Sandstone..."
                                className="form-input"
                            />
                        </div>

                        {error && <div className="error-message">{error}</div>}

                        <div className="modal-actions">
                            <button
                                className="btn-cancel"
                                onClick={() => setShowCreateModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-create"
                                onClick={handleCreateLobby}
                                disabled={creating || !lobbyUrl.trim()}
                            >
                                {creating ? 'Creating...' : 'Create Lobby'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MatchmakingPage;
