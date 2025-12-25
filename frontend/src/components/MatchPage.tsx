import { useState } from 'react';
import './MatchPage.css';

interface MatchPageProps {
    serverInfo?: {
        ip?: string;
        password?: string;
        matchId?: string;
    };
    mapName?: string;
    onGoHome: () => void;
}

export default function MatchPage({ serverInfo, mapName, onGoHome }: MatchPageProps) {
    const [copied, setCopied] = useState<string | null>(null);

    const handleCopy = (text: string, type: string) => {
        navigator.clipboard.writeText(text);
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
    };

    const connectCommand = `connect ${serverInfo?.ip}${serverInfo?.password ? `; password ${serverInfo.password}` : ''}`;

    return (
        <div className="match-page">
            <div className="cyber-grid-bg"></div>

            <div className="match-content">
                <div className="match-header">
                    <h1 className="match-title">MATCH READY</h1>
                    <div className="match-subtitle">MAP: <span className="highlight">{mapName || 'UNKNOWN'}</span></div>
                </div>

                <div className="server-card">
                    <div className="server-status">
                        <span className="status-dot"></span> SYSTEM ONLINE
                    </div>

                    <div className="server-info-grid">
                        <div className="info-group">
                            <label>SERVER IP</label>
                            <div className="code-box" onClick={() => serverInfo?.ip && handleCopy(serverInfo.ip, 'ip')}>
                                {serverInfo?.ip || 'Connecting...'}
                                <span className="copy-icon">{copied === 'ip' ? '✓' : '❐'}</span>
                            </div>
                        </div>

                        {serverInfo?.password && (
                            <div className="info-group">
                                <label>PASSWORD</label>
                                <div className="code-box" onClick={() => handleCopy(serverInfo.password!, 'pass')}>
                                    {serverInfo.password}
                                    <span className="copy-icon">{copied === 'pass' ? '✓' : '❐'}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="connect-command-section">
                        <label>CONSOLE COMMAND</label>
                        <div className="command-box" onClick={() => handleCopy(connectCommand, 'cmd')}>
                            <code>{connectCommand}</code>
                            <span className="copy-hint">{copied === 'cmd' ? 'COPIED!' : 'CLICK TO COPY'}</span>
                        </div>
                    </div>
                </div>

                <div className="match-actions">
                    <a
                        href={`steam://connect/${serverInfo?.ip}/${serverInfo?.password ? serverInfo.password : ''}`}
                        className="connect-btn cyber-button-primary"
                    >
                        <span className="btn-content">CONNECT (STEAM)</span>
                        <div className="btn-glitch"></div>
                    </a>

                    <a
                        href={`standoff://connect/${serverInfo?.ip}/${serverInfo?.password ? serverInfo.password : ''}`}
                        className="connect-btn cyber-button-secondary"
                        style={{ marginTop: '1rem', background: 'rgba(255, 166, 0, 0.2)', borderColor: 'orange', color: 'orange' }}
                    >
                        <span className="btn-content">CUSTOM LINK</span>
                    </a>

                    <button className="back-btn cyber-button-secondary" onClick={onGoHome}>
                        RETURN TO MENU
                    </button>
                </div>
            </div>
        </div>
    );
}
