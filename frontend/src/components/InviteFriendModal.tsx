import { useState, useEffect } from 'react';
import './InviteFriendModal.css';

interface Friend {
    id: string;
    username: string;
    nickname?: string;
    avatar?: string;
    elo: number;
}

interface InviteFriendModalProps {
    currentPartyIds: string[];
    onInvite: (friend: Friend) => void;
    onClose: () => void;
}

export default function InviteFriendModal({ currentPartyIds, onInvite, onClose }: InviteFriendModalProps) {
    const [friends, setFriends] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchFriends = async () => {
            const savedUser = localStorage.getItem('user');
            if (!savedUser) return;

            const user = JSON.parse(savedUser);

            try {
                const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787'}/api/friends/${user.id}`);
                if (res.ok) {
                    const data = await res.json();
                    // Filter only accepted friends
                    setFriends(data.friends || []);
                } else {
                    setError('Найзуудыг ачаалахад алдаа гарлаа');
                }
            } catch (err) {
                console.error('Failed to fetch friends', err);
                setError('Сүлжээний алдаа');
            } finally {
                setLoading(false);
            }
        };

        fetchFriends();
    }, []);

    // Filter friends who are NOT already in the party
    const availableFriends = friends.filter(f => !currentPartyIds.includes(f.id));

    // Helper to construct avatar URL
    const getAvatarUrl = (friend: Friend) => {
        if (friend.avatar) {
            if (friend.avatar.startsWith('http')) return friend.avatar;
            return `https://cdn.discordapp.com/avatars/${friend.id}/${friend.avatar}.png`;
        }
        return null;
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="invite-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">ТОГЛОГЧ УРИХ</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="modal-content">
                    {loading ? (
                        <div className="modal-status">СҮЛЖЭЭГ ШАЛГАЖ БАЙНА...</div>
                    ) : error ? (
                        <div className="modal-error">{error}</div>
                    ) : availableFriends.length === 0 ? (
                        <div className="modal-status">БОЛОМЖТОЙ ХАМТРАГЧ ОЛДОХГҮЙ</div>
                    ) : (
                        <div className="friends-list-compact">
                            {availableFriends.map(friend => (
                                <div key={friend.id} className="friend-item-compact">
                                    <div className="friend-avatar-small">
                                        {getAvatarUrl(friend) ? (
                                            <img src={getAvatarUrl(friend)!} alt={friend.username} />
                                        ) : (
                                            <div className="avatar-placeholder-small">{friend.username[0]}</div>
                                        )}
                                    </div>
                                    <div className="friend-info-compact">
                                        <span className="friend-name-compact">{friend.nickname || friend.username}</span>
<<<<<<< HEAD
                                        <span className="friend-elo-compact">ELO: {friend.elo}</span>
=======
                                        <span className="friend-mmr-compact">ELO: {friend.elo}</span>
>>>>>>> b37cefacd5935a9f26aa22491f4429ab5b1ef73e
                                    </div>
                                    <button className="invite-btn" onClick={() => onInvite(friend)}>
                                        УРИХ +
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* DEBUG SECTION */}
                    <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
                        <button
                            className="invite-btn"
                            style={{ width: '100%', background: '#3b82f6' }}
                            onClick={() => {
                                const user = JSON.parse(localStorage.getItem('user') || '{}');
                                if (user.id) {
                                    onInvite({ ...user, id: user.id, username: 'Myself (Debug)' });
                                }
                            }}
                        >
                            АЛДАА ЗАСВАР: ӨӨРИЙГӨӨ УРИХ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
