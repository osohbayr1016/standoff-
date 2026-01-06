import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useWebSocketStore } from '../stores/websocketStore';

export const WebSocketProvider = ({ children, url }: { children: ReactNode; url: string }) => {
    const connect = useWebSocketStore(state => state.connect);
    const disconnect = useWebSocketStore(state => state.disconnect);

    useEffect(() => {
        if (url) {
            connect(url);
        }
        return () => {
            disconnect();
        };
    }, [url]); // connect and disconnect are stable

    return <>{children}</>;
};

// Export hook for backward compatibility, but enables functional selectors
export const useWebSocket = useWebSocketStore;
