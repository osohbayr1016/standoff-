export const loginWithDiscord = () => {
    const clientID = "1453495820585533480";
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8787";
    // Trim trailing slash if present to avoid double slashes
    const cleanBackendUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;

    const redirectUri = encodeURIComponent(`${cleanBackendUrl}/api/auth/callback`);
    const scope = encodeURIComponent("identify email guilds.members.read");

    window.location.href = `https://discord.com/oauth2/authorize?client_id=${clientID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    window.location.href = `https://discord.com/oauth2/authorize?client_id=${clientID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
};

import { useState, useEffect } from 'react';

export const useAuth = () => {
    const [user, setUser] = useState<any>(null);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        const savedUser = localStorage.getItem("user");
        if (savedUser) {
            try {
                const parsed = JSON.parse(savedUser);
                setUser(parsed);
                // In this app, we treat the user ID as the session token (based on analysis)
                setToken(parsed.id);
            } catch (e) {
                console.error("Failed to parse user", e);
            }
        }
    }, []);

    return { user, token };
};
