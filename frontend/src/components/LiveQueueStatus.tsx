import { useEffect, useState } from 'react';
import './LiveQueueStatus.css';

interface QueueData {
    success: boolean;
    queueCount: number;
    players: any[];
}

function LiveQueueStatus() {
    const [queueData, setQueueData] = useState<QueueData>({
        success: false,
        queueCount: 0,
        players: []
    });
    const [loading, setLoading] = useState(true);

    // Дараалалын статусыг татах функц
    const fetchQueueStatus = async () => {
        try {
            const response = await fetch('https://backend.anandoctane4.workers.dev/api/queue-status');
            const data = await response.json();
            setQueueData(data);
            setLoading(false);
        } catch (error) {
            console.error('Queue status fetch error:', error);
            setLoading(false);
        }
    };

    // Анхны ачаалал болон 5 секунд тутамд шинэчлэх
    useEffect(() => {
        fetchQueueStatus();
        const interval = setInterval(fetchQueueStatus, 5000); // 5 секунд тутамд
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="live-queue-status">
            <div className="queue-header">
                <h3>🎮 Live Queue Status</h3>
                <span className="live-indicator">● LIVE</span>
            </div>

            <div className="queue-count">
                {loading ? (
                    <div className="loading">Loading...</div>
                ) : (
                    <>
                        <div className="count-display">
                            <span className="current-count">{queueData.queueCount}</span>
                            <span className="separator">/</span>
                            <span className="max-count">10</span>
                        </div>
                        <p className="count-label">Players in Queue</p>
                    </>
                )}
            </div>

            {queueData.queueCount > 0 && (
                <div className="queue-players">
                    <p className="players-label">Waiting Players:</p>
                    <div className="players-list">
                        {queueData.players.slice(0, 5).map((player: any, index: number) => (
                            <div key={index} className="player-item">
                                <span className="player-number">#{index + 1}</span>
                                <span className="player-name">{player.username || player.id}</span>
                            </div>
                        ))}
                        {queueData.queueCount > 5 && (
                            <div className="more-players">
                                +{queueData.queueCount - 5} more...
                            </div>
                        )}
                    </div>
                </div>
            )}

            {queueData.queueCount === 0 && !loading && (
                <div className="empty-queue">
                    <p>No players in queue</p>
                    <p className="empty-hint">Be the first to join!</p>
                </div>
            )}
        </div>
    );
}

export default LiveQueueStatus;
