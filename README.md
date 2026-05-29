# StudyRoom — Collaborative Study Platform

> Assessment 4 · Full-Stack Web Development

A web-based real-time collaborative study platform where users create virtual study rooms, invite peers, run timed study sessions, chat, and track their progress.

---

## Table of Contents

- [Live Demo](#live-demo)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Core Features](#core-features)
- [Additional Features](#additional-features)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Socket.io Events](#socketio-events)
- [Design Decisions](#design-decisions)

---

## Live Demo

| Service | URL |
|---|---|
| Frontend | *(deploy to Vercel/Netlify)* |
| Backend | *(deploy to Render/Railway)* |
| Database | MongoDB Atlas M0 (free tier) |

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | React 18 + Vite | Fast dev, component model |
| Styling | Tailwind CSS | Utility-first, deep navy theme |
| Client state | Zustand | Lightweight, sessionStorage persisted |
| Server state | TanStack Query v5 | Caching, loading states |
| Routing | React Router v6 | Standard SPA routing |
| Charts | Recharts | Bar + donut charts |
| Backend | Node.js + Express | Familiar, flexible |
| Real-time | Socket.io | Rooms, reconnection, personal channels |
| ODM | Mongoose | Schema validation, easy queries |
| Database | MongoDB Atlas M0 | Free tier, no infra to manage |
| Auth | JWT (access + refresh) | Stateless, httpOnly cookie for refresh |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A free [MongoDB Atlas](https://mongodb.com/atlas) account

### 1. Clone and install

```bash
# Install server dependencies
cd study-room/server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure environment variables

**`study-room/server/.env`**
```env
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/studyroom
JWT_SECRET=your-access-token-secret
JWT_REFRESH_SECRET=your-refresh-token-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
```

**`study-room/client/.env`**
```env
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
```

### 3. Run

```bash
# Terminal 1 — backend
cd study-room/server
npm run dev

# Terminal 2 — frontend
cd study-room/client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Core Features

All mandatory requirements from the assessment are implemented:

### ✅ Authentication
- Register / Login / Logout
- JWT access token (15 min) stored in memory (Zustand + sessionStorage)
- Refresh token (7 days) in httpOnly cookie with automatic rotation
- Silent token refresh via Axios interceptor — failed 401s retry automatically
- Auth persists across page refreshes and new tabs via sessionStorage

### ✅ Study Room Management
- Create rooms with name and optional description
- Join via shareable invite link (`/join/:inviteCode`)
- Edit room name/description (owner only)
- Delete room with confirmation modal (owner only)
- Search and filter rooms (All / My rooms / Joined)

### ✅ Session Timer
- Per-user independent timers — each participant tracks their own study time
- Start, Pause, Resume, End controls
- Timer persists across page refreshes (server-authoritative)
- Session auto-saved if user disconnects mid-session
- Session end celebration modal with confetti animation

### ✅ Room Chat
- Real-time messaging via Socket.io
- WhatsApp-style left/right bubble layout
- Grouped messages (consecutive messages from same sender)
- Typing indicators with 2-second debounce
- Cursor-based message pagination (load earlier messages)
- Optimistic message send with server reconciliation

### ✅ Real-time Room Updates
- Live presence indicators (🟢 Studying X min / 🟡 Paused / ⚫ Offline)
- Member list updates instantly when users join or leave
- 5-second grace period on disconnect — page refresh doesn't show as offline
- Room deleted notification pushed to all members regardless of current page
- Personal socket rooms (`user:<id>`) for cross-page events

### ✅ Activity Dashboard
- Total study time, session count, rooms joined, current streak
- 7-day bar chart (seconds-accurate, sub-minute sessions count)
- Donut chart for top subjects by room
- Recent sessions and room quick-links
- Streak counts days with any study activity in your rooms

---

## Additional Features

Beyond the mandatory requirements, the following enhancements were implemented:

### 📅 Calendar
- Month and week view with session chips per day
- Color-coded chips per room (consistent hash-based colors)
- Schedule future sessions with room picker, datetime, and optional note
- Past date restriction enforced on both client and server
- Day detail panel showing session history and scheduled sessions
- Timezone-aware — uses client's UTC offset for accurate date bucketing
- Inline room creation from the schedule modal

### 🏆 Leaderboard
- **My Rooms** tab — ranks participants within your rooms
- **Global** tab — ranks all users across the entire platform
- Visual podium for top 3 (🥇🥈🥉) with animated crown
- Filter by period: This week / This month / All time
- Filter by specific room (My Rooms scope)
- Your position highlighted with a ✓ badge

### ⚙️ Settings
- **Profile** — update name and bio; email is non-editable
- **Change password** — requires current password verification
- **Appearance** — theme selector (dark), density picker
- **Privacy** — show/hide online status; affects presence dots in real-time

### 🎯 Focus Status in Participant List
- Each participant shows their personal study time: `🟢 34m`
- Paused state shown as `🟡 Paused`
- Updates every second via Socket.io tick

### 🔔 Room Deletion Safety
- Owner cannot delete a room while a session is active
- Confirmation modal lists what will be permanently deleted
- All members receive instant notification and are redirected

### 📊 Smart Activity Feed
- Deduplicates consecutive same-user same-event within 30 seconds
- 8-second grace period on leave — page refresh doesn't log "left the room"
- Filters out noisy events (message sent) to keep feed meaningful
- Session end shows duration: "ended their session · 2m 34s"

### 🔗 Calendar ↔ Rooms Integration
- Create room modal includes "Schedule first session?" toggle
- Calendar schedule modal has inline room creation
- Room cards show next scheduled session: "📅 Tomorrow, 7:00 PM"

---

## Project Structure

```
study-room/
├── client/                     # React + Vite frontend
│   └── src/
│       ├── pages/
│       │   ├── Login.jsx       # Split layout with CSS illustration
│       │   ├── Register.jsx
│       │   ├── Rooms.jsx       # Home — sidebar + room list + search
│       │   ├── RoomDetail.jsx  # 3-column: members | timer+chat | activity
│       │   ├── Dashboard.jsx   # Stats, charts, recent sessions
│       │   ├── Calendar.jsx    # Month/week view + session scheduling
│       │   ├── Leaderboard.jsx # My Rooms + Global rankings with podium
│       │   └── Settings.jsx    # Profile, appearance, privacy
│       ├── components/
│       │   ├── AppSidebar.jsx  # Shared navigation sidebar
│       │   ├── Chat.jsx        # WhatsApp-style chat
│       │   ├── MemberList.jsx  # Participants with focus status
│       │   ├── ActivityFeed.jsx
│       │   ├── Timer.jsx
│       │   ├── SessionControls.jsx
│       │   └── SessionEndModal.jsx  # Confetti celebration
│       ├── hooks/
│       │   ├── useSocket.js    # Singleton socket connection
│       │   └── useSession.js   # Per-user timer state
│       ├── store/
│       │   └── useStore.js     # Zustand + sessionStorage persistence
│       └── api/
│           └── client.js       # Axios + silent token refresh
│
└── server/                     # Node.js + Express backend
    └── src/
        ├── routes/
        │   ├── auth.routes.js
        │   ├── room.routes.js
        │   ├── session.routes.js    # Sessions + calendar + scheduling
        │   ├── dashboard.routes.js
        │   ├── leaderboard.routes.js
        │   └── user.routes.js       # Profile + password
        ├── sockets/
        │   └── room.socket.js       # All Socket.io handlers
        ├── models/
        │   ├── User.js
        │   ├── Room.js
        │   ├── RoomMember.js
        │   ├── StudySession.js
        │   ├── ScheduledSession.js
        │   ├── Message.js
        │   ├── ActivityLog.js
        │   └── RefreshToken.js
        └── services/
            ├── auth.service.js
            └── room.service.js
```

---

## API Reference

### Auth — `/api/auth`
| Method | Path | Auth |
|---|---|---|
| POST | `/register` | No |
| POST | `/login` | No |
| POST | `/refresh` | No |
| POST | `/logout` | Yes |

### Rooms — `/api/rooms`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List user's rooms (with member counts) |
| POST | `/` | Create room |
| GET | `/:id` | Room details + members |
| PATCH | `/:id` | Update room (owner) |
| DELETE | `/:id` | Delete room (owner) |
| POST | `/join/:inviteCode` | Join via invite |
| GET | `/:id/messages` | Paginated chat history |
| GET | `/:id/online` | Current online users (REST hydration) |

### Sessions — `/api`
| Method | Path | Description |
|---|---|---|
| GET | `/rooms/:id/sessions` | Session history |
| GET | `/calendar` | Sessions + scheduled for a month |
| POST | `/schedule` | Create scheduled session |
| DELETE | `/schedule/:id` | Cancel scheduled session |
| GET | `/upcoming` | Next scheduled sessions across all rooms |

### Dashboard — `/api/dashboard`
| Method | Path |
|---|---|
| GET | `/stats` |
| GET | `/rooms/:id/activity` |

### Leaderboard — `/api/leaderboard`
| Query Param | Values |
|---|---|
| `scope` | `my` (default) \| `global` |
| `period` | `week` \| `month` \| `all` |
| `roomId` | optional room filter |

### User — `/api/user`
| Method | Path |
|---|---|
| GET | `/me` |
| PATCH | `/me` |
| PATCH | `/password` |

---

## Socket.io Events

### Client → Server
| Event | Payload |
|---|---|
| `room:join` | `{ roomId }` |
| `room:leave` | `{ roomId }` |
| `session:start` | `{ roomId }` |
| `session:pause` | `{ roomId, sessionId }` |
| `session:resume` | `{ roomId, sessionId }` |
| `session:end` | `{ roomId, sessionId }` |
| `chat:send` | `{ roomId, content }` |
| `typing:start` | `{ roomId }` |
| `typing:stop` | `{ roomId }` |

### Server → Client
| Event | Description |
|---|---|
| `room:online_users` | Full presence list (broadcast to room) |
| `room:user_joined` | Member came online |
| `room:user_left` | Member went offline |
| `room:deleted` | Room was deleted (via personal `user:<id>` channel) |
| `session:state` | Timer state sync (sent only to the relevant user) |
| `session:tick` | Personal timer heartbeat (1s, sent only to owner) |
| `chat:message` | New message (optimistic) |
| `chat:message_saved` | Persisted message with real ID |
| `chat:typing` | Typing indicator |
| `activity:new` | New activity log entry |

---

## Design Decisions

**No Docker** — MongoDB Atlas M0 is used as the cloud database. No local containers needed, which simplifies setup and works well on free hosting tiers.

**Per-user session timers** — Each participant has an independent timer. Starting or ending your session doesn't affect others. Sessions are auto-saved if you disconnect.

**Server-authoritative presence** — Online status is tracked in a server-side Map with a 5-second grace period on disconnect. Page refreshes don't cause flicker to offline.

**Personal socket rooms** — Every connected socket joins `user:<userId>`. This allows the server to push events (like room deletion) to a user regardless of which page they're on.

**Cursor-based pagination** — Messages use `_id`-based cursors instead of offset pagination. Stable under concurrent inserts.

**sessionStorage for auth** — Access token is persisted in sessionStorage (not localStorage). Survives page refreshes and new tabs opened from the same session, but clears when the browser is closed.

**Duplicate event prevention** — Join/leave activity logs have an 8-second grace period. Reconnects within that window cancel the leave log entirely, preventing "left → joined" spam in the activity feed.
