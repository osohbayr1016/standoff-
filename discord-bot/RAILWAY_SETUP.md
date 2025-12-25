# Railway Deployment Setup Guide

## Issue: TokenInvalid Error

If you're seeing this error:
```
❌ Unhandled promise rejection: Error [TokenInvalid]: An invalid token was provided.
```

This means your Discord bot token is not properly configured in Railway.

## Solution: Configure Environment Variables

### Step 1: Get Your Discord Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application (or create a new one)
3. Navigate to the **Bot** section in the left sidebar
4. Click **Reset Token** button
5. **Copy the token immediately** - you won't be able to see it again!
6. Make sure these **Privileged Gateway Intents** are enabled:
   - ✅ **Server Members Intent**
   - ✅ **Message Content Intent**

### Step 2: Configure Railway Environment Variables

1. Go to your [Railway Dashboard](https://railway.app/dashboard)
2. Select your Discord bot project
3. Click on the **Variables** tab
4. Add the following environment variables:

#### Required Variables:

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `DISCORD_TOKEN` | `YOUR_BOT_TOKEN_HERE` | The token you copied from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | `1453495820585533480` | Your Discord application client ID |
| `DISCORD_GUILD_ID` | `1452635831901753357` | Your Discord server (guild) ID |
| `BACKEND_URL` | `https://backend.anandoctane4.workers.dev` | Your backend API URL |
| `BACKEND_WEBHOOK_SECRET` | `my_super_secret_key_12345` | Secret for backend webhooks |
| `NEATQUEUE_BOT_ID` | `857633321064595466` | NeatQueue bot user ID |
| `QUEUE_CHANNEL_ID` | `1453526990798983394` | Voice channel ID for queue |

#### Optional Variables:

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `NODE_ENV` | `production` | Environment mode |

### Step 3: Deploy

After adding all environment variables:

1. Railway will automatically redeploy your bot
2. Check the deployment logs to verify the bot starts successfully
3. You should see:
   ```
   ✅ Discord token validated (length: XX characters)
   🔄 Starting Discord bot...
   ✅ Bot logged in as YourBotName#1234
   ```

## Troubleshooting

### Token Still Invalid?

1. **Verify the token is correct**: Make sure you copied the entire token without any extra spaces
2. **Check token permissions**: Ensure the bot has the required privileged intents enabled
3. **Regenerate token**: If the token is old or compromised, reset it in Discord Developer Portal
4. **Check Railway logs**: Look for the token validation message to see if it's detecting issues

### Bot Not Responding?

1. **Check bot permissions**: Make sure the bot has the required permissions in your Discord server
2. **Verify guild ID**: Ensure `DISCORD_GUILD_ID` matches your server ID
3. **Check backend connection**: Verify `BACKEND_URL` is accessible

### How to Get IDs:

- **Client ID**: Discord Developer Portal → Your App → General Information → Application ID
- **Guild ID**: Discord → Server Settings → Widget → Server ID (enable Developer Mode in Discord settings)
- **Channel ID**: Right-click on a channel → Copy ID (requires Developer Mode)
- **User ID**: Right-click on a user → Copy ID (requires Developer Mode)

## Local Development

For local development, create a `.env` file:

```bash
cp .env.example .env
```

Then edit `.env` with your actual values and run:

```bash
npm install
npm run dev
```

## Deployment Commands

```bash
# Deploy to Railway
railway up

# View logs
railway logs

# Open Railway dashboard
railway open
```

## Security Notes

- ⚠️ **Never commit your `.env` file** to Git
- ⚠️ **Never share your Discord token** publicly
- ⚠️ **Rotate tokens regularly** for security
- ⚠️ Use different tokens for development and production
