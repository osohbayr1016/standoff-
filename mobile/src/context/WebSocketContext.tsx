import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { storage } from '../lib/storage';

interface ChatMessage {
    id: string;
    userId: string;
    username: string;
    avatar?: string;
    content: string;
    timestamp: number;
    lobbyId?: string;
    type?: 'user' | 'system';
}

interface WebSocketContextType {
    socket: WebSocket | null;
    sendMessage: (message: any) => void;
    lastMessage: any;
    messageLog: any[];
    isConnected: boolean;
    registerUser: (userId: string) => void;
    requestMatchState: (lobbyId: string) => void;
    leaveMatch: (userId: string, lobbyId?: string) => void;
    sendChat: (content: string, lobbyId?: string) => void;
    chatMessages: ChatMessage[];
    lobbyChatMessages: ChatMessage[];
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider = ({ children, url }: { children: ReactNode; url: string }) => {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [lastMessage, setLastMessage] = useState<any>(null);
    const [messageLog, setMessageLog] = useState<any[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [lobbyChatMessages, setLobbyChatMessages] = useState<ChatMessage[]>([]);

    const reconnectTimeoutRef = useRef<any>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const userIdRef = useRef<string | null>(null);

    const connect = useCallback(() => {
        if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const normalizedBaseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        const wsUrl = normalizedBaseUrl.startsWith('http') ? normalizedBaseUrl.replace('http', 'ws') : normalizedBaseUrl;
        console.log(`Connecting to WebSocket: ${wsUrl}/ws`);

        const ws = new WebSocket(`${wsUrl}/ws`);
        socketRef.current = ws;

        ws.onopen = async () => {
            console.log('WebSocket Connected');
            setIsConnected(true);
            setSocket(ws);

            if (userIdRef.current) {
                const userStr = await storage.getItem('user');
                const user = userStr ? JSON.parse(userStr) : {};
                ws.send(JSON.stringify({
                    type: 'REGISTER',
                    userId: userIdRef.current,
                    username: user.username,
                    avatar: user.avatar,
                    elo: user.elo
                }));
            }
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type !== 'PONG') console.log("WS Message Received:", data.type);
                setLastMessage(data);

                if (data.type === 'CHAT_MESSAGE') {
                    if (data.message.lobbyId) {
                        setLobbyChatMessages(prev => [...prev.slice(-49), data.message]);
                    } else {
                        setChatMessages(prev => [...prev.slice(-49), data.message]);
                    }
                } else if (data.type === 'CHAT_HISTORY') {
                    setChatMessages(data.messages);
                } else if (data.type === 'LOBBY_CHAT_HISTORY') {
                    setLobbyChatMessages(data.messages);
                }

                setMessageLog(prev => {
                    const newLog = [...prev, { direction: 'IN', data, timestamp: new Date().toISOString() }];
                    return newLog.slice(-50);
                });
            } catch (e) {
                console.error('Failed to parse WS message', event.data);
            }
        };

        ws.onclose = () => {
            console.log('WebSocket Disconnected');
            setIsConnected(false);
            setSocket(null);
            socketRef.current = null;

            reconnectTimeoutRef.current = setTimeout(() => {
                connect();
            }, 3000);
        };

        ws.onerror = (error: any) => {
            console.log('WebSocket Error:', error.message || error);
            // WebSocket errors in RN are simplified
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

    const sendMessage = useCallback((message: any) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify(message));
        }
    }, []);

    const registerUser = useCallback(async (userId: string) => {
        userIdRef.current = userId;
        const userStr = await storage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : {};
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'REGISTER',
                userId,
                username: user.username,
                avatar: user.avatar,
                elo: user.elo
            }));
        }
    }, []);

    const sendChat = useCallback((content: string, lobbyId?: string) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'SEND_CHAT',
                content,
                lobbyId
            }));
        }
    }, []);

    const requestMatchState = useCallback(async (lobbyId: string) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            const userStr = await storage.getItem('user');
            const user = userStr ? JSON.parse(userStr) : {};
            socketRef.current.send(JSON.stringify({
                type: 'REQUEST_MATCH_STATE',
                lobbyId,
                userId: user.id
            }));
        }
    }, []);

    const leaveMatch = useCallback((userId: string, lobbyId?: string) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'LEAVE_MATCH',
                userId,
                lobbyId
            }));
        }
    }, []);

    return (
        <WebSocketContext.Provider value={{
            socket,
            sendMessage,
            lastMessage,
            messageLog,
            isConnected,
            registerUser,
            requestMatchState,
            leaveMatch,
            sendChat,
            chatMessages,
            lobbyChatMessages
        }}>
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
