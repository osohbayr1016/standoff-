# NeatQueue Credentials Guide

Based on the official NeatQueue API documentation, here's exactly what you need:

## Required Credentials

### 1. **NEATQUEUE_API_KEY**
- **Where to get**: NeatQueue Dashboard → Settings/API section
- **Format**: `Bearer token` (e.g., `nq_abc123xyz...`)
- **Used for**: API authentication

### 2. **DISCORD_SERVER_ID**
- **How to get**:
  1. Enable Discord Developer Mode: User Settings → Advanced → Developer Mode (ON)
  2. Right-click your Discord server icon
  3. Click "Copy Server ID"
- **Format**: Long number (e.g., `987654321098765432`)

### 3. **DISCORD_CHANNEL_ID**
- **How to get**:
  1. Make sure Developer Mode is enabled (see above)
  2. Right-click your queue channel (where NeatQueue bot posts)
  3. Click "Copy Channel ID"
- **Format**: Long number (e.g., `123456789012345678`)

## Setting Up

### For Local Development (`.dev.vars`):
```env
NEATQUEUE_API_KEY=your_api_key_here
DISCORD_SERVER_ID=your_server_id
DISCORD_CHANNEL_ID=your_channel_id
```

### For Production (Cloudflare Workers):
```bash
cd backend

# Set API Key
npx wrangler secret put NEATQUEUE_API_KEY
# Paste your API key when prompted

# Set Server ID
npx wrangler secret put DISCORD_SERVER_ID
# Paste your server ID

# Set Channel ID
npx wrangler secret put DISCORD_CHANNEL_ID
# Paste your channel ID
```

## API Endpoints Used

Based on the official OpenAPI spec:

1. **Queue Status**: `GET /api/v1/queue/{channel_id}/players`
2. **Leaderboard**: `GET /api/v2/leaderboard/{server_id}/{channel_id}`
3. **Player Stats**: `GET /api/v1/playerstats/{server_id}/{player_id}`

All requests require:
```
Authorization: Bearer YOUR_API_KEY
```

## Next Steps

1. ✅ Get your credentials from Discord and NeatQueue
2. ✅ Add them to `.dev.vars` for local testing
3. ✅ Deploy backend: `npx wrangler deploy`
4. ✅ Test the endpoints!
