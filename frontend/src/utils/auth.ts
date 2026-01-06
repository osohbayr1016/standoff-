export const loginWithDiscord = () => {
    const clientID = "1453495820585533480";
    // Forced fallback to production to fix "Invalid URI" error since local secrets are missing
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://backend.anandoctane4.workers.dev";
    console.log("🔧 Auth Debug - Backend URL:", backendUrl);
    // Trim trailing slash if present to avoid double slashes
    const cleanBackendUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;

    const redirectUri = encodeURIComponent(`${cleanBackendUrl}/api/auth/callback`);
    const scope = encodeURIComponent("identify email guilds.members.read");

    const authUrl = `https://discord.com/oauth2/authorize?client_id=${clientID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    console.log("🔐 OAuth Redirect:", authUrl);
    window.location.href = authUrl;
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
