import { useState, useEffect } from 'react';
import { useWebSocket } from './WebSocketContext';
import './ModeratorPage.css';

interface Lobby {
    id: string;
    playerCount: number;
    players: Array<{ id: string; username: string }>;
    status: string;
    map: string;
    createdAt: number;
}

interface User {
    id: string;
    discord_username: string;
    discord_avatar: string | null;
    role: string;
    mmr: number;
    wins: number;
    losses: number;
    banned: number;
}

interface SystemStats {
    totalUsers: number;
    queueCount: number;
    activeMatches: number;
    onlineUsers: number;
}

export default function ModeratorPage() {
    const { lastMessage, sendMessage } = useWebSocket();
    const [activeTab, setActiveTab] = useState<'lobbies' | 'users' | 'queue' | 'stats'>('stats');
    const [lobbies, setLobbies] = useState<Lobby[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState<SystemStats>({ totalUsers: 0, queueCount: 0, activeMatches: 0, onlineUsers: 0 });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);

    useEffect(() => {
        // Request initial data
        sendMessage({ type: 'GET_SYSTEM_STATS' });
        sendMessage({ type: 'GET_ALL_LOBBIES' });
    }, []);

    useEffect(() => {
        if (!lastMessage) return;

        if (lastMessage.type === 'ALL_LOBBIES_DATA') {
            setLobbies(lastMessage.lobbies || []);
        }

        if (lastMessage.type === 'ALL_USERS_DATA') {
            setUsers(lastMessage.users || []);
            setTotalUsers(lastMessage.total || 0);
        }

        if (lastMessage.type === 'SYSTEM_STATS_DATA') {
            setStats(lastMessage.stats);
        }

        if (lastMessage.type === 'CANCEL_MATCH_SUCCESS' || lastMessage.type === 'BAN_USER_SUCCESS' ||
            lastMessage.type === 'UNBAN_USER_SUCCESS' || lastMessage.type === 'CHANGE_ROLE_SUCCESS') {
            // Refresh data
            sendMessage({ type: 'GET_ALL_LOBBIES' });
            sendMessage({ type: 'GET_ALL_USERS', page: currentPage });
            sendMessage({ type: 'GET_SYSTEM_STATS' });
        }
    }, [lastMessage]);

    const handleCancelMatch = (lobbyId: string) => {
        if (confirm('Are you sure you want to cancel this match?')) {
            sendMessage({ type: 'FORCE_CANCEL_MATCH', lobbyId });
        }
    };

    const handleBanUser = (userId: string) => {
        if (confirm('Are you sure you want to ban this user?')) {
            sendMessage({ type: 'BAN_USER', targetUserId: userId });
        }
    };

    const handleUnbanUser = (userId: string) => {
        sendMessage({ type: 'UNBAN_USER', targetUserId: userId });
    };

    const handleChangeRole = (userId: string, newRole: string) => {
        if (confirm(`Change user role to ${newRole}?`)) {
            sendMessage({ type: 'CHANGE_USER_ROLE', targetUserId: userId, newRole });
        }
    };

    const handleNuclearReset = () => {
        if (confirm('⚠️ NUCLEAR RESET: This will cancel all matches and clear the queue. Are you absolutely sure?')) {
            sendMessage({ type: 'RESET_MATCH' });
        }
    };

    const loadUsers = (page: number) => {
        setCurrentPage(page);
        sendMessage({ type: 'GET_ALL_USERS', page });
    };

    return (
        <div className="moderator-container">
            <div className="moderator-header">
                <h1 className="moderator-title">🛡️ MODERATOR DASHBOARD</h1>
                <button className="nuclear-btn" onClick={handleNuclearReset}>
                    ⚠️ NUCLEAR RESET
                </button>
            </div>

            <div className="tab-nav">
                <button className={activeTab === 'stats' ? 'tab-active' : ''} onClick={() => setActiveTab('stats')}>
                    📊 System Stats
                </button>
                <button className={activeTab === 'lobbies' ? 'tab-active' : ''} onClick={() => { setActiveTab('lobbies'); sendMessage({ type: 'GET_ALL_LOBBIES' }); }}>
                    🎮 Active Lobbies ({stats.activeMatches})
                </button>
                <button className={activeTab === 'users' ? 'tab-active' : ''} onClick={() => { setActiveTab('users'); loadUsers(1); }}>
                    👥 Users ({stats.totalUsers})
                </button>
                <button className={activeTab === 'queue' ? 'tab-active' : ''} onClick={() => setActiveTab('queue')}>
                    ⏳ Queue ({stats.queueCount})
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'stats' && (
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-value">{stats.totalUsers}</div>
                            <div className="stat-label">Total Users</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.onlineUsers}</div>
                            <div className="stat-label">Online Now</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.activeMatches}</div>
                            <div className="stat-label">Active Matches</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.queueCount}</div>
                            <div className="stat-label">In Queue</div>
                        </div>
                    </div>
                )}

                {activeTab === 'lobbies' && (
                    <div className="lobbies-section">
                        {lobbies.length === 0 ? (
                            <p className="empty-message">No active lobbies</p>
                        ) : (
                            <table className="moderator-table">
                                <thead>
                                    <tr>
                                        <th>Lobby ID</th>
                                        <th>Players</th>
                                        <th>Status</th>
                                        <th>Map</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lobbies.map(lobby => (
                                        <tr key={lobby.id}>
                                            <td className="mono">{lobby.id.slice(0, 8)}</td>
                                            <td>{lobby.playerCount}/10</td>
                                            <td><span className={`status-badge ${lobby.status.toLowerCase()}`}>{lobby.status}</span></td>
                                            <td>{lobby.map}</td>
                                            <td>
                                                <button className="danger-btn-small" onClick={() => handleCancelMatch(lobby.id)}>Cancel</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="users-section">
                        <table className="moderator-table">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Role</th>
                                    <th>ELO</th>
                                    <th>W/L</th>
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
                                                    alt="avatar"
                                                    className="user-avatar-small"
                                                />
                                            )}
                                            {user.discord_username}
                                        </td>
                                        <td>
                                            <select
                                                value={user.role}
                                                onChange={(e) => handleChangeRole(user.id, e.target.value)}
                                                className="role-select"
                                            >
                                                <option value="user">User</option>
                                                <option value="moderator">Moderator</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </td>
                                        <td>{user.mmr || 1000}</td>
                                        <td>{user.wins || 0}/{user.losses || 0}</td>
                                        <td>{user.banned === 1 ? <span className="banned-badge">BANNED</span> : <span className="active-badge">Active</span>}</td>
                                        <td>
                                            {user.banned === 1 ? (
                                                <button className="success-btn-small" onClick={() => handleUnbanUser(user.id)}>Unban</button>
                                            ) : (
                                                <button className="danger-btn-small" onClick={() => handleBanUser(user.id)}>Ban</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="pagination">
                            <button disabled={currentPage === 1} onClick={() => loadUsers(currentPage - 1)}>Previous</button>
                            <span>Page {currentPage} / {Math.ceil(totalUsers / 50)}</span>
                            <button disabled={currentPage * 50 >= totalUsers} onClick={() => loadUsers(currentPage + 1)}>Next</button>
                        </div>
                    </div>
                )}

                {activeTab === 'queue' && (
                    <div className="queue-section">
                        <p className="empty-message">Queue viewer coming soon... (Current count: {stats.queueCount})</p>
                    </div>
                )}
            </div>
        </div>
    );
}
