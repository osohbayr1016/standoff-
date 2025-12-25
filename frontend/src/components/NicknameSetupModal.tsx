
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
            setError('Нэр шаардлагатай');
            return;
        }

        if (nickname.length < 3) {
            setError('Нэр хамгийн багадаа 3 тэмдэгт байх ёстой');
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
                    setError(data.error || 'Нэр тохируулахад алдаа гарлаа');
                }
            }
        } catch (err) {
            setError('Сүлжээний алдаа гарлаа. Дахин оролдоно уу.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="nickname-modal-overlay">
            <div className="nickname-modal-content">
                <div className="modal-header">
                    <h2 className="modal-title">ТОГЛОГЧИЙН ТОХИРГОО</h2>
                    <div className="modal-subtitle">ХУВЬ ХҮНИЙ МЭДЭЭЛЭЛ ШАЛГАХ ШААРДЛАГАТАЙ</div>
                </div>

                <div className="modal-body">
                    <p className="modal-instruction">
                        <span className="highlight">Standoff 2 Платформ</span> руу үргэлжлүүлэхийн тулд
                        та тоглоомын идэвхтэй нэрээ бүртгүүлэх ёстой.
                    </p>

                    <div className="input-group">
                        <input
                            type="text"
                            className="cyber-input"
                            placeholder="НЭР ОРУУЛАХ"
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
                        {saving ? 'БОЛОВСРУУЛАЖ БАЙНА...' : 'ХУВЬ ХҮНИЙ МЭДЭЭЛЭЛ БАТЛАХ'}
                    </button>
                </div>
            </div>
        </div>
    );
}
