# Discord OAuth 400 Error - Troubleshooting

## 🔴 Problem
Getting 400 Bad Request from Discord OAuth with `/api/v9/` in URL

## ✅ Solutions

### 1. Clear Browser Cache
The browser might be caching the old URL. Try:
- Press `Ctrl + Shift + Delete` (Windows)
- Clear "Cached images and files"
- Or use Incognito/Private mode

### 2. Hard Refresh the Page
- Press `Ctrl + F5` (Windows)
- Or `Ctrl + Shift + R`

### 3. Check Discord Developer Portal

Go to: https://discord.com/developers/applications/1453495820585533480/oauth2

Make sure:
- ✅ **Redirect URI** is exactly: `http://localhost:8787/api/auth/callback`
- ✅ No extra spaces or characters
- ✅ Click "Save Changes" after any edits

### 4. Verify OAuth2 Scopes
In Discord Portal, under OAuth2:
- ✅ Check `identify` scope
- ✅ Check `email` scope

### 5. Test the URL Manually

Copy and paste this URL in your browser (replace CLIENT_ID):
```
https://discord.com/oauth2/authorize?client_id=1453495820585533480&redirect_uri=http%3A%2F%2Flocalhost%3A8787%2Fapi%2Fauth%2Fcallback&response_type=code&scope=identify%20email
```

If this URL works, then the issue is browser cache.

### 6. Check Console for Errors
Open browser DevTools (F12) and check:
- Console tab for JavaScript errors
- Network tab to see the actual URL being called

## 🔍 Why `/api/v9/` appears?

This might be because:
1. Browser cache from previous attempts
2. Discord SDK or library adding it automatically
3. Service worker caching the old URL

## 🚀 Fresh Start Steps

1. **Stop all dev servers** (Ctrl+C in terminals)
2. **Clear browser cache completely**
3. **Close browser entirely**
4. **Restart backend**: `cd backend && npx wrangler dev`
5. **Restart frontend**: `cd frontend && npm run dev`
6. **Open in Incognito mode**: Visit http://localhost:5173
7. **Click Login with Discord**

## ✅ Expected URL
Should be:
```
https://discord.com/oauth2/authorize?client_id=...
```

NOT:
```
https://discord.com/api/oauth2/authorize?client_id=...
https://discord.com/api/v9/oauth2/authorize?client_id=...
```

## 📝 Current Code (Correct)
```typescript
window.location.href = `https://discord.com/oauth2/authorize?client_id=${clientID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
```

This is correct! The issue is likely browser cache.



