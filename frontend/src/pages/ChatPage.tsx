import React from 'react';
import { Card } from "@/components/ui/card";

const ChatPage: React.FC = () => {
    return (
        <div className="container mx-auto px-4 py-8 h-[calc(100vh-80px)]">
            <Card className="w-full h-full bg-[#121418] border-[#1e2024] overflow-hidden flex flex-col shadow-2xl relative">

                {/* Header */}
                <div className="p-4 border-b border-[#1e2024] bg-[#0E0F12] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-8 bg-[#ff5500] rounded-full" />
                        <h1 className="text-xl font-bold text-white uppercase tracking-wider">
                            Server Chat
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <a
                            href="https://discord.com/channels/1452635831901753357/1453403861275508948"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded text-sm font-bold transition-all"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2c-1.7 0-3 1.2-3 2.6v6.8c0 1.4 1.3 2.6 3 2.6s3-1.2 3-2.6V4.6C15 3.2 13.7 2 12 2z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" /></svg>
                            Join Voice
                        </a>
                        <div className="text-xs text-gray-500 font-mono">
                            #general
                        </div>
                    </div>
                </div>

                <iframe
                    src="https://e.widgetbot.io/channels/1452635831901753357/1462707689263075473"
                    className="w-full h-full border-none bg-[#121418]"
                    title="Discord Chat"
                    allow="clipboard-write; fullscreen"
                />

                {/* Helper overlay if bot not invited (visually hints user might see nothing) */}
                {/* We can't detect iframe error easily cross-origin, but we can instruct the admin */}
            </Card>
        </div>
    );
};

export default ChatPage;
