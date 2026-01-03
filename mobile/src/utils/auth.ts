import { FRONTEND_URL, BACKEND_URL } from "../lib/constants";

export const getDiscordLoginUrl = () => {
    const clientID = "1453495820585533480";
    // Redirect to the same backend callback, which redirects to FRONTEND_URL
    // We will intercept the redirect to FRONTEND_URL in the WebView
    // DOMAIN MUST MATCH DISCORD WHITELIST (localhost:8787), even on Android.
    // The WebView interceptor will catch the failure to load 'localhost' on Android and extract params.
    const redirectUri = encodeURIComponent(`http://localhost:8787/api/auth/callback`);
    const scope = encodeURIComponent("identify email guilds.members.read");
    
    return `https://discord.com/oauth2/authorize?client_id=${clientID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
};
