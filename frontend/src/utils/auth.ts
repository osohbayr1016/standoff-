export const loginWithDiscord = () => {
    const clientID = "1453495820585533480";
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8787";
    // Trim trailing slash if present to avoid double slashes
    const cleanBackendUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;

    const redirectUri = encodeURIComponent(`${cleanBackendUrl}/api/auth/callback`);
    const scope = encodeURIComponent("identify email guilds.members.read");

    window.location.href = `https://discord.com/oauth2/authorize?client_id=${clientID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
};
