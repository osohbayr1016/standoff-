import React, { useState, useRef, useEffect } from 'react';
import { useWebSocket } from './WebSocketContext';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, User, MessageCircle, Minimize2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


interface ChatProps {
    lobbyId?: string;
    isMobile?: boolean;
    title?: string;
    placeholder?: string;
    variant?: 'floating' | 'inline';
}

const Chat: React.FC<ChatProps> = ({
    lobbyId,
    title = "Глобал Чаат",
    placeholder = "Мессеж бичих...",
    variant = 'floating'
}) => {
    const { sendChat, chatMessages, lobbyChatMessages, isConnected } = useWebSocket();
    const [inputValue, setInputValue] = useState('');
    const [isMinimized, setIsMinimized] = useState(variant === 'floating');
    const scrollRef = useRef<HTMLDivElement>(null);

    const messages = lobbyId ? lobbyChatMessages : chatMessages;

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isMinimized]);

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim() || !isConnected) return;

        sendChat(inputValue.trim(), lobbyId);
        setInputValue('');
    };

    if (variant === 'floating' && isMinimized) {
        return (
            <button
                onClick={() => setIsMinimized(false)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 border-4 border-background"
            >
                <MessageCircle className="w-6 h-6" />
                {messages.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-background">
                        {messages.length > 9 ? '9+' : messages.length}
                    </span>
                )}
            </button>
        );
    }

    const containerClasses = variant === 'floating'
        ? "fixed bottom-6 right-6 w-[350px] h-[450px] bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-5 duration-300"
        : "w-full h-[500px] bg-[#1c1e22] border border-white/5 rounded-xl flex flex-col overflow-hidden";

    return (
        <div className={containerClasses}>
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-800/50">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    <h3 className="font-bold text-sm uppercase tracking-wider text-white/90">
                        {lobbyId ? `Лобби Чаат` : title}
                    </h3>
                </div>
                {variant === 'floating' && (
                    <button
                        onClick={() => setIsMinimized(true)}
                        className="p-1 hover:bg-white/10 rounded-md transition-colors text-white/50 hover:text-white"
                    >
                        <Minimize2 className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Messages Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
            >
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 opacity-20">
                        <MessageCircle className="w-12 h-12" />
                        <p className="text-sm font-medium">Одоогоор мессеж байхгүй байна</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <Avatar className="h-8 w-8 border border-white/10 shrink-0">
                                <AvatarImage src={`https://cdn.discordapp.com/avatars/${msg.userId}/${msg.avatar}.png`} />
                                <AvatarFallback className="bg-zinc-800 text-[10px]"><User className="w-4 h-4" /></AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-xs font-bold text-primary truncate">
                                        {msg.username}
                                    </span>
                                    <span className="text-[10px] text-white/30">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="bg-white/5 rounded-2xl rounded-tl-none px-3 py-2 text-sm text-white/80 break-words border border-white/5 inline-block max-w-full">
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 bg-zinc-800/30">
                <div className="relative flex items-center gap-2">
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={placeholder}
                        disabled={!isConnected}
                        className="bg-zinc-900/50 border-white/10 focus-visible:ring-primary h-11 pr-12 rounded-xl text-sm"
                    />
                    <Button
                        type="submit"
                        size="icon"
                        disabled={!inputValue.trim() || !isConnected}
                        className="absolute right-1 w-9 h-9 rounded-lg bg-primary hover:bg-primary/90 transition-all active:scale-95"
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default Chat;
