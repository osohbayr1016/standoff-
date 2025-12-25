# Standoff 2 Discord Bot

Discord bot for matchmaking integration with NeatQueue and the Standoff 2 web platform.

## Features

- 🎮 **Match Creation**: Automatically creates voice channels when matches are ready
- 🎤 **Voice Management**: Moves players to team channels automatically
- 📊 **Queue Sync**: Syncs Discord queue with web platform in real-time
- 🏷️ **Nickname Management**: Link Discord users to Standoff 2 in-game names
- 🤖 **Slash Commands**: `/setnickname`, `/match status`

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_server_id
NEATQUEUE_BOT_ID=neatqueue_bot_id
QUEUE_CHANNEL_ID=queue_voice_channel_id
BACKEND_URL=https://backend.anandoctane4.workers.dev
```

### 3. Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create New Application
3. Go to "Bot" section
4. Click "Reset Token" and copy it to `DISCORD_TOKEN`
5. Enable these Privileged Gateway Intents:
   - Server Members Intent
   - Message Content Intent
6. Go to "OAuth2" → "URL Generator"
7. Select scopes: `bot`, `applications.commands`
8. Select permissions:
   - Manage Channels
   - Manage Roles
   - Move Members
   - Read Messages/View Channels
   - Send Messages
   - Connect
   - Speak
9. Copy the generated URL and invite bot to your server

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

## Deploy to Railway

1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Link project: `railway link`
4. Deploy: `npm run deploy`

Or use Railway's GitHub integration for auto-deployment.

## Commands

- `/setnickname <name>` - Set your Standoff 2 in-game nickname
- `/match status` - Check current match status

## Architecture

```
discord-bot/
├── src/
│   ├── index.ts              # Bot entry point
│   ├── commands/             # Slash commands
│   ├── events/               # Discord event handlers
│   ├── services/
│   │   ├── backend.ts        # Backend WebSocket client
│   │   └── voice.ts          # Voice channel management
│   └── types/                # TypeScript definitions
├── package.json
└── tsconfig.json
```

## License

MIT
