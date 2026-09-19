# Implementation Plan: Live Polling Tool (Real-Time)

Build a production-ready, ultra-responsive live polling web application where creators design and launch polls, audience members vote seamlessly from mobile/desktop, and live animated visual results stream in real-time without page refreshes.

---

## 1. Stack & Architectural Separation

```mermaid
graph TD
    subgraph Frontend [React Frontend (Vite)]
        UI[Creator Dashboard & Audience Voting UI]
        WSClient[WebSocket Client (Auto-reconnect)]
    end

    subgraph Backend [Go + Gin Backend Service]
        Router[Gin HTTP Router & Middleware]
        AuthCtrl[Auth & JWT Controller]
        PollCtrl[Poll CRUD Controller]
        VoteCtrl[Vote & Validation Controller]
        WSHub[Goroutine-Safe WebSocket Hub]
    end

    subgraph DataRealtime [Data & Real-Time Engines]
        Mongo[(MongoDB)]
        Redis[(Redis)]
    end

    UI -->|REST API Requests| Router
    WSClient <-->|Bi-directional WS Connection| WSHub
    Router --> AuthCtrl & PollCtrl & VoteCtrl
    
    VoteCtrl -->|Deduplication Check SADD| Redis
    VoteCtrl -->|Atomic Count Increment HINCRBY| Redis
    VoteCtrl -->|Publish Event PUBLISH| Redis
    VoteCtrl -->|Persist Audit Record InsertOne| Mongo
    PollCtrl -->|Cache / Read-through| Redis
    PollCtrl -->|CRUD Operations| Mongo
    AuthCtrl -->|User Accounts| Mongo

    Redis -.->|Pub/Sub Subscription| WSHub
    WSHub -.->|Broadcast Live State| WSClient
```

### Why Each Layer Matters:
1. **Frontend (React)**: High-polish UI with live SVG/CSS bar charts, QR code generation, voter animations, real-time WebSocket connection handling, and clean role separation (Presenter/Host view vs Audience voter view).
2. **Backend (Go / Gin)**: High-performance concurrency, strict backend request validation, JWT authentication, and goroutine-safe WebSocket connection hubs.
3. **Database (MongoDB)**: Durable persistence for users, polls, options, and immutable historical vote records with timestamps.
4. **Realtime & State (Redis)**: 
   - **Atomic In-Memory Counts**: `HINCRBY` ensures zero race conditions during voting surges.
   - **Voter Deduplication**: `SADD poll:<id>:voters <voter_token>` ensures atomic single-vote enforcement.
   - **Presence / Viewer Counts**: Redis sets/hashes for active viewers watching the poll.
   - **Pub/Sub Fanout**: `PUBLISH poll_events:<id>` triggers Go WebSocket hubs to broadcast live results across multiple backend worker nodes.

---

## 2. User Flows & Feature Scope

### Core Flow
1. **Authentication**: Creator sign up / login (email + password with bcrypt + JWT token).
2. **Poll Creation**:
   - Title, description, 2+ options (dynamically add/remove).
   - Settings: Single-choice vs Multiple-choice, allow public results, close/open toggle.
   - Unique 6-character access code and shareable URL.
3. **Audience Voting**:
   - Open link or enter 6-character code (no login required for voters).
   - Fingerprint / session-token generated to prevent duplicate votes (backed by Redis `SADD`).
   - Clean, touch-friendly mobile UI.
4. **Live Results (Zero-Refresh)**:
   - Presenter Mode: Clean fullscreen view with QR code, live percentage breakdown, total vote ticker, and active audience count.
   - Instant visual transitions when new votes arrive.

### Extra Features (High Wow Factor)
- **Live Audience Presence**: Shows "👥 X people watching right now" via WebSocket connect/disconnect hooks.
- **Embedded QR Code**: Audience can scan immediately on presenter's screen.
- **Poll Status Controls**: Presenter can pause/close voting in real-time; audience UI instantly updates to "Voting Closed".
- **Export Analytics**: Export poll results as JSON/CSV.
- **Single-Binary / Unified Deploy Option**: Go can serve the React production build directly, or both can run independently with CORS.

---

## 3. Project Directory Structure

```
/livepoll
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go               # Server bootstrap & graceful shutdown
│   ├── config/
│   │   └── config.go                 # Environment variables (Mongo, Redis, Port, JWT)
│   ├── controllers/
│   │   ├── auth_controller.go        # Register, Login, Me
│   │   ├── poll_controller.go        # Create, Get, List, Close, Delete
│   │   └── vote_controller.go        # Vote submission, Validation, Redis increment
│   ├── middleware/
│   │   ├── auth.go                   # JWT verification
│   │   └── cors.go                   # CORS headers
│   ├── models/
│   │   ├── user.go                   # MongoDB User schema & DTOs
│   │   ├── poll.go                   # MongoDB Poll schema & DTOs
│   │   └── vote.go                   # MongoDB Vote schema & DTOs
│   ├── repository/
│   │   ├── mongo_repo.go             # MongoDB queries & connection
│   │   └── redis_repo.go             # Redis atomic counts, sets, pub/sub
│   ├── websocket/
│   │   ├── hub.go                    # Per-poll client hubs & Redis subscriber
│   │   └── client.go                 # WebSocket client reader/writer
│   ├── go.mod
│   └── go.sum
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── QRCodeModal.jsx
│   │   │   ├── ResultBar.jsx         # Animated vote bar
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── Toast.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx       # Auth state & user session
│   │   ├── hooks/
│   │   │   └── useLivePoll.js        # WebSocket connection, auto-reconnect, fallback
│   │   ├── pages/
│   │   │   ├── Home.jsx              # Landing page + Join by code
│   │   │   ├── Login.jsx             # Auth login
│   │   │   ├── Register.jsx          # Auth register
│   │   │   ├── Dashboard.jsx         # Creator poll management
│   │   │   ├── CreatePoll.jsx        # Poll builder
│   │   │   ├── PollVote.jsx          # Audience voting page
│   │   │   └── PollHost.jsx          # Presenter live screen
│   │   ├── services/
│   │   │   └── api.js                # Axios/fetch client
│   │   ├── App.jsx
│   │   ├── index.css                 # Modern CSS design system (dark/light, glassmorphism)
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── README.md                         # Architecture, Decisions, Run Guide, Deploy Guide
└── render.yaml / Dockerfile          # Production deployment configs
```

---

## 4. Proposed Changes & Implementation Steps

### Phase 1: Backend Foundation (Go + Gin + Mongo + Redis)
- Initialize Go module (`backend`).
- Configure Gin router with CORS, logger, and recovery.
- Integrate MongoDB driver (`go.mongodb.org/mongo-driver/mongo`) for durable records.
- Integrate Redis client (`github.com/redis/go-redis/v9`) with connection resilience (support external URLs such as Upstash / Atlas or local fallback).
- Build WebSocket hub with Gorilla WebSocket (`github.com/gorilla/websocket`), subscribing to Redis pub/sub channel `poll_events:<poll_id>`.

### Phase 2: Core Backend APIs & Realtime Logic
- Implement Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`.
- Implement Polls: `/api/polls` (Create with options, Get by ID/Code, Creator List, Toggle Active/Closed).
- Implement Voting:
  - Input validation: poll must exist, poll must not be closed, option must be valid.
  - Redis `SADD poll:<id>:voters <voter_hash>`: returns 0 if already voted -> 409 Conflict.
  - Redis `HINCRBY poll:<id>:counts <option_id> 1`.
  - Redis `PUBLISH poll_events:<id> <json_payload>`.
  - Async MongoDB insert for historical audit records.
- Implement WebSocket route: `/ws/polls/:id` for streaming live vote counts and viewer presence.

### Phase 3: Frontend Application (React + Vite)
- Initialize Vite React project (`frontend`).
- Implement Design System: Dark aesthetic, smooth typography (Inter/Outfit), glassmorphism cards, vibrant accents, micro-animations.
- Pages:
  - **Landing Page**: Catchy hero, "Enter 6-Digit Code" instant join form, quick link to create a poll.
  - **Auth**: Clean Login & Registration.
  - **Dashboard**: All user's polls, total votes, live status badges, "Host View" link, "Copy Invite" link.
  - **Create Poll**: Interactive form with dynamic option adder/remover, title, description, single/multi-choice setting.
  - **Audience Voter View**: Mobile-optimized, instant option selection, confetti/success confirmation, immediate real-time results toggle.
  - **Presenter / Host Live View**: Fullscreen projector-friendly layout, real-time live bars with animated percentages, QR code display, live total votes counter, live viewers counter, "Close Poll" toggle.

### Phase 4: Verification & Polish
- Test end-to-end voting in parallel browser sessions (Host screen in one window, multiple voters in private windows).
- Verify instant zero-refresh UI updates.
- Test duplicate vote prevention and validation errors.
- Prepare deployment config and thorough README.md documenting architecture and live deployment instructions.

---

## 5. Verification Plan

### Automated / Programmatic Tests
- Go unit/integration test for vote counting and validation (`go test ./...`).
- Concurrent voting stress test script (`scratch/benchmark_test.go` or node script) sending 50 parallel votes to verify Redis atomicity and WebSocket broadcasts.

### Manual Live Verification
- Open Host Screen on desktop browser.
- Open Voter Screen on a separate mobile/incognito browser.
- Cast votes across different options:
  - Verify presenter screen updates within <100ms without page reload.
  - Verify duplicate vote from same voter shows clear message.
  - Verify toggle "Close Poll" on Host screen immediately disables voting on Voter screen in real time.
