import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from './WebSocketContext';

export default function DebugConsole() {
    const { messageLog, isConnected, sendMessage } = useWebSocket();
    const [isVisible, setIsVisible] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messageLog, isVisible]);

    if (!isVisible) {
        return (
            <div
                onClick={() => setIsVisible(true)}
                style={{
                    position: 'fixed',
                    bottom: '10px',
                    right: '10px',
                    background: 'rgba(0,0,0,0.8)',
                    color: '#0f0',
                    padding: '5px 10px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    zIndex: 9999,
                    fontSize: '10px',
                    border: '1px solid #0f0',
                    fontFamily: 'monospace'
                }}
            >
                DEBUG ({messageLog.length}) {isConnected ? '🟢' : '🔴'}
            </div>
        );
    }

    return (
        <div style={{
            position: 'fixed',
            bottom: '10px',
            right: '10px',
            width: '400px',
            height: '300px',
            background: 'rgba(0,0,0,0.95)',
            border: '1px solid #0f0',
            borderRadius: '5px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'monospace',
            boxShadow: '0 0 10px rgba(0, 255, 0, 0.2)'
        }}>
            <div style={{
                padding: '5px 10px',
                borderBottom: '1px solid #0f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(0, 50, 0, 0.5)'
            }}>
                <span style={{ color: '#0f0', fontWeight: 'bold' }}>NETWORK DEBUGGER</span>
                <div>
                    <span style={{ marginRight: '10px', fontSize: '10px' }}>
                        {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>
                    <button
                        onClick={() => sendMessage({ type: 'DEBUG_DUMP' })}
                        style={{
                            background: '#0f0',
                            color: '#000',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '10px',
                            marginRight: '10px',
                            padding: '2px 5px',
                            fontWeight: 'bold'
                        }}
                    >
                        DUMP STATE
                    </button>
                    <button
                        onClick={() => setIsVisible(false)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >▼</button>
                </div>
            </div>
            <div
                ref={scrollRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '5px',
                    fontSize: '11px',
                    color: '#ccc'
                }}
            >
                {messageLog.length === 0 && <div style={{ padding: '10px', textAlign: 'center', color: '#666' }}>No messages yet...</div>}

                {messageLog.map((log, i) => (
                    <div key={i} style={{ marginBottom: '4px', borderBottom: '1px solid #333', paddingBottom: '2px' }}>
                        <div style={{ display: 'flex', gap: '5px', marginBottom: '1px' }}>
                            <span style={{
                                color: log.direction === 'IN' ? '#4caf50' : '#2196f3',
                                fontWeight: 'bold'
                            }}>
                                {log.direction === 'IN' ? '↓ INV' : '↑ SENT'}
                            </span>
                            <span style={{ color: '#666' }}>
                                {new Date(log.timestamp).toLocaleTimeString().split(' ')[0]}
                            </span>
                            <span style={{ color: '#fff' }}>
                                {log.data.type}
                            </span>
                        </div>
                        <div style={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            paddingLeft: '10px',
                            color: '#aaa',
                            maxHeight: '100px',
                            overflow: 'hidden'
                        }}>
                            {JSON.stringify(log.data, null, 2)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
