import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from './WebSocketContext';
import './LobbyChat.css';

interface ChatMessage {
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

interface LobbyChatProps {
  currentUserId: string;
  currentUsername: string;
}

export default function LobbyChat({ currentUserId, currentUsername }: LobbyChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [showChat, setShowChat] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { sendMessage, lastMessage } = useWebSocket();

  // Listen for chat messages from server
  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === 'CHAT_MESSAGE' && lastMessage.message) {
        setMessages((prev) => [...prev, lastMessage.message]);
      } else if (lastMessage.type === 'LOBBY_UPDATE' && lastMessage.lobby?.chatMessages) {
        // Sync chat messages from lobby state
        setMessages(lastMessage.lobby.chatMessages);
      }
    }
  }, [lastMessage]);

  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    sendMessage({
      type: 'CHAT_MESSAGE',
      userId: currentUserId,
      username: currentUsername,
      message: inputMessage
    });

    setInputMessage('');
  };

  // Detect lobby links in message
  const detectLobbyLink = (text: string): string | null => {
    // Match URLs (http/https) or common lobby link patterns
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const match = text.match(urlRegex);
    return match ? match[0] : null;
  };

  const handleLobbyLinkClick = (url: string) => {
    // Open lobby link in new tab
    window.open(url, '_blank');
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`lobby-chat-container ${showChat ? 'expanded' : 'collapsed'}`} ref={chatContainerRef}>
      <div className="chat-header" onClick={() => setShowChat(!showChat)}>
        <span className="chat-title">LOBBY CHAT</span>
        <span className="chat-toggle">{showChat ? '▼' : '▲'}</span>
      </div>
      
      {showChat && (
        <>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">No messages yet. Start the conversation!</div>
            ) : (
              messages.map((msg, index) => {
                const isCurrentUser = msg.userId === currentUserId;
                const lobbyLink = detectLobbyLink(msg.message);
                
                return (
                  <div key={index} className={`chat-message ${isCurrentUser ? 'own-message' : ''}`}>
                    <div className="message-header">
                      <span className="message-username">{msg.username}</span>
                      <span className="message-time">{formatTime(msg.timestamp)}</span>
                    </div>
                    <div className="message-content">
                      {lobbyLink ? (
                        <span>
                          {msg.message.split(lobbyLink)[0]}
                          <a 
                            href={lobbyLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="lobby-link"
                            onClick={(e) => {
                              e.preventDefault();
                              handleLobbyLinkClick(lobbyLink);
                            }}
                          >
                            {lobbyLink}
                          </a>
                          {msg.message.split(lobbyLink)[1]}
                        </span>
                      ) : (
                        <span>{msg.message}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form className="chat-input-form" onSubmit={handleSendMessage}>
            <input
              type="text"
              className="chat-input"
              placeholder="Type a message or share lobby link..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              maxLength={500}
            />
            <button type="submit" className="chat-send-btn">
              SEND
            </button>
          </form>
        </>
      )}
    </div>
  );
}

