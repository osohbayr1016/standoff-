---
description: Standoff 2 Website System Architecture & Workflow
---

# Standoff 2 Website - Системийн Архитектур

## Үндсэн Дизайн Шийдвэрүүд

### 1. NeatQueue API Хэрэглэхгүй
- NeatQueue API дахин хэрэглэхгүй
- Бүх matchmaking logic нь manual + Discord bot дээр суурилна

### 2. Discord Bot Интеграци
- Discord bot нь үндсэн authentication болон role-based access control хийнэ
- Moderator role шалгах
- User verification

---

## Matchmaking System Workflow

### Lobby Үүсгэх (Host)
1. User Standoff 2 тоглоомын custom lobby URL үүсгэнэ (тоглоомоос)
2. Website дээр "Create Match" дарж lobby URL-аа оруулна
3. Тухайн lobby Home matchmaking page дээр харагдана

### Matchmaking Page (Real-time)
- Бүх active lobby-ууд жагсаалтаар харагдана
- Real-time status: `{playerCount}/10` гэх мэт
- Lobby status: "Waiting", "In Progress", "Completed"
- WebSocket ашиглан real-time update

### Match Дуусах (Host)
1. Lobby host match дууссны дараа "End Match" дарна
2. Match result screenshot upload хийнэ
3. Match pending review статустай болно

---

## Moderator System

### Moderator Page Access Control
- Discord bot ашиглан moderator role шалгана
- Discord server дээр moderator role байгаа эсэхийг шалгана
- Зөвхөн moderator role-той хүмүүс moderator page-рүү орно

### Moderator Үүргүүд
1. Match result хянах (screenshot үзэх)
2. ELO нэмэх/хасах шийдвэр гаргах
3. Player profile шалгах
4. Ban/Unban хийх

### Match Review Workflow
1. Match result screenshot-тай pending review жагсаалтанд орно
2. Moderator screenshot болон match details үзнэ
3. Winner/Loser тодорхойлно
4. ELO өөрчлөлт approve хийнэ
5. Players-ийн ELO update хийгдэнэ

---

## Player Profile

### Хадгалагдах Мэдээлэл
- Match result screenshots (бүх тоглолтын)
- ELO нэмэгдэж хасагдсан history
- Match history (wins, losses, dates)
- Current ELO rating

### Profile Access
- Players өөрийн profile үзэх боломжтой
- Moderators бүх player profile үзэх, шалгах боломжтой

---

## Database Schema Requirements

### Matches Table
- id, lobby_url, host_id, status, player_count
- result_screenshot_url
- winner_team, loser_team
- elo_changes (JSON)
- reviewed_by, reviewed_at
- created_at, updated_at

### ELO History Table
- id, user_id, match_id
- elo_before, elo_after, elo_change
- reason (match_win, match_loss, manual_adjustment)
- created_at

### Match Screenshots Table
- id, match_id, screenshot_url
- uploaded_by, uploaded_at

---

## API Endpoints Required

### Matchmaking
- POST /api/matches - Create new match/lobby
- GET /api/matches - Get all active matches (real-time)
- PATCH /api/matches/:id - Update match status
- POST /api/matches/:id/result - Submit match result + screenshot
- GET /api/matches/:id - Get match details

### Moderator
- GET /api/moderator/pending-reviews - Pending match reviews
- POST /api/moderator/matches/:id/review - Review and approve match result
- GET /api/moderator/players - All players list
- GET /api/moderator/players/:id - Player details + history
- POST /api/moderator/players/:id/elo-adjust - Manual ELO adjustment

### Profile
- GET /api/profile - Current user profile
- GET /api/profile/matches - User's match history
- GET /api/profile/elo-history - User's ELO history

---

## WebSocket Events

### Real-time Updates
- `match:created` - New match created
- `match:updated` - Match status changed
- `match:player_joined` - Player joined match
- `match:player_left` - Player left match
- `match:completed` - Match finished
- `elo:updated` - ELO changed for user

---

## Frontend Pages

### Home/Matchmaking Page
- Active lobbies list with real-time status
- Create match button
- Join match functionality

### Moderator Page (Protected)
- Pending reviews list
- Match review modal
- Player search/list
- ELO management tools

### Player Profile Page
- Stats overview
- Match history with screenshots
- ELO history graph/list
