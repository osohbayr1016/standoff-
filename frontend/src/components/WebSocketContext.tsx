import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';

interface WebSocketContextType {
    socket: WebSocket | null;
    sendMessage: (message: any) => void;
    lastMessage: any;
    isConnected: boolean;
    registerUser: (userId: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider = ({ children, url }: { children: ReactNode; url: string }) => {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [lastMessage, setLastMessage] = useState<any>(null);
    const [isConnected, setIsConnected] = useState(false);
    // use 'any' for timeout ref to avoid NodeJS vs Window timeout type issues
    const reconnectTimeoutRef = useRef<any>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const userIdRef = useRef<string | null>(null);

    const connect = useCallback(() => {
        if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
            return;
        }

        // Determine correct WS URL based on protocol
        // Strip trailing slash from url to avoid double slashes when adding /ws
        const normalizedBaseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        const wsUrl = normalizedBaseUrl.startsWith('http') ? normalizedBaseUrl.replace('http', 'ws') : normalizedBaseUrl;
        console.log(`Connecting to WebSocket: ${wsUrl}/ws`);

        const ws = new WebSocket(`${wsUrl}/ws`);
        socketRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket Connected');
            console.log('Registering user ID:', userIdRef.current);
            setIsConnected(true);
            setSocket(ws);

            // Auto-register if we have a user ID stored
            if (userIdRef.current) {
                ws.send(JSON.stringify({ type: 'REGISTER', userId: userIdRef.current }));
            }
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("WS Message Received:", data); // DEBUG LOG
                setLastMessage(data);
            } catch (e) {
                console.error('Failed to parse WS message', event.data);
            }
        };

        ws.onclose = () => {
            console.log('WebSocket Disconnected');
            setIsConnected(false);
            setSocket(null);
            socketRef.current = null;

            // Reconnect after 3 seconds
            reconnectTimeoutRef.current = setTimeout(() => {
                connect();
            }, 3000);
        };

        ws.onerror = (error) => {
            console.error('WebSocket Error', error);
            ws.close();
        };
    }, [url]);

    useEffect(() => {
        connect();

        return () => {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (socketRef.current) socketRef.current.close();
        };
    }, [connect]);

    // Memoize sendMessage so it doesn't change on every render
    const sendMessage = useCallback((message: any) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            console.log("Sending WS Message:", message); // DEBUG LOG
            socketRef.current.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket not connected, message dropped:', message);
        }
    }, []);

    // Memoize registerUser so it doesn't change on every render
    const registerUser = useCallback((userId: string) => {
        userIdRef.current = userId;
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            console.log("Registering User via open socket:", userId);
            socketRef.current.send(JSON.stringify({ type: 'REGISTER', userId }));
        }
    }, []);

    return (
        <WebSocketContext.Provider value={{ socket, sendMessage, lastMessage, isConnected, registerUser }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
};
