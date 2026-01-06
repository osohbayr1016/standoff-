import { create } from 'zustand';

interface WebSocketMessage {
    type: string;
    [key: string]: any;
}

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

interface WebSocketState {
    socket: WebSocket | null;
    isConnected: boolean;
    lastMessage: WebSocketMessage | null;
    messageLog: any[];
    messageQueue: any[]; // Buffered messages
    chatMessages: ChatMessage[];
    lobbyChatMessages: ChatMessage[];
    registeredUserId: string | null;

    connect: (url: string) => void;
    disconnect: () => void;
    sendMessage: (message: any) => void;

    // Helpers
    registerUser: (userId: string) => void;
    requestMatchState: (lobbyId: string) => void;
    leaveMatch: (userId: string, lobbyId?: string) => void;
    sendChat: (content: string, lobbyId?: string) => void;
}

export const useWebSocketStore = create<WebSocketState>((set, get) => {
    let reconnectTimeout: any = null;
    let socketInstance: WebSocket | null = null;

    return {
        socket: null,
        isConnected: false,
        lastMessage: null,
        messageLog: [],
        messageQueue: [],
        chatMessages: [],
        lobbyChatMessages: [],
        registeredUserId: null,

        connect: (url: string) => {
            // Normalize URL
            const normalizedBaseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
            const wsUrl = normalizedBaseUrl.startsWith('http') ? normalizedBaseUrl.replace('http', 'ws') : normalizedBaseUrl;
            const fullUrl = `${wsUrl}/ws`;

            if (socketInstance && (socketInstance.readyState === WebSocket.OPEN || socketInstance.readyState === WebSocket.CONNECTING)) {
                return;
            }

            console.log(`Connecting to WebSocket: ${fullUrl}`);
            const ws = new WebSocket(fullUrl);
            socketInstance = ws;

            ws.onopen = () => {
                console.log('WebSocket Connected');
                set({ isConnected: true, socket: ws });

                // Flush Message Queue
                const state = get();
                if (state.messageQueue.length > 0) {
                    console.log(`Flushing ${state.messageQueue.length} buffered messages`);
                    state.messageQueue.forEach(msg => ws.send(JSON.stringify(msg)));
                    set({ messageQueue: [] });
                }

                // Auto-register if we have a user ID stored
                const currentState = get();
                if (currentState.registeredUserId) {
                    const user = JSON.parse(localStorage.getItem('user') || '{}');
                    ws.send(JSON.stringify({
                        type: 'REGISTER',
                        userId: currentState.registeredUserId,
                        username: user.username,
                        avatar: user.avatar,
                        elo: user.elo
                    }));
                }
            };

            ws.onclose = () => {
                console.log('WebSocket Disconnected');
                set({ isConnected: false, socket: null });
                socketInstance = null;

                // Reconnect after 3 seconds
                if (reconnectTimeout) clearTimeout(reconnectTimeout);
                reconnectTimeout = setTimeout(() => {
                    get().connect(url);
                }, 3000);
            };

            ws.onerror = (error) => {
                console.error('WebSocket Error:', error);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // Chat Messages
                    if (data.type === 'CHAT_MESSAGE') {
                        const isLobby = !!data.message.lobbyId;
                        if (isLobby) {
                            set(state => ({ lobbyChatMessages: [...state.lobbyChatMessages.slice(-49), data.message] }));
                        } else {
                            set(state => ({ chatMessages: [...state.chatMessages.slice(-49), data.message] }));
                        }
                    }
                    else if (data.type === 'CHAT_HISTORY') {
                        set({ chatMessages: data.messages });
                    }
                    else if (data.type === 'LOBBY_CHAT_HISTORY') {
                        set({ lobbyChatMessages: data.messages });
                    }
                    // Other Messages (update lastMessage unless it's chat to save renders)
                    else {
                        set({ lastMessage: data });
                    }

                    // Log
                    set(state => ({
                        messageLog: [...state.messageLog, { direction: 'IN', data, timestamp: new Date().toISOString() }].slice(-50)
                    }));

                } catch (e) {
                    console.error('WebSocket Parse Error', e);
                }
            };
        },

        disconnect: () => {
            if (socketInstance) {
                socketInstance.close();
                socketInstance = null;
                set({ socket: null, isConnected: false });
            }
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
        },

        sendMessage: (message: any) => {
            const { socket } = get();
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(message));
            } else {
                console.warn('WebSocket not connected, buffering message:', message.type);
                set(state => ({ messageQueue: [...state.messageQueue, message] }));
            }
        },

        registerUser: (userId: string) => {
            set({ registeredUserId: userId });
            const { socket } = get();
            if (socket && socket.readyState === WebSocket.OPEN) {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                socket.send(JSON.stringify({
                    type: 'REGISTER',
                    userId,
                    username: user.username,
                    avatar: user.avatar,
                    elo: user.elo
                }));
            }
        },

        requestMatchState: (lobbyId: string) => {
            get().sendMessage({ type: 'REQUEST_MATCH_STATE', lobbyId });
        },

        leaveMatch: (userId: string, lobbyId: string = '') => { // lobbyId optional in interface but usually logic needs checking
            // The original context logic for leaveMatch?
            // It just sends LEAVE_MATCH?
            // Let's assume standard sendMessage usage.
            get().sendMessage({ type: 'LEAVE_MATCH', userId, lobbyId });
        },

        sendChat: (content: string, lobbyId?: string) => {
            get().sendMessage({
                type: 'SEND_CHAT',
                content,
                lobbyId
            });
        }
    };
});
