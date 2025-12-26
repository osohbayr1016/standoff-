import { useState } from 'react';
import { loginWithDiscord } from '../utils/auth';
import './JoinGatePage.css';

export default function JoinGatePage() {
    const [language, setLanguage] = useState<'mn' | 'en'>('mn'); // Default to Mongolian
    const joinLink = "https://discord.com/invite/FFCBrMACKm";

    const content = {
        mn: {
            title: "НЭВТРЭХ ЭРХГҮЙ",
            message: "Тоглолтонд оролцож, платформыг ашиглахын тулд та манай албан ёсны Discord серверт гишүүн байх ёстой.",
            steps: [
                "1. 'DISCORD-Д НЭГДЭХ' товчийг дарна уу",
                "2. Discord серверт нэгдэнэ үү",
                "3. 'Би нэгдсэн, намайг оруулаарай!' товчийг дарна уу"
            ],
            joinButton: "DISCORD-Д НЭГДЭХ",
            loginButton: "Би нэгдсэн, намайг оруулаарай!"
        },
        en: {
            title: "ACCESS DENIED",
            message: "To participate in matches and use the platform, you must be a member of our official Discord server.",
            steps: [
                "1. Click 'JOIN OUR DISCORD' button",
                "2. Join the Discord server",
                "3. Click 'I have joined, let me in!' button"
            ],
            joinButton: "JOIN OUR DISCORD",
            loginButton: "I have joined, let me in!"
        }
    };

    const currentContent = content[language];

    return (
        <div className="join-gate-container">
            <div className="gate-card">
                {/* Language Toggle */}
                <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => setLanguage('mn')}
                        style={{
                            padding: '6px 12px',
                            background: language === 'mn' ? '#FF6B35' : 'transparent',
                            color: language === 'mn' ? 'white' : '#888',
                            border: '1px solid #333',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: language === 'mn' ? 'bold' : 'normal',
                            transition: 'all 0.2s'
                        }}
                    >
                        МОН
                    </button>
                    <button
                        onClick={() => setLanguage('en')}
                        style={{
                            padding: '6px 12px',
                            background: language === 'en' ? '#FF6B35' : 'transparent',
                            color: language === 'en' ? 'white' : '#888',
                            border: '1px solid #333',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: language === 'en' ? 'bold' : 'normal',
                            transition: 'all 0.2s'
                        }}
                    >
                        ENG
                    </button>
                </div>

                <h1 className="gate-title">{currentContent.title}</h1>
                <p className="gate-message">
                    {currentContent.message}
                </p>

                {/* Step-by-step instructions */}
                <div style={{
                    margin: '24px 0',
                    padding: '16px',
                    background: 'rgba(255, 107, 53, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 107, 53, 0.3)'
                }}>
                    {currentContent.steps.map((step, index) => (
                        <p key={index} style={{
                            margin: '8px 0',
                            fontSize: '14px',
                            color: '#ddd',
                            textAlign: 'left'
                        }}>
                            {step}
                        </p>
                    ))}
                </div>

                <a
                    href={joinLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="join-discord-btn"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                    {currentContent.joinButton}
                </a>

                <button
                    onClick={loginWithDiscord}
                    className="retry-btn"
                >
                    {currentContent.loginButton}
                </button>
            </div>
        </div>
    );
}
