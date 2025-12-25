# NeatQueue API Integration - Complete Guide

## ✅ Backend Endpoints Created

### 1. **POST** `/api/join-queue`
Дараалалд нэгдэх
```json
Request: { "userId": "discord_user_id" }
Response: { "success": true, "message": "Та дараалалд орлоо!" }
```

### 2. **GET** `/api/queue-status`
Дараалалын статус (Live)
```json
Response: {
  "success": true,
  "queueCount": 5,
  "players": [...]
}
```

### 3. **GET** `/api/leaderboard`
Шилдэг тоглогчдын жагсаалт
```json
Response: {
  "success": true,
  "leaderboard": [...]
}
```

### 4. **GET** `/api/player-stats/:playerId`
Тоглогчийн статистик
```json
Response: {
  "success": true,
  "stats": { ... }
}
```

## 🔧 Environment Variables Required

Add these to Cloudflare Workers:

```bash
cd backend

# NeatQueue Credentials
npx wrangler secret put NEATQUEUE_API_KEY
npx wrangler secret put NEATQUEUE_QUEUE_ID

# Discord Server Info
npx wrangler secret put DISCORD_SERVER_ID
npx wrangler secret put DISCORD_CHANNEL_ID
```

### Local Development (`.dev.vars`):
```
NEATQUEUE_API_KEY=your_api_key
NEATQUEUE_QUEUE_ID=your_queue_id
DISCORD_SERVER_ID=your_server_id
DISCORD_CHANNEL_ID=your_channel_id
```

## 🎨 Frontend Component Created

### LiveQueueStatus Component
Location: `frontend/src/components/LiveQueueStatus.tsx`

Features:
- ✅ Auto-refresh every 5 seconds
- ✅ Animated gradient background
- ✅ Live indicator with pulse animation
- ✅ Player list (shows first 5)
- ✅ Empty state handling

### Usage in Your App:
```tsx
import LiveQueueStatus from './components/LiveQueueStatus';

function HomePage() {
  return (
    <div>
      <LiveQueueStatus />
      {/* Other components */}
    </div>
  );
}
```

## 📦 Deploy Steps

1. **Set Environment Variables**:
```bash
cd backend
npx wrangler secret put NEATQUEUE_API_KEY
npx wrangler secret put NEATQUEUE_QUEUE_ID
npx wrangler secret put DISCORD_SERVER_ID
npx wrangler secret put DISCORD_CHANNEL_ID
```

2. **Deploy Backend**:
```bash
npx wrangler deploy
```

3. **Test Endpoints**:
```bash
# Test queue status
curl https://backend.anandoctane4.workers.dev/api/queue-status

# Test leaderboard
curl https://backend.anandoctane4.workers.dev/api/leaderboard
```

## 🧪 Frontend Integration Examples

### Join Queue Button:
```tsx
const handleJoinQueue = async () => {
  const response = await fetch('https://backend.anandoctane4.workers.dev/api/join-queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id })
  });
  
  const data = await response.json();
  if (data.success) {
    alert(data.message);
  }
};
```

### Get Player Stats:
```tsx
const fetchPlayerStats = async (playerId: string) => {
  const response = await fetch(
    `https://backend.anandoctane4.workers.dev/api/player-stats/${playerId}`
  );
  const data = await response.json();
  return data.stats;
};
```

## 🎯 Next Steps

1. ✅ Get NeatQueue credentials from dashboard
2. ✅ Add secrets to Cloudflare
3. ✅ Deploy backend
4. ✅ Import `LiveQueueStatus` component in your frontend
5. ✅ Test the live queue display!

The component will automatically refresh every 5 seconds to show real-time queue updates! 🚀
