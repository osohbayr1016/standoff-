
import { useState } from 'react';
import './NicknameSetupModal.css';

interface NicknameSetupModalProps {
    userId: string;
    onSave: (nickname: string) => void;
}

export default function NicknameSetupModal({ userId, onSave }: NicknameSetupModalProps) {
    const [nickname, setNickname] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        if (!nickname.trim()) {
            setError('Nickname is required');
            return;
        }

        if (nickname.length < 3) {
            setError('Nickname must be at least 3 characters');
            return;
        }

        setError(null);
        setSaving(true);

        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787'}/api/profile/nickname`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, nickname })
            });

            const data = await res.json();

            if (res.ok) {
                onSave(data.nickname);
            } else {
                if (data.details) {
                    setError(data.details[0].message);
                } else {
                    setError(data.error || 'Error setting nickname');
                }
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="nickname-modal-overlay">
            <div className="nickname-modal-content">
                <div className="modal-header">
                    <h2 className="modal-title">PLAYER SETUP</h2>
                    <div className="modal-subtitle">PROFILE VERIFICATION REQUIRED</div>
                </div>

                <div className="modal-body">
                    <p className="modal-instruction">
                        To continue to <span className="highlight">Standoff 2 Platform</span>,
                        you must register your active game nickname.
                    </p>

                    <div className="input-group">
                        <input
                            type="text"
                            className="cyber-input"
                            placeholder="ENTER NICKNAME"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            disabled={saving}
                            maxLength={16}
                        />
                        {error && <div className="error-message">{error}</div>}
                    </div>
                </div>

                <div className="modal-footer">
                    <button
                        className="cyber-button-primary"
                        onClick={handleSubmit}
                        disabled={saving}
                    >
                        {saving ? 'PROCESSING...' : 'CONFIRM IDENTITY'}
                    </button>
                </div>
            </div>
        </div>
    );
}
